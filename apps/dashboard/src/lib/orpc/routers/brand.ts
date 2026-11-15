import { randomUUID } from "node:crypto";

import {
  allowUnmeteredAiInDevelopment,
  autumn,
} from "@notra/ai/billing/autumn";
import { FEATURES } from "@notra/ai/billing/features";
import { deleteQstashSchedule } from "@notra/ai/qstash/triggers";
import {
  isUnmeteredReference,
  withReferenceBillingFlag,
} from "@notra/ai/utils/brand-references";
import { redis } from "@notra/ai/utils/redis";
import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import {
  brandGuidelineAssets,
  brandGuidelineColors,
  brandGuidelineFonts,
  brandGuidelineScreenshots,
  brandGuidelines,
  brandGuidelineTokens,
  brandReferences,
  brandSettings,
  connectedSocialAccounts,
  contentTriggers,
} from "@notra/db/schema";
import { isPgUniqueViolation } from "@notra/db/utils/pg-errors";
import { invalidateGeoIngestHostsCacheForBrand } from "@notra/geo-core/geo/ingest";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { organizationIdInputSchema } from "@notra/schemas/dashboard/auth/organization";
import {
  analyzeInputSchema,
  createReferenceSchema,
  fetchTweetSchema,
  importTweetsSchema,
  referenceInputSchema,
  referenceSourceUrlSchema,
  setDefaultVoiceInputSchema,
  updateReferenceSchema,
  voiceCreateInputSchema,
  voiceInputSchema,
  voiceUpdateInputSchema,
} from "@notra/schemas/dashboard/brand";
import {
  attachGuidelineSourcePdfSchema,
  createGuidelineAssetSchema,
  createGuidelineColorSchema,
  updateGuidelineAssetSchema,
  updateGuidelineColorSchema,
  updateGuidelineFontSchema,
  updateGuidelineScreenshotSchema,
  updateGuidelineTokenSchema,
} from "@notra/schemas/dashboard/brand-guidelines";
import { isSameUrl } from "@notra/utils/url";
import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { Effect } from "effect";

import { REFERENCE_LIMIT_REACHED_CODE } from "@/constants/brand";
import {
  BRAND_REFERENCE_SOURCES,
  REFERENCE_QUOTA_FEATURE,
} from "@/constants/integration-analytics";
import { normalizeTwitterProfileImageUrl } from "@/constants/twitter";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { assertActiveSubscription } from "@/lib/billing/subscription";
import {
  attachBrandGuidelineSourcePdf,
  BrandGuidelineSourcePdfValidationError,
  removeBrandGuidelineSourcePdf,
} from "@/lib/brand-guideline-pdf";
import {
  getBrandGuidelines,
  markBrandGuidelinesFailed,
  startBrandGuidelineGeneration,
} from "@/lib/brand-guidelines";
import { countBrandVoices } from "@/lib/brand-voice-count";
import { getTranslations } from "@/lib/i18n/server";
import { baseProcedure, withOrganizationAccess } from "@/lib/orpc/base";
import {
  startBrandAnalysisRun,
  startBrandGuidelinesRun,
} from "@/lib/workflows/start";
import type { BrandReferenceSource } from "@/types/analytics/integration-events";
import type { TrackServerEventInput } from "@/types/analytics/posthog";
import type {
  BrandSettings as BrandVoiceOutput,
  ProgressData,
} from "@/types/hooks/brand-analysis";
import type {
  ApplicablePlatform,
  BrandReference as BrandReferenceOutput,
} from "@/types/hooks/brand-references";
import type {
  TwitterTimelineResponse,
  TwitterTweet,
  TwitterUser,
} from "@/types/services/twitter";
import { ratelimit } from "@/utils/ratelimit";
import {
  fetchTweet,
  fetchTwitterUserWithPinnedTweet,
  twitterAppFetch,
} from "@/utils/twitter-fetcher";
import { validateWebsiteUrl } from "@/utils/website-url";

import {
  badRequest,
  conflict,
  forbidden,
  internalServerError,
  notFound,
  tooManyRequests,
} from "../utils/errors";
import { brandSitemapsRouter } from "./brand-sitemaps";

const FREE_IMPORTED_TWEET_REFERENCE_LIMIT = 10;

const typeDefaults: Record<string, ApplicablePlatform[]> = {
  twitter_post: ["twitter"],
  linkedin_post: ["linkedin"],
  blog_post: ["blog"],
};

async function verifyVoiceOwnership(organizationId: string, voiceId: string) {
  const voice = await db.query.brandSettings.findFirst({
    where: and(
      eq(brandSettings.id, voiceId),
      eq(brandSettings.organizationId, organizationId)
    ),
  });

  if (!voice) {
    throw notFound("Brand voice not found");
  }

  return voice;
}

async function voiceNameTakenError() {
  const tErrors = await getTranslations("errors.brand");
  return conflict(tErrors("voiceNameTaken"));
}

async function listBrandVoices(organizationId: string) {
  const voices = await db.query.brandSettings.findMany({
    where: eq(brandSettings.organizationId, organizationId),
    orderBy: [desc(brandSettings.isDefault), asc(brandSettings.createdAt)],
  });
  return { voices: voices.map(serializeBrandVoice) };
}

async function getGuidelineIdForVoice(voiceId: string) {
  const guideline = await db.query.brandGuidelines.findFirst({
    where: eq(brandGuidelines.brandSettingsId, voiceId),
    columns: { id: true },
  });

  if (!guideline) {
    throw notFound("Brand guidelines not found");
  }

  return guideline.id;
}

async function getEditableGuidelineId(organizationId: string, voiceId: string) {
  await verifyVoiceOwnership(organizationId, voiceId);
  return getGuidelineIdForVoice(voiceId);
}

async function getTriggersForBrandVoice(
  organizationId: string,
  voiceId: string
) {
  const allTriggers = await db.query.contentTriggers.findMany({
    columns: {
      enabled: true,
      id: true,
      name: true,
      outputConfig: true,
      qstashScheduleId: true,
      sourceType: true,
    },
    where: eq(contentTriggers.organizationId, organizationId),
  });

  return allTriggers.filter((trigger) => {
    const config = trigger.outputConfig as { brandVoiceId?: string } | null;
    return config?.brandVoiceId === voiceId;
  });
}

async function getReferenceById(referenceId: string, voiceId: string) {
  return db.query.brandReferences.findFirst({
    where: and(
      eq(brandReferences.id, referenceId),
      eq(brandReferences.brandSettingsId, voiceId)
    ),
  });
}

function isOriginalTweet(tweet: TwitterTweet) {
  return !tweet.referenced_tweets?.some(
    (reference) =>
      reference.type === "quoted" || reference.type === "replied_to"
  );
}

function trackReferenceLimitReached(
  params: Omit<TrackServerEventInput, "event">
) {
  const { properties, ...event } = params;
  trackServerEvent({
    ...event,
    event: POSTHOG_EVENTS.BRAND_REFERENCE_LIMIT_REACHED,
    properties,
  });
  trackServerEvent({
    ...event,
    event: POSTHOG_EVENTS.QUOTA_EXCEEDED,
    properties: { feature: REFERENCE_QUOTA_FEATURE },
  });
}

function serializeBrandVoice(voice: {
  audience: string | null;
  companyDescription: string | null;
  companyName: string | null;
  createdAt: Date;
  customInstructions: string | null;
  customTone: string | null;
  id: string;
  isDefault: boolean;
  language: string | null;
  name: string;
  organizationId: string;
  toneProfile: string | null;
  updatedAt: Date;
  websiteUrl: string | null;
}): BrandVoiceOutput {
  return {
    id: voice.id,
    organizationId: voice.organizationId,
    name: voice.name,
    isDefault: voice.isDefault,
    websiteUrl: voice.websiteUrl,
    companyName: voice.companyName,
    companyDescription: voice.companyDescription,
    toneProfile: voice.toneProfile,
    customTone: voice.customTone,
    customInstructions: voice.customInstructions,
    audience: voice.audience,
    language: voice.language,
    createdAt: voice.createdAt.toISOString(),
    updatedAt: voice.updatedAt.toISOString(),
  };
}

function serializeBrandReference(reference: {
  applicableTo: ("all" | "twitter" | "linkedin" | "blog")[];
  brandSettingsId: string;
  content: string;
  createdAt: Date;
  id: string;
  metadata: unknown;
  note: string | null;
  sourceCapturedAt: Date | null;
  sourceContentHash: string | null;
  sourceSnapshotKey: string | null;
  sourceUrl: string | null;
  type: "custom" | "twitter_post" | "linkedin_post" | "blog_post";
  updatedAt: Date;
}): BrandReferenceOutput {
  return {
    id: reference.id,
    brandSettingsId: reference.brandSettingsId,
    type: reference.type,
    content: reference.content,
    metadata:
      reference.metadata && typeof reference.metadata === "object"
        ? (reference.metadata as Record<string, unknown>)
        : null,
    note: reference.note,
    sourceCapturedAt: reference.sourceCapturedAt?.toISOString() ?? null,
    sourceContentHash: reference.sourceContentHash,
    sourceSnapshotKey: reference.sourceSnapshotKey,
    sourceUrl: reference.sourceUrl,
    applicableTo: reference.applicableTo,
    createdAt: reference.createdAt.toISOString(),
    updatedAt: reference.updatedAt.toISOString(),
  };
}

export const brandRouter = {
  voices: {
    list: baseProcedure
      .input(organizationIdInputSchema)
      .use(withOrganizationAccess)
      .handler(({ input }) => listBrandVoices(input.organizationId)),
    create: baseProcedure
      .input(voiceCreateInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ context, input }) => {
        const { auth } = context;

        const name =
          typeof input.name === "string" && input.name.trim()
            ? input.name.trim()
            : (await getTranslations("brand.defaults"))("untitledIdentity");
        const existingVoice = await db.query.brandSettings.findFirst({
          where: and(
            eq(brandSettings.organizationId, input.organizationId),
            eq(brandSettings.name, name)
          ),
        });

        if (existingVoice) {
          throw await voiceNameTakenError();
        }

        const websiteUrl = await validateWebsiteUrl(input.websiteUrl);

        const hasAnyVoice = await db.query.brandSettings.findFirst({
          where: eq(brandSettings.organizationId, input.organizationId),
          columns: { id: true },
        });

        try {
          const [createdVoice] = await db
            .insert(brandSettings)
            .values({
              id: randomUUID(),
              organizationId: input.organizationId,
              name,
              isDefault: !hasAnyVoice,
              websiteUrl,
            })
            .returning();

          if (!createdVoice) {
            throw internalServerError("Failed to create brand voice");
          }

          trackServerEvent({
            event: POSTHOG_EVENTS.BRAND_IDENTITY_CREATED,
            headers: context.headers,
            userId: auth.user.id,
            organizationId: input.organizationId,
            properties: {
              voice_id: createdVoice.id,
              is_default: createdVoice.isDefault,
              has_website_url: websiteUrl !== null,
              identity_count: await countBrandVoices(input.organizationId),
            },
          });

          return { voice: serializeBrandVoice(createdVoice) };
        } catch (error) {
          if (isPgUniqueViolation(error)) {
            throw await voiceNameTakenError();
          }

          throw internalServerError("Failed to create brand voice", error);
        }
      }),
    update: baseProcedure
      .input(voiceUpdateInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        const voice = await verifyVoiceOwnership(
          input.organizationId,
          input.voiceId
        );

        const normalizedWebsiteUrl =
          input.websiteUrl === undefined ||
          isSameUrl(input.websiteUrl, voice.websiteUrl)
            ? undefined
            : await validateWebsiteUrl(input.websiteUrl);

        try {
          const {
            organizationId: _organizationId,
            voiceId: _voiceId,
            websiteUrl: _websiteUrl,
            ...updates
          } = input;

          await db
            .update(brandSettings)
            .set({
              ...updates,
              ...(normalizedWebsiteUrl !== undefined
                ? { websiteUrl: normalizedWebsiteUrl }
                : {}),
              updatedAt: new Date(),
            })
            .where(eq(brandSettings.id, input.voiceId));

          if (normalizedWebsiteUrl !== undefined) {
            await invalidateGeoIngestHostsCacheForBrand(
              input.organizationId,
              input.voiceId
            );
          }

          return await listBrandVoices(input.organizationId);
        } catch (error) {
          if (isPgUniqueViolation(error)) {
            throw await voiceNameTakenError();
          }

          throw internalServerError("Failed to update brand settings", error);
        }
      }),
    delete: baseProcedure
      .input(voiceInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ context, input }) => {
        const { auth } = context;
        const voice = await verifyVoiceOwnership(
          input.organizationId,
          input.voiceId
        );

        if (voice.isDefault) {
          const tErrors = await getTranslations("errors.brand");
          throw badRequest(tErrors("defaultVoiceDelete"));
        }

        const affectedTriggers = await getTriggersForBrandVoice(
          input.organizationId,
          input.voiceId
        );

        for (const trigger of affectedTriggers) {
          if (trigger.qstashScheduleId) {
            await deleteQstashSchedule(trigger.qstashScheduleId).catch(
              (error) => {
                logError("Failed to delete qstash schedule", error, {
                  scheduleId: trigger.qstashScheduleId,
                });
              }
            );
          }
        }

        await db.transaction(async (tx) => {
          if (affectedTriggers.length > 0) {
            await tx
              .update(contentTriggers)
              .set({
                enabled: false,
                qstashScheduleId: null,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(contentTriggers.organizationId, input.organizationId),
                  inArray(
                    contentTriggers.id,
                    affectedTriggers.map((trigger) => trigger.id)
                  )
                )
              );
          }

          await tx
            .delete(brandSettings)
            .where(
              and(
                eq(brandSettings.id, input.voiceId),
                eq(brandSettings.organizationId, input.organizationId)
              )
            );
        });

        trackServerEvent({
          event: POSTHOG_EVENTS.BRAND_IDENTITY_DELETED,
          headers: context.headers,
          userId: auth.user.id,
          organizationId: input.organizationId,
          properties: {
            voice_id: input.voiceId,
            disabled_trigger_count: affectedTriggers.length,
            identity_count: await countBrandVoices(input.organizationId),
          },
        });

        return {
          success: true,
          disabledSchedules: affectedTriggers
            .filter((trigger) => trigger.sourceType === "cron")
            .map((trigger) => ({ id: trigger.id, name: trigger.name })),
          disabledEvents: affectedTriggers
            .filter((trigger) => trigger.sourceType !== "cron")
            .map((trigger) => ({ id: trigger.id, name: trigger.name })),
        };
      }),
    setDefault: baseProcedure
      .input(setDefaultVoiceInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ context, input }) => {
        const { auth } = context;

        await verifyVoiceOwnership(input.organizationId, input.voiceId);

        await db.transaction(async (tx) => {
          await tx
            .update(brandSettings)
            .set({ isDefault: false, updatedAt: new Date() })
            .where(
              and(
                eq(brandSettings.organizationId, input.organizationId),
                eq(brandSettings.isDefault, true)
              )
            );

          await tx
            .update(brandSettings)
            .set({ isDefault: true, updatedAt: new Date() })
            .where(eq(brandSettings.id, input.voiceId));
        });

        trackServerEvent({
          event: POSTHOG_EVENTS.BRAND_IDENTITY_DEFAULT_SET,
          headers: context.headers,
          userId: auth.user.id,
          organizationId: input.organizationId,
          properties: {
            voice_id: input.voiceId,
            identity_count: await countBrandVoices(input.organizationId),
          },
        });

        return listBrandVoices(input.organizationId);
      }),
    affectedTriggers: baseProcedure
      .input(voiceInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        await verifyVoiceOwnership(input.organizationId, input.voiceId);

        const affectedTriggers = await getTriggersForBrandVoice(
          input.organizationId,
          input.voiceId
        );

        return {
          affectedSchedules: affectedTriggers
            .filter((trigger) => trigger.sourceType === "cron")
            .map((trigger) => ({
              id: trigger.id,
              name: trigger.name,
              enabled: trigger.enabled,
            })),
          affectedEvents: affectedTriggers
            .filter((trigger) => trigger.sourceType !== "cron")
            .map((trigger) => ({
              id: trigger.id,
              name: trigger.name,
              enabled: trigger.enabled,
            })),
        };
      }),
  },
  analysis: {
    getProgress: baseProcedure
      .input(organizationIdInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        const progress = redis
          ? await redis.get<ProgressData>(
              `brand:progress:${input.organizationId}`
            )
          : null;

        return {
          progress:
            progress ??
            ({
              status: "idle",
              currentStep: 0,
              totalSteps: 3,
            } satisfies ProgressData),
        };
      }),
    start: baseProcedure
      .input(analyzeInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ context, input }) => {
        const { auth } = context;

        const url = await validateWebsiteUrl(input.url);
        await startBrandAnalysisRun({
          organizationId: input.organizationId,
          url,
          voiceId: input.voiceId || undefined,
        });

        trackServerEvent({
          event: POSTHOG_EVENTS.BRAND_ANALYSIS_STARTED,
          headers: context.headers,
          userId: auth.user.id,
          organizationId: input.organizationId,
          properties: {
            voice_id: input.voiceId || null,
          },
        });

        return {
          success: true,
          message: "Brand analysis started",
        };
      }),
  },
  guidelines: {
    get: baseProcedure
      .input(voiceInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        await verifyVoiceOwnership(input.organizationId, input.voiceId);

        return getBrandGuidelines(input.voiceId);
      }),
    refresh: baseProcedure
      .input(voiceInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ context, input }) => {
        const { auth } = context;

        const voice = await verifyVoiceOwnership(
          input.organizationId,
          input.voiceId
        );

        if (!voice.websiteUrl) {
          const tErrors = await getTranslations("errors.brand");
          throw badRequest(tErrors("websiteUrlRequired"));
        }

        await startBrandGuidelineGeneration(input.voiceId);

        try {
          await startBrandGuidelinesRun({
            brandSettingsId: input.voiceId,
            organizationId: input.organizationId,
            sourceUrl: voice.websiteUrl,
          });
        } catch (error) {
          await markBrandGuidelinesFailed({
            brandSettingsId: input.voiceId,
            error: "Failed to start guideline generation",
          });
          throw internalServerError(
            "Failed to start guideline generation",
            error
          );
        }

        trackServerEvent({
          event: POSTHOG_EVENTS.BRAND_GUIDELINES_REFRESHED,
          headers: context.headers,
          userId: auth.user.id,
          organizationId: input.organizationId,
          properties: {
            voice_id: input.voiceId,
          },
        });

        return getBrandGuidelines(input.voiceId);
      }),
    updateColor: baseProcedure
      .input(voiceInputSchema.and(updateGuidelineColorSchema))
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        const guidelineId = await getEditableGuidelineId(
          input.organizationId,
          input.voiceId
        );

        const updated = await db
          .update(brandGuidelineColors)
          .set({
            role: input.role,
            name: input.name,
            lightValue: input.lightValue,
            darkValue: input.darkValue,
            usage: input.usage,
          })
          .where(
            and(
              eq(brandGuidelineColors.id, input.colorId),
              eq(brandGuidelineColors.guidelineId, guidelineId)
            )
          )
          .returning({ id: brandGuidelineColors.id });

        if (updated.length === 0) {
          throw notFound("Color not found");
        }

        return getBrandGuidelines(input.voiceId);
      }),
    updateFont: baseProcedure
      .input(voiceInputSchema.and(updateGuidelineFontSchema))
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        const guidelineId = await getEditableGuidelineId(
          input.organizationId,
          input.voiceId
        );

        const updated = await db
          .update(brandGuidelineFonts)
          .set({
            role: input.role,
            family: input.family,
            weight: input.weight,
            size: input.size,
            lineHeight: input.lineHeight,
          })
          .where(
            and(
              eq(brandGuidelineFonts.id, input.fontId),
              eq(brandGuidelineFonts.guidelineId, guidelineId)
            )
          )
          .returning({ id: brandGuidelineFonts.id });

        if (updated.length === 0) {
          throw notFound("Font not found");
        }

        return getBrandGuidelines(input.voiceId);
      }),
    updateToken: baseProcedure
      .input(voiceInputSchema.and(updateGuidelineTokenSchema))
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        const guidelineId = await getEditableGuidelineId(
          input.organizationId,
          input.voiceId
        );

        const updated = await db
          .update(brandGuidelineTokens)
          .set({
            type: input.type,
            name: input.name,
            value: input.value,
          })
          .where(
            and(
              eq(brandGuidelineTokens.id, input.tokenId),
              eq(brandGuidelineTokens.guidelineId, guidelineId)
            )
          )
          .returning({ id: brandGuidelineTokens.id });

        if (updated.length === 0) {
          throw notFound("Token not found");
        }

        return getBrandGuidelines(input.voiceId);
      }),
    updateAsset: baseProcedure
      .input(voiceInputSchema.and(updateGuidelineAssetSchema))
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        const guidelineId = await getEditableGuidelineId(
          input.organizationId,
          input.voiceId
        );

        const updated = await db
          .update(brandGuidelineAssets)
          .set({
            kind: input.kind,
            variant: input.variant,
            ...(input.url
              ? {
                  aspectRatio: input.aspectRatio ?? null,
                  format: input.format ?? null,
                  height: input.height ?? null,
                  mimeType: input.mimeType ?? null,
                  storageKey: input.storageKey ?? null,
                  url: input.url,
                  width: input.width ?? null,
                }
              : {}),
          })
          .where(
            and(
              eq(brandGuidelineAssets.id, input.assetId),
              eq(brandGuidelineAssets.guidelineId, guidelineId)
            )
          )
          .returning({ id: brandGuidelineAssets.id });

        if (updated.length === 0) {
          throw notFound("Asset not found");
        }

        return getBrandGuidelines(input.voiceId);
      }),
    updateScreenshot: baseProcedure
      .input(voiceInputSchema.and(updateGuidelineScreenshotSchema))
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        const guidelineId = await getEditableGuidelineId(
          input.organizationId,
          input.voiceId
        );

        try {
          const updated = await db
            .update(brandGuidelineScreenshots)
            .set({
              kind: input.kind,
              fullPage: input.fullPage,
            })
            .where(
              and(
                eq(brandGuidelineScreenshots.id, input.screenshotId),
                eq(brandGuidelineScreenshots.guidelineId, guidelineId)
              )
            )
            .returning({ id: brandGuidelineScreenshots.id });

          if (updated.length === 0) {
            throw notFound("Screenshot not found");
          }

          return await getBrandGuidelines(input.voiceId);
        } catch (error) {
          if (isPgUniqueViolation(error)) {
            const tErrors = await getTranslations("errors.brand");
            throw conflict(tErrors("screenshotTypeTaken"));
          }
          throw error;
        }
      }),
    createColor: baseProcedure
      .input(voiceInputSchema.and(createGuidelineColorSchema))
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        const guidelineId = await getEditableGuidelineId(
          input.organizationId,
          input.voiceId
        );

        const sortOrderRows = await db
          .select({
            value: sql<number>`coalesce(max(${brandGuidelineColors.sortOrder}), -1)`,
          })
          .from(brandGuidelineColors)
          .where(eq(brandGuidelineColors.guidelineId, guidelineId));

        await db.insert(brandGuidelineColors).values({
          id: randomUUID(),
          guidelineId,
          role: input.role,
          name: input.name ?? null,
          lightValue: input.lightValue,
          darkValue: input.darkValue ?? null,
          usage: input.usage ?? null,
          sortOrder: (sortOrderRows[0]?.value ?? -1) + 1,
        });

        return getBrandGuidelines(input.voiceId);
      }),
    deleteColor: baseProcedure
      .input(
        voiceInputSchema.and(updateGuidelineColorSchema.pick({ colorId: true }))
      )
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        const guidelineId = await getEditableGuidelineId(
          input.organizationId,
          input.voiceId
        );

        const deleted = await db
          .delete(brandGuidelineColors)
          .where(
            and(
              eq(brandGuidelineColors.id, input.colorId),
              eq(brandGuidelineColors.guidelineId, guidelineId)
            )
          )
          .returning({ id: brandGuidelineColors.id });

        if (deleted.length === 0) {
          throw notFound("Color not found");
        }

        return getBrandGuidelines(input.voiceId);
      }),
    createAsset: baseProcedure
      .input(voiceInputSchema.and(createGuidelineAssetSchema))
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        const guidelineId = await getEditableGuidelineId(
          input.organizationId,
          input.voiceId
        );

        const sortOrderRows = await db
          .select({
            value: sql<number>`coalesce(max(${brandGuidelineAssets.sortOrder}), -1)`,
          })
          .from(brandGuidelineAssets)
          .where(eq(brandGuidelineAssets.guidelineId, guidelineId));

        await db.insert(brandGuidelineAssets).values({
          id: randomUUID(),
          guidelineId,
          kind: input.kind,
          variant: input.variant,
          url: input.url,
          storageKey: input.storageKey ?? null,
          format: input.format ?? null,
          mimeType: input.mimeType ?? null,
          width: input.width ?? null,
          height: input.height ?? null,
          aspectRatio: input.aspectRatio ?? null,
          sortOrder: (sortOrderRows[0]?.value ?? -1) + 1,
        });

        return getBrandGuidelines(input.voiceId);
      }),
    attachSourcePdf: baseProcedure
      .input(voiceInputSchema.and(attachGuidelineSourcePdfSchema))
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        await verifyVoiceOwnership(input.organizationId, input.voiceId);

        try {
          return await attachBrandGuidelineSourcePdf({
            brandSettingsId: input.voiceId,
            filename: input.filename,
            key: input.key,
            organizationId: input.organizationId,
          });
        } catch (error) {
          if (error instanceof BrandGuidelineSourcePdfValidationError) {
            throw badRequest(error.message);
          }
          if (error instanceof ORPCError) {
            throw error;
          }
          throw internalServerError(
            "Failed to attach the brand guideline PDF",
            error
          );
        }
      }),
    removeSourcePdf: baseProcedure
      .input(voiceInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        await verifyVoiceOwnership(input.organizationId, input.voiceId);
        return removeBrandGuidelineSourcePdf(input.voiceId);
      }),
  },
  sitemaps: brandSitemapsRouter,
  references: {
    list: baseProcedure
      .input(voiceInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        await verifyVoiceOwnership(input.organizationId, input.voiceId);

        const references = await db.query.brandReferences.findMany({
          where: eq(brandReferences.brandSettingsId, input.voiceId),
          orderBy: [desc(brandReferences.createdAt)],
        });

        return { references: references.map(serializeBrandReference) };
      }),
    create: baseProcedure
      .input(voiceInputSchema.and(createReferenceSchema))
      .use(withOrganizationAccess)
      .handler(async ({ context, input }) => {
        const { auth } = context;
        await assertActiveSubscription(input.organizationId);

        await verifyVoiceOwnership(input.organizationId, input.voiceId);

        const chargesReferenceQuota = Boolean(
          autumn && !allowUnmeteredAiInDevelopment
        );
        const metadata = withReferenceBillingFlag(input.metadata, {
          metered: chargesReferenceQuota,
        });
        const tweetId = (metadata as Record<string, unknown> | null)?.tweetId;
        const metadataUrl = (metadata as Record<string, unknown> | null)?.url;
        const parsedMetadataUrl =
          typeof metadataUrl === "string"
            ? referenceSourceUrlSchema.safeParse(metadataUrl)
            : null;
        const sourceUrl =
          input.sourceUrl ??
          (parsedMetadataUrl?.success ? parsedMetadataUrl.data : null);
        let referenceSource: BrandReferenceSource =
          BRAND_REFERENCE_SOURCES.MANUAL;
        if (tweetId) {
          referenceSource = BRAND_REFERENCE_SOURCES.TWEET;
        } else if (sourceUrl) {
          referenceSource = BRAND_REFERENCE_SOURCES.URL;
        }

        if (tweetId) {
          const existing = await db.query.brandReferences.findFirst({
            where: and(
              eq(brandReferences.brandSettingsId, input.voiceId),
              sql`${brandReferences.metadata}->>'tweetId' = ${String(tweetId)}`
            ),
            columns: { id: true },
          });

          if (existing) {
            const tErrors = await getTranslations("errors.brand");
            throw conflict(tErrors("tweetAlreadyAdded"));
          }
        }

        const applicableTo: ApplicablePlatform[] = input.applicableTo ??
          typeDefaults[input.type] ?? ["all"];

        if (autumn && chargesReferenceQuota) {
          const data = await autumn
            .check({
              customerId: input.organizationId,
              featureId: FEATURES.REFERENCES,
              requiredBalance: 1,
              sendEvent: true,
            })
            .catch(() => null);

          if (!data?.allowed) {
            trackReferenceLimitReached({
              headers: context.headers,
              userId: auth.user.id,
              organizationId: input.organizationId,
              properties: {
                voice_id: input.voiceId,
                source: referenceSource,
                type: input.type,
              },
            });
            const tErrors = await getTranslations("errors.brand");
            throw forbidden(tErrors("referenceLimitAdd"), {
              code: REFERENCE_LIMIT_REACHED_CODE,
            });
          }
        }

        const [reference] = await db
          .insert(brandReferences)
          .values({
            id: randomUUID(),
            brandSettingsId: input.voiceId,
            type: input.type,
            content: input.content,
            metadata,
            note: input.note ?? null,
            sourceCapturedAt: sourceUrl ? new Date() : null,
            sourceUrl,
            applicableTo,
          })
          .returning();

        if (!reference) {
          throw internalServerError("Reference was not created");
        }

        trackServerEvent({
          event: POSTHOG_EVENTS.BRAND_REFERENCE_ADDED,
          headers: context.headers,
          userId: auth.user.id,
          organizationId: input.organizationId,
          properties: {
            voice_id: input.voiceId,
            reference_id: reference.id,
            source: referenceSource,
            type: input.type,
            count: 1,
          },
        });

        return { reference: serializeBrandReference(reference) };
      }),
    update: baseProcedure
      .input(referenceInputSchema.and(updateReferenceSchema))
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        await assertActiveSubscription(input.organizationId);

        await verifyVoiceOwnership(input.organizationId, input.voiceId);

        const existing = await getReferenceById(
          input.referenceId,
          input.voiceId
        );

        if (!existing) {
          throw notFound("Reference not found");
        }

        const sourceUrlChanged =
          input.sourceUrl !== undefined &&
          input.sourceUrl !== existing.sourceUrl;

        const [reference] = await db
          .update(brandReferences)
          .set({
            note: input.note,
            content: input.content,
            sourceCapturedAt: sourceUrlChanged ? null : undefined,
            sourceContentHash: sourceUrlChanged ? null : undefined,
            sourceSnapshotKey: sourceUrlChanged ? null : undefined,
            sourceUrl: input.sourceUrl,
            applicableTo: input.applicableTo,
            updatedAt: new Date(),
          })
          .where(eq(brandReferences.id, input.referenceId))
          .returning();

        if (!reference) {
          throw internalServerError("Reference update failed");
        }

        return { reference: serializeBrandReference(reference) };
      }),
    delete: baseProcedure
      .input(referenceInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        await verifyVoiceOwnership(input.organizationId, input.voiceId);

        const existing = await getReferenceById(
          input.referenceId,
          input.voiceId
        );

        if (!existing) {
          throw notFound("Reference not found");
        }

        await db
          .delete(brandReferences)
          .where(eq(brandReferences.id, input.referenceId));

        if (autumn && !isUnmeteredReference(existing.metadata)) {
          await autumn.track({
            customerId: input.organizationId,
            featureId: FEATURES.REFERENCES,
            value: -1,
          });
        }

        return { success: true };
      }),
    importTweets: baseProcedure
      .input(voiceInputSchema.and(importTweetsSchema))
      .use(withOrganizationAccess)
      .handler(async ({ context, input }) => {
        const { auth } = context;
        const { success: withinLimit } = await ratelimit.importTweets.limit(
          input.organizationId
        );

        if (!withinLimit) {
          const tErrors = await getTranslations("errors.brand");
          throw tooManyRequests(tErrors("tooManyImportRequests"));
        }

        await verifyVoiceOwnership(input.organizationId, input.voiceId);

        const { maxResults } = input;

        const socialAccount = await db.query.connectedSocialAccounts.findFirst({
          where: and(
            eq(connectedSocialAccounts.id, input.accountId),
            eq(connectedSocialAccounts.organizationId, input.organizationId),
            eq(connectedSocialAccounts.provider, "twitter")
          ),
        });

        if (!socialAccount) {
          throw notFound("Connected X account not found");
        }

        const profileLookup = await Effect.runPromise(
          fetchTwitterUserWithPinnedTweet(socialAccount.username)
        );

        if (!profileLookup) {
          const tErrors = await getTranslations("errors.brand");
          throw badRequest(tErrors("fetchXProfileFailed"));
        }

        const { userId: twitterUserId, pinnedTweet } = profileLookup;

        const originalTweets: TwitterTweet[] = [];
        let author: TwitterUser | undefined;
        let paginationToken: string | undefined;
        const maxPages = 5;

        for (let page = 0; page < maxPages; page += 1) {
          const remaining = maxResults - originalTweets.length;
          const perPage = Math.min(20, Math.max(5, remaining));

          const tweetParams = new URLSearchParams({
            max_results: String(perPage),
            exclude: "replies,retweets",
            "tweet.fields":
              "text,created_at,public_metrics,author_id,referenced_tweets",
            "user.fields": "username,name,profile_image_url",
            expansions: "author_id",
          });

          if (paginationToken) {
            tweetParams.set("pagination_token", paginationToken);
          }

          const tweetsResponse = await twitterAppFetch(
            `https://api.x.com/2/users/${twitterUserId}/tweets?${tweetParams.toString()}`
          );

          if (!tweetsResponse.ok) {
            if (page === 0) {
              const errorBody = await tweetsResponse.json().catch(() => ({}));
              const message =
                (errorBody as Record<string, string>)?.detail ||
                (errorBody as Record<string, string>)?.title ||
                "Failed to fetch tweets from X";

              throw badRequest(message);
            }

            break;
          }

          const timeline: TwitterTimelineResponse = await tweetsResponse.json();

          if (!author && timeline.includes?.users) {
            author =
              timeline.includes.users.find(
                (user) => user.id === twitterUserId
              ) ?? timeline.includes.users[0];
          }

          for (const tweet of (timeline.data ?? []).filter(isOriginalTweet)) {
            originalTweets.push(tweet);

            if (originalTweets.length >= maxResults) {
              break;
            }
          }

          if (
            originalTweets.length >= maxResults ||
            !timeline.meta?.next_token
          ) {
            break;
          }

          paginationToken = timeline.meta.next_token;
        }

        let tweets = originalTweets;
        if (pinnedTweet && isOriginalTweet(pinnedTweet)) {
          tweets = tweets.filter((tweet) => tweet.id !== pinnedTweet.id);
          tweets.unshift(pinnedTweet);
        }

        tweets = tweets.slice(0, maxResults);

        if (tweets.length === 0) {
          return { count: 0, references: [] };
        }

        const authorHandle = author?.username ?? socialAccount.username;
        const authorName = author?.name ?? socialAccount.displayName;
        const profileImageUrl = author?.profile_image_url
          ? normalizeTwitterProfileImageUrl(author.profile_image_url)
          : socialAccount.profileImageUrl;
        const incomingIds = tweets.map((tweet) => tweet.id);

        const existingRefs = await db.query.brandReferences.findMany({
          where: and(
            eq(brandReferences.brandSettingsId, input.voiceId),
            sql`${brandReferences.metadata}->>'tweetId' = ANY(ARRAY[${sql.join(
              incomingIds.map((id) => sql`${id}`),
              sql`, `
            )}]::text[])`
          ),
          columns: { metadata: true },
        });

        const existingTweetIds = new Set(
          existingRefs
            .map(
              (reference) =>
                (reference.metadata as Record<string, unknown> | null)?.tweetId
            )
            .filter(Boolean)
        );

        let newTweets = tweets.filter(
          (tweet) => !existingTweetIds.has(tweet.id)
        );

        if (newTweets.length === 0) {
          return { count: 0, references: [] };
        }

        const importedTweetCountRows = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(brandReferences)
          .innerJoin(
            brandSettings,
            eq(brandSettings.id, brandReferences.brandSettingsId)
          )
          .where(
            and(
              eq(brandSettings.organizationId, input.organizationId),
              eq(brandReferences.type, "twitter_post"),
              sql`${brandReferences.metadata}->>'tweetId' IS NOT NULL`
            )
          );
        const existingImportedTweetCount =
          importedTweetCountRows[0]?.count ?? 0;

        const freeImportsRemaining = Math.max(
          0,
          FREE_IMPORTED_TWEET_REFERENCE_LIMIT - existingImportedTweetCount
        );
        const freeImportCount = Math.min(
          newTweets.length,
          freeImportsRemaining
        );
        const tweetsRequiringEntitlement = newTweets.length - freeImportCount;
        let paidImportCount = 0;

        if (tweetsRequiringEntitlement > 0) {
          if (autumn) {
            const data = await autumn
              .check({
                customerId: input.organizationId,
                featureId: FEATURES.REFERENCES,
                requiredBalance: 1,
              })
              .catch(() => null);

            if (data?.allowed) {
              if (data.balance?.unlimited) {
                paidImportCount = tweetsRequiringEntitlement;
              } else if (typeof data.balance?.remaining === "number") {
                paidImportCount = Math.min(
                  tweetsRequiringEntitlement,
                  data.balance.remaining
                );
              }
            }
          }

          if (freeImportCount === 0 && paidImportCount === 0) {
            trackReferenceLimitReached({
              headers: context.headers,
              userId: auth.user.id,
              organizationId: input.organizationId,
              properties: {
                voice_id: input.voiceId,
                source: BRAND_REFERENCE_SOURCES.TWEET,
                requested_count: newTweets.length,
              },
            });
            const tErrors = await getTranslations("errors.brand");
            throw forbidden(tErrors("referenceLimitImport"), {
              code: REFERENCE_LIMIT_REACHED_CODE,
            });
          }
        }

        newTweets = newTweets.slice(0, freeImportCount + paidImportCount);

        const values = newTweets.map((tweet, index) => ({
          id: randomUUID(),
          brandSettingsId: input.voiceId,
          type: "twitter_post" as const,
          content: tweet.text,
          metadata: withReferenceBillingFlag(
            {
              tweetId: tweet.id,
              authorHandle,
              authorName,
              url: `https://x.com/${authorHandle}/status/${tweet.id}`,
              likes: tweet.public_metrics?.like_count ?? 0,
              retweets: tweet.public_metrics?.retweet_count ?? 0,
              replies: tweet.public_metrics?.reply_count ?? 0,
              profileImageUrl,
              createdAt: tweet.created_at ?? new Date().toISOString(),
            },
            { metered: Boolean(autumn) && index >= freeImportCount }
          ),
          note: null,
          sourceCapturedAt: new Date(),
          sourceUrl: `https://x.com/${authorHandle}/status/${tweet.id}`,
          applicableTo: ["twitter"] as ApplicablePlatform[],
        }));

        const inserted = await db
          .insert(brandReferences)
          .values(values)
          .returning();

        const billableCount = inserted.filter(
          (reference) => !isUnmeteredReference(reference.metadata)
        ).length;

        if (autumn && billableCount > 0) {
          await autumn.track({
            customerId: input.organizationId,
            featureId: FEATURES.REFERENCES,
            value: billableCount,
          });
        }

        trackServerEvent({
          event: POSTHOG_EVENTS.BRAND_REFERENCE_IMPORT_TWEETS,
          headers: context.headers,
          userId: auth.user.id,
          organizationId: input.organizationId,
          properties: {
            voice_id: input.voiceId,
            account_id: input.accountId,
            source: BRAND_REFERENCE_SOURCES.TWEET,
            count: inserted.length,
            free_count: freeImportCount,
            billable_count: billableCount,
            max_results: maxResults,
          },
        });

        return {
          count: inserted.length,
          references: inserted.map(serializeBrandReference),
        };
      }),
    fetchTweet: baseProcedure
      .input(voiceInputSchema.and(fetchTweetSchema))
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        const { success: withinLimit } = await ratelimit.fetchTweet.limit(
          input.organizationId
        );

        if (!withinLimit) {
          const tErrors = await getTranslations("errors.brand");
          throw tooManyRequests(tErrors("tooManyRequests"));
        }

        await verifyVoiceOwnership(input.organizationId, input.voiceId);

        try {
          return await fetchTweet(input.url);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Failed to fetch tweet";

          throw badRequest(message);
        }
      }),
  },
};
