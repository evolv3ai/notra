import {
  beginGscIntegrationDisconnect,
  claimOrConfirmGscSchedule,
  deleteGscIntegration,
  GscReauthRequiredError,
  getGscIntegration,
  getGscOAuthCredentials,
  listGscSites,
  revokeGscToken,
} from "@notra/ai/integrations/google-search-console";
import {
  createQstashRouteSchedule,
  deleteQstashSchedule,
} from "@notra/ai/qstash/triggers";
import type { GscIntegrationRow } from "@notra/ai/types/google-search-console";
import {
  GscIntegrationLockBusyError,
  GscIntegrationLockLostError,
  withGscIntegrationLock,
} from "@notra/ai/utils/gsc-integration-lock";
import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { geoAgentReadinessReports, projects } from "@notra/db/schema";
import { GEO_SAMPLE_DATA_ENABLED } from "@notra/geo-core/constants/geo";
import {
  GSC_SCHEDULE_ID_PREFIX,
  GSC_SYNC_CRON,
  GSC_SYNC_WORKFLOW_PATH,
} from "@notra/geo-core/constants/google-search-console";
import {
  loadAgentReadiness,
  startAgentReadinessScan,
} from "@notra/geo-core/geo/agent-readiness";
import {
  createGeoProjectFromWebsite,
  discoverGeoWebsite,
  generateGeoFromWebsite,
} from "@notra/geo-core/geo/discover";
import type { GeoRouterError } from "@notra/geo-core/geo/errors";
import {
  loadGeoContentGaps,
  refreshGeoContentGapsBestEffort,
  setGeoPromptGapIgnored,
} from "@notra/geo-core/geo/gaps";
import {
  issueGeoIngestSetupResponse,
  rotateGeoIngestSetupResponse,
} from "@notra/geo-core/geo/ingest";
import {
  loadMcpAnalytics,
  loadMcpSession,
  loadMcpToolDetail,
} from "@notra/geo-core/geo/mcp-analytics";
import { loadGeoModelCatalog } from "@notra/geo-core/geo/model-catalog";
import {
  saveGeoOnboardingBrand,
  searchGeoBrands,
  suggestGeoCompetitors,
} from "@notra/geo-core/geo/onboarding";
import { runGeoPersonaNow } from "@notra/geo-core/geo/persona-scan";
import {
  deleteGeoPersona,
  listGeoPersonas,
  loadGeoPersonaResults,
  loadGeoPersonaActivity,
  requireGeoPersonaGenerationCapacity,
  restoreGeoPersona,
  updateGeoPersona,
} from "@notra/geo-core/geo/personas";
import {
  addGeoTrackedEngine,
  addGeoTrackedLanguage,
  createGeoPrompt,
  deleteGeoCompetitor,
  fillGeoCompetitorDomains,
  setGeoCompetitorIgnored,
  deleteGeoPrompt,
  importGeoCompetitors,
  importGeoPrompts,
  listGeoPrompts,
  loadAiTraffic,
  loadAiTrafficSources,
  loadGeoChanges,
  loadGeoCompetitorDetail,
  loadGeoCompetitorEngineMatrix,
  loadGeoCompetitorShare,
  loadGeoCompetitors,
  loadGeoJourneyDetail,
  loadGeoLanguageShare,
  loadGeoOverview,
  loadGeoPromptHistory,
  loadGeoSettings,
  loadGeoTimeseries,
  loadGeoJourneyStats,
  loadGeoTrafficJourneys,
  loadGeoTrafficLog,
  loadGeoTrafficPages,
  startGeoPromptRescan,
  loadGeoScanStatus,
  startGeoScan,
  toggleGeoAutoPrompt,
  toggleGeoPrompt,
  updateGeoPrompt,
  upsertGeoCompetitor,
  upsertGeoSettings,
} from "@notra/geo-core/geo/programs";
import {
  deleteGeoProject,
  listGeoProjects,
  requireBrandIdentity,
  requireGeoProject,
  resolveGeoScope,
  updateGeoProject,
} from "@notra/geo-core/geo/projects";
import {
  loadGeoPromptResultDetail,
  loadGeoPromptResultSummaries,
} from "@notra/geo-core/geo/prompt-results";
import {
  listGeoPromptTranslations,
  resetGeoPromptTranslation,
  selectGeoPromptTranslation,
  translateGeoPromptTranslations,
  updateGeoPromptTranslation,
} from "@notra/geo-core/geo/prompt-translations";
import {
  clearGeoSampleData,
  seedGeoSampleData,
} from "@notra/geo-core/geo/sample-data";
import { runGeoSequenceNow } from "@notra/geo-core/geo/scan";
import {
  loadGeoScanRun,
  loadGeoScanRuns,
} from "@notra/geo-core/geo/scan-history";
import {
  selectGscSiteAndSyncSuggestions,
  syncGscSuggestions,
} from "@notra/geo-core/geo/search-console";
import {
  loadGeoSentiment,
  loadGeoSentimentEvidence,
} from "@notra/geo-core/geo/sentiment";
import { loadGeoSentimentAnalysis } from "@notra/geo-core/geo/sentiment-analysis";
import { generateGeoSequences } from "@notra/geo-core/geo/sequence-generation";
import {
  createGeoSequence,
  deleteGeoSequence,
  listGeoSequences,
  loadGeoSequenceResults,
  updateGeoSequence,
} from "@notra/geo-core/geo/sequences";
import {
  acceptSuggestion,
  acceptAllSuggestions,
  dismissSuggestion,
  listAutopilotPromptSuggestions,
  listSuggestions,
} from "@notra/geo-core/geo/suggestions";
import { loadWebAnalytics } from "@notra/geo-core/geo/web-analytics";
import { geoWindow } from "@notra/geo-core/geo/window";
import {
  approveAndStartGeoWriter,
  getGeoContentBrief,
  listGeoContentBriefs,
  planGeoContentBrief,
  updateGeoContentBrief,
} from "@notra/geo-core/geo/writer";
import {
  AgentReadinessApiError,
  AgentReadinessTargetMissingError,
} from "@notra/geo-core/schemas/agent-readiness-errors";
import {
  aiTrafficInputSchema,
  geoBrandSearchInputSchema,
  geoCompetitorDeleteInputSchema,
  geoCompetitorDomainFillInputSchema,
  geoCompetitorIgnoreInputSchema,
  geoCompetitorShareInputSchema,
  geoCompetitorsImportInputSchema,
  geoCompetitorDetailInputSchema,
  geoCompetitorSuggestionsInputSchema,
  geoCompetitorUpsertInputSchema,
  geoDiscoverWebsiteInputSchema,
  geoGenerateFromWebsiteInputSchema,
  geoJourneyDetailInputSchema,
  geoModelCatalogInputSchema,
  geoOnboardingBrandInputSchema,
  geoPromptTranslationSelectInputSchema,
  geoPromptTranslationTargetInputSchema,
  geoPromptTranslationUpdateInputSchema,
  geoProjectCreateInputSchema,
  geoProjectDeleteInputSchema,
  geoProjectUpdateInputSchema,
  geoPromptCreateInputSchema,
  geoPromptHistoryInputSchema,
  geoPromptResultDetailInputSchema,
  geoPromptRescanInputSchema,
  geoPromptGapIgnoreInputSchema,
  geoScanStatusInputSchema,
  geoPromptsImportInputSchema,
  geoPromptDeleteInputSchema,
  geoPromptToggleInputSchema,
  geoPromptUpdateInputSchema,
  geoAutoPromptToggleInputSchema,
  geoSequenceCreateInputSchema,
  geoSequenceDeleteInputSchema,
  geoSequenceResultsInputSchema,
  geoSequenceRunInputSchema,
  geoSequenceUpdateInputSchema,
  geoSettingsEngineAddInputSchema,
  geoSettingsLanguageAddInputSchema,
  geoSettingsUpsertInputSchema,
  geoSuggestionIdInputSchema,
  geoTimeseriesInputSchema,
  geoJourneyStatsInputSchema,
  geoTrafficJourneysInputSchema,
  geoTrafficLogInputSchema,
  geoTrafficPagesInputSchema,
  webAnalyticsInputSchema,
  mcpAnalyticsInputSchema,
  mcpSessionInputSchema,
  mcpToolDetailInputSchema,
  geoWriterBriefIdInputSchema,
  geoWriterPlanInputSchema,
  geoWriterUpdateInputSchema,
} from "@notra/geo-core/schemas/geo";
import {
  geoPersonaDeleteInputSchema,
  geoPersonaResultsInputSchema,
  geoPersonaRestoreInputSchema,
  geoPersonaRunInputSchema,
  geoPersonaUpdateInputSchema,
  geoPersonasGenerateInputSchema,
} from "@notra/geo-core/schemas/geo-personas";
import {
  geoScanRunInputSchema,
  geoScanRunsInputSchema,
} from "@notra/geo-core/schemas/geo-scan-history";
import { geoOrganizationInputSchema } from "@notra/geo-core/schemas/geo-scope";
import { geoSentimentEvidenceInputSchema } from "@notra/geo-core/schemas/geo-sentiment";
import { gscSelectSiteInputSchema } from "@notra/geo-core/schemas/google-search-console";
import { GeoSearchConsoleError } from "@notra/geo-core/schemas/search-console-errors";
import { sentimentPeriodInputSchema } from "@notra/geo-core/schemas/sentiment-analysis";
import type {
  AgentReadinessResponse,
  AgentReadinessScanResponse,
} from "@notra/geo-core/types/agent-readiness";
import type {
  GeoIngestSetupResponse,
  GeoTrackedPrompt,
} from "@notra/geo-core/types/geo";
import type {
  GeoSearchConsoleStatus,
  GscKeywordsResponse,
  GscSitesResponse,
  GscSyncResult,
} from "@notra/geo-core/types/google-search-console";
import { webHostFilter } from "@notra/geo-core/utils/geo-project-domains";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { geoScanStartInputSchema } from "@notra/schemas/dashboard/geo-analytics";
import {
  geoShelfCreateInputSchema,
  geoShelfListInputSchema,
  geoShelfListResponseSchema,
  geoShelfMembersInputSchema,
  geoShelfMembersResponseSchema,
  geoShelfMutationResponseSchema,
  geoShelfPreviewInputSchema,
  geoShelfPreviewResponseSchema,
  geoShelfUpdateInputSchema,
  geoShelfUrlCheckResponseSchema,
} from "@notra/schemas/dashboard/geo-shelf";
import { QstashError } from "@upstash/qstash";
import { and, eq } from "drizzle-orm";
import { Effect } from "effect";

import {
  GEO_COMPETITOR_SOURCES,
  GEO_DEFAULT_SCAN_TRIGGER,
  GEO_PROMPT_SOURCES,
  GEO_SEQUENCE_RUN_OUTCOMES,
} from "@/constants/geo-analytics";
import {
  GEO_SHELF_EMPTY_BOARD_COUNTS,
  GEO_SHELF_PREVIEW_CACHE_MS,
  GEO_SHELF_PREVIEW_OUTCOMES,
  GEO_SHELF_PREVIEW_RATE_LIMIT_CODE,
  GEO_SHELF_PREVIEW_RATE_LIMIT_SCOPE,
} from "@/constants/geo-shelf";
import {
  countGeoProjects,
  loadGeoScanStartSnapshot,
  summarizeSuggestionKeywords,
  trackGeoRouterEvent,
} from "@/lib/analytics/geo-server-events";
import { identifyProjectGroup } from "@/lib/analytics/posthog-server";
import { assertOrganizationAccess } from "@/lib/auth/organization";
import { isAutopilotEnabledForOrganization } from "@/lib/autopilot/flag";
import {
  assertActiveSubscription,
  assertGeoEntitlement,
  resolveGeoEntitlement,
} from "@/lib/billing/subscription";
import { afterResponse } from "@/lib/framework/after-response";
import {
  collectGeoShelfMemberIds,
  findCurrentGeoShelfMemberId,
  listGeoShelfMembers,
  referencesGeoShelfMembers,
  sanitizeGeoShelfSourceMembers,
} from "@/lib/geo-shelf/members";
import { previewGeoShelfUrl } from "@/lib/geo-shelf/preview";
import {
  createGeoShelfSource,
  scheduleGeoShelfCitationSync,
  updateGeoShelfSource,
} from "@/lib/geo-shelf/request-service";
import {
  isGeoShelfUrlOnShelf,
  listGeoShelfSourcePage,
  loadGeoShelfContext,
  resolveGeoShelfSearch,
} from "@/lib/geo-shelf/service";
import { assertGeoAccess } from "@/lib/geo/access";
import { hasGeoData } from "@/lib/geo/access-level.server";
import { geoCoreDashboardLayer } from "@/lib/geo/configure";
import { startFreeGeoScan } from "@/lib/geo/free-scan";
import {
  getPersonaGeneration,
  startPersonaGeneration,
} from "@/lib/geo/persona-generation";
import { getTranslations } from "@/lib/i18n/server";
import { authorizedProcedure } from "@/lib/orpc/base";
import { runOrpcEffect } from "@/lib/orpc/effect";
import {
  assertNotDemo,
  badRequest,
  notFound,
  serviceUnavailable,
  tooManyRequests,
} from "@/lib/orpc/utils/errors";
import { toGeoOrpcError } from "@/lib/orpc/utils/geo-errors";
import type { GeoHandlerTracker } from "@/types/analytics/geo-events";
import type { AuthenticatedUser } from "@/types/auth/organization";
import type {
  GeoBrandSearchHandlerInput,
  GeoCompetitorSuggestionsHandlerInput,
  GeoProjectCreateHandlerInput,
  GeoPromptSuggestionsResponse,
} from "@/types/geo";
import type { GeoDashboardRuntime } from "@/types/geo-runtime";
import type { GeoShelfMember, GeoShelfSource } from "@/types/geo-shelf";
import { ratelimit } from "@/utils/ratelimit";

interface GeoHandlerOptions<TInput> {
  context: { headers: Headers; user?: AuthenticatedUser };
  input: TInput;
}

function accessParams({
  context,
  input,
}: GeoHandlerOptions<{ organizationId: string }>) {
  return {
    headers: context.headers,
    organizationId: input.organizationId,
    user: context.user,
  };
}

function createGeoHandler(
  assertAccess: (params: ReturnType<typeof accessParams>) => Promise<unknown>
) {
  return <
    TInput extends { organizationId: string },
    TOutput,
    TError extends GeoRouterError,
  >(
    run: (input: TInput) => Effect.Effect<TOutput, TError, GeoDashboardRuntime>,
    track?: GeoHandlerTracker<TInput, TOutput>
  ) =>
    async ({ context, input }: GeoHandlerOptions<TInput>): Promise<TOutput> => {
      await assertAccess(accessParams({ context, input }));

      const output = await runOrpcEffect(
        run(input).pipe(Effect.provide(geoCoreDashboardLayer)),
        toGeoOrpcError
      );
      await track?.({ context, input, output });
      return output;
    };
}

/** Membership only: reads stay open without a GEO plan, writes do not. */
const geoOpenHandler = createGeoHandler(assertOrganizationAccess);
const geoHandler = createGeoHandler(assertGeoAccess);

async function toGscErrorMessage(
  error: unknown,
  fallback: "sync" | "properties"
): Promise<string> {
  const tToasts = await getTranslations("geo.toasts");
  const fallbackMessage =
    fallback === "sync"
      ? tToasts("syncSearchConsoleFailed")
      : tToasts("loadSearchConsolePropertiesFailed");
  const reauthRequired =
    error instanceof GscReauthRequiredError ||
    (error instanceof GeoSearchConsoleError && error.reauthRequired);
  if (reauthRequired) {
    const tGscPage = await getTranslations("integrations.gscPage");
    return tGscPage("accessExpired");
  }
  if (error instanceof GeoSearchConsoleError && error.status === 403) {
    const tErrors = await getTranslations("errors.geo");
    return tErrors("gscPropertyDenied");
  }
  return fallbackMessage;
}

async function runAgentReadinessOrBadRequest<T>(
  run: () => Promise<T>
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AgentReadinessTargetMissingError) {
      const tErrors = await getTranslations("errors.geo");
      throw badRequest(tErrors("agentReadinessWebsiteMissing"));
    }
    if (error instanceof AgentReadinessApiError) {
      const tErrors = await getTranslations("errors.geo");
      throw badRequest(tErrors("agentReadinessFailed"));
    }
    throw error;
  }
}

async function runGscSyncOrBadRequest(
  organizationId: string,
  projectId: string
): Promise<GscSyncResult> {
  try {
    const result = await Effect.runPromise(
      syncGscSuggestions(organizationId, projectId).pipe(
        Effect.provide(geoCoreDashboardLayer)
      )
    );
    if (result.status === "completed") {
      await Effect.runPromise(
        refreshGeoContentGapsBestEffort({ organizationId, projectId })
      );
    }
    return result;
  } catch (error) {
    throw badRequest(await toGscErrorMessage(error, "sync"));
  }
}

async function withGscIntegrationLockOrServiceUnavailable<T>(
  organizationId: string,
  operation: (
    signal: AbortSignal,
    assertOwned: () => Promise<void>
  ) => Promise<T>
): Promise<T> {
  try {
    return await withGscIntegrationLock(organizationId, operation);
  } catch (error) {
    if (
      error instanceof GscIntegrationLockBusyError ||
      error instanceof GscIntegrationLockLostError
    ) {
      const tErrors = await getTranslations("errors.geo");
      throw serviceUnavailable(tErrors("gscBusy"));
    }
    throw error;
  }
}

async function requireConnectedGscIntegration(
  organizationId: string
): Promise<GscIntegrationRow> {
  const integration = await getGscIntegration(organizationId);
  if (!integration) {
    throw notFound("Google Search Console is not connected");
  }
  if (integration.disconnectingAt) {
    const tErrors = await getTranslations("errors.geo");
    throw serviceUnavailable(tErrors("gscDisconnecting"));
  }
  return integration;
}

/** Ids are scoped to the integration; older schedules used the organization id. */
function getGscScheduleId(ownerId: string): string {
  return `${GSC_SCHEDULE_ID_PREFIX}${ownerId}`;
}

async function removeStaleGscScheduleAfterLeaseLoss(
  integration: GscIntegrationRow,
  scheduleId: string
) {
  try {
    const currentIntegration = await getGscIntegration(
      integration.organizationId
    );
    if (
      currentIntegration?.id === integration.id &&
      !currentIntegration.disconnectingAt
    ) {
      return;
    }
    await removeGscSchedule(scheduleId);
  } catch (error) {
    logError("[GSC] Failed to clean up stale weekly sync schedule", error);
  }
}

async function ensureGscSchedule(
  integration: GscIntegrationRow
): Promise<string | null> {
  return await withGscIntegrationLockOrServiceUnavailable(
    integration.organizationId,
    async (signal, assertLockOwned) => {
      const currentIntegration = await getGscIntegration(
        integration.organizationId
      );
      if (
        !currentIntegration ||
        currentIntegration.id !== integration.id ||
        currentIntegration.disconnectingAt
      ) {
        return null;
      }
      if (currentIntegration.qstashScheduleId) {
        return currentIntegration.qstashScheduleId;
      }

      const scheduleId = getGscScheduleId(currentIntegration.id);
      const legacyScheduleId = getGscScheduleId(
        currentIntegration.organizationId
      );
      try {
        await assertLockOwned();
        await deleteGscScheduleIfPresent(legacyScheduleId);
        await assertLockOwned();
      } catch (error) {
        signal.throwIfAborted();
        logError(
          "[GSC] Failed to reconcile legacy weekly sync schedule",
          error
        );
        return null;
      }

      let creationError: unknown = null;
      try {
        // The QStash SDK does not accept an AbortSignal. The lock waits for
        // this request to settle and compensates below if its lease was lost.
        // Scoping the id to this integration keeps that cleanup generation-safe.
        await assertLockOwned();
        await createQstashRouteSchedule({
          path: GSC_SYNC_WORKFLOW_PATH,
          cron: GSC_SYNC_CRON,
          body: { organizationId: currentIntegration.organizationId },
          scheduleId,
        });
      } catch (error) {
        creationError = error;
      }

      try {
        await assertLockOwned();
      } catch (error) {
        await removeStaleGscScheduleAfterLeaseLoss(
          currentIntegration,
          scheduleId
        );
        throw error;
      }
      if (creationError) {
        logError("[GSC] Failed to create weekly sync schedule", creationError);
        return null;
      }

      let claimed: GscIntegrationRow | null = null;
      try {
        claimed = await claimOrConfirmGscSchedule(
          currentIntegration,
          scheduleId,
          signal,
          assertLockOwned
        );
      } catch (error) {
        signal.throwIfAborted();
        logError(
          "[GSC] Failed to record weekly sync schedule; retrying",
          error
        );
        try {
          claimed = await claimOrConfirmGscSchedule(
            currentIntegration,
            scheduleId,
            signal,
            assertLockOwned
          );
        } catch (retryError) {
          signal.throwIfAborted();
          logError("[GSC] Failed to record weekly sync schedule", retryError);
        }
      }
      signal.throwIfAborted();

      if (claimed) {
        return scheduleId;
      }

      try {
        const refreshedIntegration = await getGscIntegration(
          currentIntegration.organizationId
        );
        await assertLockOwned();
        if (refreshedIntegration?.qstashScheduleId === scheduleId) {
          return scheduleId;
        }
        await removeGscSchedule(scheduleId);
        signal.throwIfAborted();
        return refreshedIntegration?.qstashScheduleId ?? null;
      } catch (error) {
        signal.throwIfAborted();
        logError("[GSC] Failed to reconcile weekly sync schedule", error);
        return null;
      }
    }
  );
}

async function deleteGscScheduleIfPresent(scheduleId: string) {
  try {
    await deleteQstashSchedule(scheduleId);
  } catch (error) {
    if (error instanceof QstashError && error.status === 404) {
      return;
    }
    throw error;
  }
}

async function removeGscSchedule(scheduleId: string | null) {
  if (!scheduleId) {
    return;
  }
  try {
    await deleteGscScheduleIfPresent(scheduleId);
  } catch (error) {
    logError("[GSC] Failed to delete QStash schedule", error);
  }
}

function getGscScheduleIdsForDisconnect(
  integration: GscIntegrationRow
): string[] {
  return [
    ...new Set(
      [
        integration.qstashScheduleId,
        getGscScheduleId(integration.id),
        getGscScheduleId(integration.organizationId),
      ].filter((scheduleId): scheduleId is string => scheduleId !== null)
    ),
  ];
}

async function loadGeoShelfSeed(
  context: GeoHandlerOptions<unknown>["context"],
  input: { organizationId: string; projectId?: string },
  options: { withMembers: boolean }
) {
  await assertOrganizationAccess(accessParams({ context, input }));
  const [shelfContext, members] = await Promise.all([
    runOrpcEffect(
      loadGeoShelfContext(input).pipe(Effect.provide(geoCoreDashboardLayer)),
      toGeoOrpcError
    ),
    options.withMembers
      ? listGeoShelfMembers(input.organizationId, context.headers)
      : Promise.resolve<GeoShelfMember[]>([]),
  ]);
  return { ...shelfContext, members };
}

async function resolveGeoShelfReadMembers(
  organizationId: string,
  loadedMembers: GeoShelfMember[],
  sources: GeoShelfSource[],
  headers: Headers
): Promise<GeoShelfMember[]> {
  if (loadedMembers.length > 0) {
    return loadedMembers;
  }
  if (collectGeoShelfMemberIds(sources).size === 0) {
    return [];
  }
  return await listGeoShelfMembers(organizationId, headers);
}

export const geoRouter = {
  shelfList: authorizedProcedure
    .input(geoShelfListInputSchema)
    .handler(async ({ context, input }) => {
      const seed = await loadGeoShelfSeed(context, input, {
        withMembers:
          GEO_SAMPLE_DATA_ENABLED ||
          input.ticket === "mine" ||
          input.search.trim().length > 0,
      });
      if (!seed.settings) {
        return geoShelfListResponseSchema.parse({
          sources: [],
          nextOffset: null,
          totalCount: 0,
          filteredCount: 0,
          boardCounts: GEO_SHELF_EMPTY_BOARD_COUNTS,
          hasScanData: false,
          ownBrandName: "",
          isSampleData: false,
        });
      }
      const page = await listGeoShelfSourcePage(
        { ...seed, settings: seed.settings },
        {
          offset: input.offset,
          limit: input.limit,
          shelf: input.shelf,
          ticket: input.ticket,
          currentMemberId: findCurrentGeoShelfMemberId(
            seed.members,
            context.user.id
          ),
          search: resolveGeoShelfSearch(
            input.search,
            seed.members,
            seed.competitors
          ),
          sort: { key: input.sortKey, direction: input.sortDirection },
        }
      );
      const shelfMembers = await resolveGeoShelfReadMembers(
        input.organizationId,
        seed.members,
        page.sources,
        context.headers
      );
      return geoShelfListResponseSchema.parse({
        ...page,
        sources: sanitizeGeoShelfSourceMembers(page.sources, shelfMembers),
        ownBrandName: seed.settings.companyName,
      });
    }),
  shelfMembers: authorizedProcedure
    .input(geoShelfMembersInputSchema)
    .handler(async ({ context, input }) => {
      await assertOrganizationAccess(accessParams({ context, input }));
      const members = await listGeoShelfMembers(
        input.organizationId,
        context.headers
      );
      return geoShelfMembersResponseSchema.parse({
        members,
        currentMemberId: findCurrentGeoShelfMemberId(members, context.user.id),
      });
    }),
  shelfCreate: authorizedProcedure
    .input(geoShelfCreateInputSchema)
    .handler(async ({ context, input }) => {
      const seed = await loadGeoShelfSeed(context, input, {
        withMembers:
          GEO_SAMPLE_DATA_ENABLED ||
          referencesGeoShelfMembers(input.opportunity),
      });
      if (!seed.settings) {
        const tErrors = await getTranslations("errors.geo");
        throw badRequest(tErrors("configureTrackingFirst"));
      }
      const source = await createGeoShelfSource(
        { ...seed, settings: seed.settings },
        input,
        context.user.id
      );
      trackGeoRouterEvent({
        context,
        input,
        event: POSTHOG_EVENTS.GEO_SHELF_SOURCE_CREATED,
        projectId: seed.settings.projectId,
        properties: {
          kind: source.kind,
          domain: source.domain,
          has_ticket: source.opportunity !== null,
          ticket_status: source.opportunity?.status ?? null,
          priority: source.opportunity?.priority ?? null,
          present_brand_count: source.placements.filter(
            (placement) => placement.status === "present"
          ).length,
        },
      });
      return geoShelfMutationResponseSchema.parse({ source });
    }),
  shelfUpdate: authorizedProcedure
    .input(geoShelfUpdateInputSchema)
    .handler(async ({ context, input }) => {
      const seed = await loadGeoShelfSeed(context, input, {
        withMembers:
          GEO_SAMPLE_DATA_ENABLED ||
          referencesGeoShelfMembers(input.opportunity),
      });
      if (!seed.settings) {
        const tErrors = await getTranslations("errors.geo");
        throw badRequest(tErrors("configureTrackingFirst"));
      }
      const result = await updateGeoShelfSource(
        { ...seed, settings: seed.settings },
        input,
        context.user.id
      );
      if (!result) {
        throw notFound("Shelf not found");
      }
      if (input.opportunity !== undefined) {
        trackGeoRouterEvent({
          context,
          input,
          event: POSTHOG_EVENTS.GEO_SHELF_OPPORTUNITY_UPDATED,
          projectId: seed.settings.projectId,
          properties: {
            status: result.source.opportunity?.status ?? null,
            priority: result.source.opportunity?.priority ?? null,
            assignee_changed: result.assigneeChanged,
            placements_changed: result.placementsChanged,
          },
        });
      }
      return geoShelfMutationResponseSchema.parse({ source: result.source });
    }),
  shelfUrlCheck: authorizedProcedure
    .input(geoShelfPreviewInputSchema)
    .handler(async ({ context, input }) => {
      const seed = await loadGeoShelfSeed(context, input, {
        withMembers: false,
      });
      const onShelf = seed.settings
        ? await isGeoShelfUrlOnShelf(
            { ...seed, settings: seed.settings },
            input.url
          )
        : false;
      return geoShelfUrlCheckResponseSchema.parse({ onShelf });
    }),
  shelfPreview: authorizedProcedure
    .input(geoShelfPreviewInputSchema)
    .handler(async ({ context, input }) => {
      await assertOrganizationAccess(accessParams({ context, input }));
      const rate = await ratelimit.geoShelfPreview.limit(
        `${input.organizationId}:${GEO_SHELF_PREVIEW_RATE_LIMIT_SCOPE}`
      );
      if (!rate.success) {
        trackGeoRouterEvent({
          context,
          input,
          event: POSTHOG_EVENTS.GEO_SHELF_PREVIEW_REQUESTED,
          properties: { outcome: GEO_SHELF_PREVIEW_OUTCOMES.RATE_LIMITED },
        });
        const tCommon = await getTranslations("common");
        throw tooManyRequests(tCommon("messages.tooManyPageLookupsPlease"), {
          code: GEO_SHELF_PREVIEW_RATE_LIMIT_CODE,
        });
      }
      const preview = await previewGeoShelfUrl(input.url);
      trackGeoRouterEvent({
        context,
        input,
        event: POSTHOG_EVENTS.GEO_SHELF_PREVIEW_REQUESTED,
        properties: {
          outcome: preview.available
            ? GEO_SHELF_PREVIEW_OUTCOMES.FETCHED
            : GEO_SHELF_PREVIEW_OUTCOMES.UNAVAILABLE,
          cache_max_age_ms: GEO_SHELF_PREVIEW_CACHE_MS,
        },
      });
      return geoShelfPreviewResponseSchema.parse(preview);
    }),
  modelCatalog: authorizedProcedure
    .input(geoModelCatalogInputSchema)
    .handler(async ({ context, input }) => {
      await assertOrganizationAccess(accessParams({ context, input }));
      return Effect.runPromise(
        loadGeoModelCatalog(input.organizationId).pipe(
          Effect.provide(geoCoreDashboardLayer)
        )
      );
    }),
  dataStatus: authorizedProcedure
    .input(geoOrganizationInputSchema)
    .handler(async ({ context, input }) => {
      await assertOrganizationAccess(accessParams({ context, input }));
      return {
        hasData: await Effect.runPromise(hasGeoData(input.organizationId)),
      };
    }),
  settings: authorizedProcedure
    .input(geoOrganizationInputSchema)
    .handler(geoOpenHandler((input) => loadGeoSettings(input))),
  settingsEngineAdd: authorizedProcedure
    .input(geoSettingsEngineAddInputSchema)
    .handler(geoHandler((input) => addGeoTrackedEngine(input))),
  settingsLanguageAdd: authorizedProcedure
    .input(geoSettingsLanguageAddInputSchema)
    .handler(geoHandler((input) => addGeoTrackedLanguage(input))),
  settingsUpsert: authorizedProcedure
    .input(geoSettingsUpsertInputSchema)
    .handler(
      geoHandler(
        (input) =>
          upsertGeoSettings(input).pipe(
            Effect.tap(() => refreshGeoContentGapsBestEffort(input))
          ),
        ({ context, input, output }) => {
          trackGeoRouterEvent({
            context,
            input,
            event: POSTHOG_EVENTS.GEO_SETTINGS_SAVED,
            projectId: output.settings?.projectId,
            properties: {
              engine_count: input.engines.length,
              language_count: input.languages.length,
              alias_count: input.aliases.length,
              schedule_enabled: input.enabled,
              interval_hours: input.scanIntervalHours,
              enforce_zdr: output.settings?.enforceZdr ?? input.enforceZdr,
              non_zdr_approved_count: input.nonZdrApprovedEngines.length,
            },
          });
        }
      )
    ),
  languageShare: authorizedProcedure
    .input(geoTimeseriesInputSchema)
    .handler(
      geoOpenHandler((input) => loadGeoLanguageShare(input, geoWindow(input)))
    ),
  overview: authorizedProcedure
    .input(geoTimeseriesInputSchema)
    .handler(
      geoOpenHandler((input) => loadGeoOverview(input, geoWindow(input)))
    ),
  sentiment: authorizedProcedure
    .input(sentimentPeriodInputSchema)
    .handler(
      geoOpenHandler((input) => loadGeoSentiment(input, geoWindow(input)))
    ),
  sentimentAnalysis: authorizedProcedure
    .input(sentimentPeriodInputSchema)
    .handler(
      geoOpenHandler((input) =>
        loadGeoSentimentAnalysis(input, geoWindow(input))
      )
    ),
  analyzeSentiment: authorizedProcedure
    .route({ method: "POST" })
    .input(sentimentPeriodInputSchema)
    .handler(
      geoHandler((input) =>
        loadGeoSentimentAnalysis(input, geoWindow(input), true, (task) =>
          afterResponse(async () => {
            try {
              await task();
            } catch (error) {
              logError("Could not analyze GEO sentiment", error);
            }
          })
        )
      )
    ),
  sentimentEvidence: authorizedProcedure
    .input(geoSentimentEvidenceInputSchema)
    .handler(
      geoOpenHandler((input) =>
        loadGeoSentimentEvidence(input, geoWindow(input))
      )
    ),
  timeseries: authorizedProcedure
    .input(geoTimeseriesInputSchema)
    .handler(
      geoOpenHandler((input) => loadGeoTimeseries(input, geoWindow(input)))
    ),
  promptResultSummaries: authorizedProcedure
    .input(geoTimeseriesInputSchema)
    .handler(
      geoOpenHandler((input) =>
        loadGeoPromptResultSummaries(input, geoWindow(input))
      )
    ),
  promptResultDetail: authorizedProcedure
    .input(geoPromptResultDetailInputSchema)
    .handler(geoOpenHandler((input) => loadGeoPromptResultDetail(input))),
  changes: authorizedProcedure
    .input(geoOrganizationInputSchema)
    .handler(geoOpenHandler((input) => loadGeoChanges(input))),
  promptHistory: authorizedProcedure
    .input(geoPromptHistoryInputSchema)
    .handler(geoOpenHandler((input) => loadGeoPromptHistory(input))),
  competitorShare: authorizedProcedure
    .input(geoCompetitorShareInputSchema)
    .handler(
      geoOpenHandler((input) =>
        loadGeoCompetitorShare(input, geoWindow(input), input.summaryOnly)
      )
    ),
  competitorEngineMatrix: authorizedProcedure
    .input(geoTimeseriesInputSchema)
    .handler(
      geoOpenHandler((input) =>
        loadGeoCompetitorEngineMatrix(input, geoWindow(input))
      )
    ),
  competitors: authorizedProcedure
    .input(geoOrganizationInputSchema)
    .handler(geoOpenHandler((input) => loadGeoCompetitors(input))),
  competitorUpsert: authorizedProcedure
    .input(geoCompetitorUpsertInputSchema)
    .handler(
      geoOpenHandler(
        (input) =>
          upsertGeoCompetitor(input, input).pipe(
            Effect.tap(() => refreshGeoContentGapsBestEffort(input))
          ),
        ({ context, input, output }) => {
          trackGeoRouterEvent({
            context,
            input,
            event: input.previousName
              ? POSTHOG_EVENTS.GEO_COMPETITOR_UPDATED
              : POSTHOG_EVENTS.GEO_COMPETITOR_ADDED,
            properties: {
              kind: input.kind ?? null,
              source: GEO_COMPETITOR_SOURCES.MANUAL,
              has_domain: input.domain !== null,
              synonym_count: input.synonyms?.length ?? 0,
              competitor_count: output.competitors.length,
            },
          });
        }
      )
    ),
  competitorDelete: authorizedProcedure
    .input(geoCompetitorDeleteInputSchema)
    .handler(
      geoOpenHandler(
        (input) =>
          deleteGeoCompetitor(input, input.name).pipe(
            Effect.tap(() => refreshGeoContentGapsBestEffort(input))
          ),
        ({ context, input, output }) => {
          trackGeoRouterEvent({
            context,
            input,
            event: POSTHOG_EVENTS.GEO_COMPETITOR_DELETED,
            properties: { competitor_count: output.competitors.length },
          });
        }
      )
    ),
  competitorDomainsFill: authorizedProcedure
    .input(geoCompetitorDomainFillInputSchema)
    .handler(geoOpenHandler((input) => fillGeoCompetitorDomains(input))),
  competitorIgnore: authorizedProcedure
    .input(geoCompetitorIgnoreInputSchema)
    .handler(
      geoOpenHandler(
        (input) => setGeoCompetitorIgnored(input),
        ({ context, input }) => {
          trackGeoRouterEvent({
            context,
            input,
            event: POSTHOG_EVENTS.GEO_COMPETITOR_SUGGESTION_IGNORED,
            properties: { ignored: input.ignored },
          });
        }
      )
    ),
  competitorsImport: authorizedProcedure
    .input(geoCompetitorsImportInputSchema)
    .handler(
      geoOpenHandler(
        (input) =>
          importGeoCompetitors(input, input.rows).pipe(
            Effect.tap(() => refreshGeoContentGapsBestEffort(input))
          ),
        ({ context, input, output }) => {
          trackGeoRouterEvent({
            context,
            input,
            event: POSTHOG_EVENTS.GEO_COMPETITORS_IMPORTED,
            properties: {
              rows: input.rows.length,
              inserted: output.imported,
              updated: output.updated,
              duplicates: output.skipped,
              competitor_count: output.competitors.length,
            },
          });
        }
      )
    ),
  competitorDetail: authorizedProcedure
    .input(geoCompetitorDetailInputSchema)
    .handler(
      geoOpenHandler((input) =>
        loadGeoCompetitorDetail(
          input,
          input.brand,
          geoWindow(input),
          input.summaryOnly
        )
      )
    ),
  agentReadiness: authorizedProcedure
    .input(geoOrganizationInputSchema)
    .handler(async ({ context, input }): Promise<AgentReadinessResponse> => {
      await assertOrganizationAccess(accessParams({ context, input }));
      const scope = await runOrpcEffect(
        requireGeoProject(input),
        toGeoOrpcError
      );
      return await runAgentReadinessOrBadRequest(() =>
        Effect.runPromise(loadAgentReadiness(scope))
      );
    }),
  agentReadinessScan: authorizedProcedure
    .input(geoOrganizationInputSchema)
    .handler(
      async ({ context, input }): Promise<AgentReadinessScanResponse> => {
        await assertGeoAccess(accessParams({ context, input }));
        const scope = await runOrpcEffect(
          requireGeoProject(input),
          toGeoOrpcError
        );
        const [response, previousReport] = await Promise.all([
          runAgentReadinessOrBadRequest(() =>
            Effect.runPromise(
              startAgentReadinessScan(scope).pipe(
                Effect.provide(geoCoreDashboardLayer)
              )
            )
          ),
          db.query.geoAgentReadinessReports
            .findFirst({
              columns: { id: true },
              where: and(
                eq(geoAgentReadinessReports.projectId, scope.projectId),
                eq(geoAgentReadinessReports.status, "completed")
              ),
            })
            .catch(() => undefined),
        ]);
        trackGeoRouterEvent({
          context,
          input,
          event: POSTHOG_EVENTS.AGENT_READINESS_SCAN_STARTED,
          projectId: scope.projectId,
          properties: {
            report_id: response.reportId,
            is_rescan: Boolean(previousReport),
            already_running: response.alreadyRunning,
          },
        });
        return response;
      }
    ),
  aiTraffic: authorizedProcedure
    .input(aiTrafficInputSchema)
    .handler(
      geoOpenHandler((input) =>
        loadAiTraffic(
          input,
          geoWindow(input),
          webHostFilter(input.host),
          "",
          input.path,
          input.sites,
          false
        )
      )
    ),
  aiTrafficSources: authorizedProcedure
    .input(aiTrafficInputSchema)
    .handler(
      geoOpenHandler((input) =>
        loadAiTrafficSources(
          input,
          geoWindow(input),
          webHostFilter(input.host),
          input.path,
          input.sites
        )
      )
    ),
  webAnalytics: authorizedProcedure
    .input(webAnalyticsInputSchema)
    .handler(
      geoOpenHandler((input) =>
        loadWebAnalytics(
          input,
          geoWindow(input),
          input.host,
          input.path,
          input.sites,
          "summary"
        )
      )
    ),
  webAnalyticsBreakdowns: authorizedProcedure
    .input(webAnalyticsInputSchema)
    .handler(
      geoOpenHandler((input) =>
        loadWebAnalytics(
          input,
          geoWindow(input),
          input.host,
          input.path,
          input.sites,
          "breakdowns"
        )
      )
    ),
  mcpAnalytics: authorizedProcedure
    .input(mcpAnalyticsInputSchema)
    .handler(
      geoOpenHandler((input) => loadMcpAnalytics(input, geoWindow(input)))
    ),
  mcpToolDetail: authorizedProcedure
    .input(mcpToolDetailInputSchema)
    .handler(
      geoOpenHandler((input) =>
        loadMcpToolDetail(input, geoWindow(input), input.tool)
      )
    ),
  mcpSession: authorizedProcedure
    .input(mcpSessionInputSchema)
    .handler(
      geoOpenHandler((input) =>
        loadMcpSession(input, geoWindow(input), input.sessionId)
      )
    ),
  trafficLog: authorizedProcedure
    .input(geoTrafficLogInputSchema)
    .handler(
      geoOpenHandler((input) =>
        loadGeoTrafficLog(
          input,
          input.limit,
          input.visitorTypes,
          input.categories,
          input.host,
          input.path,
          input.sites
        )
      )
    ),
  trafficJourneys: authorizedProcedure
    .input(geoTrafficJourneysInputSchema)
    .handler(
      geoOpenHandler((input) =>
        loadGeoTrafficJourneys(input, geoWindow(input), input.limit)
      )
    ),
  journeyStats: authorizedProcedure
    .input(geoJourneyStatsInputSchema)
    .handler(
      geoOpenHandler((input) => loadGeoJourneyStats(input, geoWindow(input)))
    ),
  journeyDetail: authorizedProcedure
    .input(geoJourneyDetailInputSchema)
    .handler(
      geoOpenHandler((input) =>
        loadGeoJourneyDetail(input, input.journeyId, geoWindow(input))
      )
    ),
  trafficPages: authorizedProcedure
    .input(geoTrafficPagesInputSchema)
    .handler(
      geoOpenHandler((input) =>
        loadGeoTrafficPages(
          input,
          geoWindow(input),
          input.limit,
          input.visitorType,
          input.host,
          input.path,
          input.sites
        )
      )
    ),
  ingestSetup: authorizedProcedure
    .input(geoOrganizationInputSchema)
    .handler(async ({ context, input }): Promise<GeoIngestSetupResponse> => {
      await assertOrganizationAccess(accessParams({ context, input }));

      const setup = await runOrpcEffect(
        issueGeoIngestSetupResponse(input).pipe(
          Effect.provide(geoCoreDashboardLayer)
        ),
        toGeoOrpcError
      );
      if (!setup) {
        throw notFound("Organization not found");
      }
      return setup;
    }),
  ingestTokenRotate: authorizedProcedure
    .input(geoOrganizationInputSchema)
    .handler(async ({ context, input }): Promise<GeoIngestSetupResponse> => {
      await assertOrganizationAccess(accessParams({ context, input }));

      const setup = await runOrpcEffect(
        rotateGeoIngestSetupResponse(input).pipe(
          Effect.provide(geoCoreDashboardLayer)
        ),
        toGeoOrpcError
      );
      if (!setup) {
        throw notFound("Organization not found");
      }
      trackGeoRouterEvent({
        context,
        input,
        event: POSTHOG_EVENTS.TRAFFIC_TOKEN_ROTATED,
      });
      return setup;
    }),
  promptsList: authorizedProcedure
    .input(geoOrganizationInputSchema)
    .handler(geoOpenHandler((input) => listGeoPrompts(input))),
  promptsCreate: authorizedProcedure.input(geoPromptCreateInputSchema).handler(
    geoHandler(
      (input) =>
        createGeoPrompt(input, input.prompt, input.id, input.tags ?? []).pipe(
          Effect.tap(() => refreshGeoContentGapsBestEffort(input))
        ),
      ({ context, input, output }) => {
        trackGeoRouterEvent({
          context,
          input,
          event: POSTHOG_EVENTS.GEO_PROMPT_ADDED,
          properties: {
            source: GEO_PROMPT_SOURCES.MANUAL,
            prompt_id: output.id,
          },
        });
      }
    )
  ),
  promptsImport: authorizedProcedure.input(geoPromptsImportInputSchema).handler(
    geoHandler(
      (input) =>
        importGeoPrompts(input, input.rows).pipe(
          Effect.tap(() => refreshGeoContentGapsBestEffort(input))
        ),
      ({ context, input, output }) => {
        trackGeoRouterEvent({
          context,
          input,
          event: POSTHOG_EVENTS.GEO_PROMPTS_IMPORTED,
          properties: {
            rows: input.rows.length,
            inserted: output.imported,
            duplicates: output.skipped,
          },
        });
      }
    )
  ),
  promptsDelete: authorizedProcedure.input(geoPromptDeleteInputSchema).handler(
    geoHandler(
      (input) =>
        deleteGeoPrompt(input, input.promptId).pipe(
          Effect.tap(() => refreshGeoContentGapsBestEffort(input))
        ),
      ({ context, input }) => {
        trackGeoRouterEvent({
          context,
          input,
          event: POSTHOG_EVENTS.GEO_PROMPT_DELETED,
          properties: { count: 1, prompt_id: input.promptId },
        });
      }
    )
  ),
  promptsUpdate: authorizedProcedure.input(geoPromptUpdateInputSchema).handler(
    geoHandler((input) =>
      updateGeoPrompt(input, input.promptId, {
        enabled: input.enabled,
        tags: input.tags,
      }).pipe(Effect.tap(() => refreshGeoContentGapsBestEffort(input)))
    )
  ),
  promptTranslations: authorizedProcedure
    .input(geoOrganizationInputSchema)
    .handler(geoOpenHandler((input) => listGeoPromptTranslations(input))),
  promptTranslationsTranslate: authorizedProcedure
    .input(geoOrganizationInputSchema)
    .handler(geoHandler((input) => translateGeoPromptTranslations(input))),
  promptTranslationSelect: authorizedProcedure
    .input(geoPromptTranslationSelectInputSchema)
    .handler(geoHandler((input) => selectGeoPromptTranslation(input))),
  promptTranslationUpdate: authorizedProcedure
    .input(geoPromptTranslationUpdateInputSchema)
    .handler(geoHandler((input) => updateGeoPromptTranslation(input))),
  promptTranslationReset: authorizedProcedure
    .input(geoPromptTranslationTargetInputSchema)
    .handler(geoHandler((input) => resetGeoPromptTranslation(input))),
  promptsToggleAuto: authorizedProcedure
    .input(geoAutoPromptToggleInputSchema)
    .handler(
      geoHandler((input) =>
        toggleGeoAutoPrompt(input, input.promptId, input.enabled).pipe(
          Effect.tap(() => refreshGeoContentGapsBestEffort(input))
        )
      )
    ),
  promptsToggle: authorizedProcedure.input(geoPromptToggleInputSchema).handler(
    geoHandler(
      (input) =>
        toggleGeoPrompt(input, input.promptId, input.enabled).pipe(
          Effect.tap(() => refreshGeoContentGapsBestEffort(input))
        ),
      ({ context, input }) => {
        trackGeoRouterEvent({
          context,
          input,
          event: POSTHOG_EVENTS.GEO_PROMPT_TOGGLED,
          properties: { enabled: input.enabled, prompt_id: input.promptId },
        });
      }
    )
  ),
  sequencesList: authorizedProcedure
    .input(geoOrganizationInputSchema)
    .handler(geoOpenHandler((input) => listGeoSequences(input))),
  sequencesCreate: authorizedProcedure
    .input(geoSequenceCreateInputSchema)
    .handler(
      geoHandler(
        (input) => createGeoSequence(input, input),
        ({ context, input }) => {
          trackGeoRouterEvent({
            context,
            input,
            event: POSTHOG_EVENTS.GEO_CONVERSATION_CREATED,
            properties: { turn_count: input.steps.length },
          });
        }
      )
    ),
  sequencesGenerate: authorizedProcedure
    .input(geoOrganizationInputSchema)
    .handler(async (options) => {
      await assertOrganizationAccess(accessParams(options));
      const rate = await ratelimit.geoSequencesGenerate.limit(
        options.input.organizationId
      );
      if (!rate.success) {
        const tErrors = await getTranslations("errors.geo");
        throw badRequest(tErrors("tooManyConversationGenerations"));
      }
      return geoHandler(
        (input) => generateGeoSequences(input),
        ({ context, input, output }) => {
          trackGeoRouterEvent({
            context,
            input,
            event: POSTHOG_EVENTS.GEO_CONVERSATIONS_GENERATED,
            properties: { conversation_count: output.sequences.length },
          });
        }
      )(options);
    }),
  sequencesUpdate: authorizedProcedure
    .input(geoSequenceUpdateInputSchema)
    .handler(
      geoHandler(
        (input) => updateGeoSequence(input, input),
        ({ context, input }) => {
          trackGeoRouterEvent({
            context,
            input,
            event: POSTHOG_EVENTS.GEO_CONVERSATION_UPDATED,
            properties: {
              sequence_id: input.sequenceId,
              turn_count: input.steps?.length ?? null,
              enabled: input.enabled ?? null,
            },
          });
        }
      )
    ),
  sequencesDelete: authorizedProcedure
    .input(geoSequenceDeleteInputSchema)
    .handler(
      geoHandler(
        (input) => deleteGeoSequence(input, input.sequenceId),
        ({ context, input }) => {
          trackGeoRouterEvent({
            context,
            input,
            event: POSTHOG_EVENTS.GEO_CONVERSATION_DELETED,
            properties: { sequence_id: input.sequenceId },
          });
        }
      )
    ),
  sequenceResults: authorizedProcedure
    .input(geoSequenceResultsInputSchema)
    .handler(
      geoOpenHandler((input) => loadGeoSequenceResults(input, input.sequenceId))
    ),
  sequenceRun: authorizedProcedure
    .input(geoSequenceRunInputSchema)
    .handler(async ({ context, input }) => {
      await assertOrganizationAccess(accessParams({ context, input }));
      const [, , rate] = await Promise.all([
        assertGeoEntitlement(input.organizationId, context.headers),
        assertActiveSubscription(input.organizationId),
        ratelimit.geoSequenceRun.limit(input.organizationId),
      ]);
      trackGeoRouterEvent({
        context,
        input,
        event: POSTHOG_EVENTS.GEO_CONVERSATION_RUN_NOW,
        properties: {
          sequence_id: input.sequenceId,
          rate_limited: !rate.success,
        },
      });
      if (!rate.success) {
        trackGeoRouterEvent({
          context,
          input,
          event: POSTHOG_EVENTS.GEO_SEQUENCE_RUN,
          properties: {
            sequence_id: input.sequenceId,
            outcome: GEO_SEQUENCE_RUN_OUTCOMES.RATE_LIMITED,
            rate_limited: true,
          },
        });
        const tErrors = await getTranslations("errors.geo");
        throw badRequest(tErrors("tooManyRuns"));
      }

      const result = await runOrpcEffect(
        runGeoSequenceNow(input, input.sequenceId).pipe(
          Effect.provide(geoCoreDashboardLayer)
        ),
        toGeoOrpcError
      );
      trackGeoRouterEvent({
        context,
        input,
        event: POSTHOG_EVENTS.GEO_SEQUENCE_RUN,
        properties: {
          sequence_id: input.sequenceId,
          outcome: GEO_SEQUENCE_RUN_OUTCOMES.COMPLETED,
          rate_limited: false,
          checks: result.checks,
          mentions: result.mentions,
          engine_count: result.engines.length,
        },
      });
      if (result.checks > 0) {
        scheduleGeoShelfCitationSync(input);
      }
      return result;
    }),
  personasList: authorizedProcedure
    .input(geoOrganizationInputSchema)
    .handler(geoOpenHandler((input) => listGeoPersonas(input))),
  personasActivity: authorizedProcedure
    .input(geoTimeseriesInputSchema)
    .handler(geoOpenHandler((input) => loadGeoPersonaActivity(input))),
  personasGenerate: authorizedProcedure
    .input(geoPersonasGenerateInputSchema)
    .handler(async ({ context, input }) => {
      await assertGeoAccess(accessParams({ context, input }));
      const [, scope] = await Promise.all([
        assertActiveSubscription(input.organizationId),
        runOrpcEffect(
          requireGeoPersonaGenerationCapacity(
            input,
            input.personaId,
            input.brief
          ).pipe(Effect.provide(geoCoreDashboardLayer)),
          toGeoOrpcError
        ),
      ]);
      const rate = await ratelimit.geoPersonasGenerate.limit(
        input.organizationId
      );
      if (!rate.success) {
        const tErrors = await getTranslations("errors.geo");
        throw badRequest(tErrors("tooManyPersonaGenerations"));
      }
      return startPersonaGeneration(
        scope.organizationId,
        scope.projectId,
        input.personaId,
        input.brief,
        input.promptsOnly
      );
    }),
  personasGenerationStatus: authorizedProcedure
    .input(geoOrganizationInputSchema)
    .handler(async ({ context, input }) => {
      await assertOrganizationAccess(accessParams({ context, input }));
      const scope = await runOrpcEffect(
        requireGeoProject(input).pipe(Effect.provide(geoCoreDashboardLayer)),
        toGeoOrpcError
      );
      return getPersonaGeneration(scope.organizationId, scope.projectId);
    }),
  personaUpdate: authorizedProcedure.input(geoPersonaUpdateInputSchema).handler(
    geoHandler(
      (input) => updateGeoPersona(input, input),
      ({ context, input }) => {
        trackGeoRouterEvent({
          context,
          input,
          event: POSTHOG_EVENTS.GEO_PERSONA_UPDATED,
          properties: {
            persona_id: input.personaId,
            enabled: input.enabled ?? null,
          },
        });
      }
    )
  ),
  personaDelete: authorizedProcedure.input(geoPersonaDeleteInputSchema).handler(
    geoHandler(
      (input) => deleteGeoPersona(input, input.personaId),
      ({ context, input }) => {
        trackGeoRouterEvent({
          context,
          input,
          event: POSTHOG_EVENTS.GEO_PERSONA_ARCHIVED,
          properties: { persona_id: input.personaId },
        });
      }
    )
  ),
  personaRestore: authorizedProcedure
    .input(geoPersonaRestoreInputSchema)
    .handler(
      geoHandler(
        (input) => restoreGeoPersona(input, input.personaId),
        ({ context, input }) => {
          trackGeoRouterEvent({
            context,
            input,
            event: POSTHOG_EVENTS.GEO_PERSONA_RESTORED,
            properties: { persona_id: input.personaId },
          });
        }
      )
    ),
  personaResults: authorizedProcedure
    .input(geoPersonaResultsInputSchema)
    .handler(
      geoOpenHandler((input) =>
        loadGeoPersonaResults(input, input.personaId, input.scanId)
      )
    ),
  personaRun: authorizedProcedure
    .input(geoPersonaRunInputSchema)
    .handler(async ({ context, input }) => {
      await assertGeoAccess(accessParams({ context, input }));
      await assertActiveSubscription(input.organizationId);
      const rate = await ratelimit.geoPersonaRun.limit(input.organizationId);
      trackGeoRouterEvent({
        context,
        input,
        event: POSTHOG_EVENTS.GEO_PERSONA_RUN_NOW,
        properties: {
          persona_id: input.personaId,
          rate_limited: !rate.success,
        },
      });
      if (!rate.success) {
        trackGeoRouterEvent({
          context,
          input,
          event: POSTHOG_EVENTS.GEO_PERSONA_RUN,
          properties: {
            persona_id: input.personaId,
            outcome: GEO_SEQUENCE_RUN_OUTCOMES.RATE_LIMITED,
            rate_limited: true,
          },
        });
        const tErrors = await getTranslations("errors.geo");
        throw badRequest(tErrors("tooManyRuns"));
      }

      const result = await runOrpcEffect(
        runGeoPersonaNow(input, input.personaId).pipe(
          Effect.provide(geoCoreDashboardLayer)
        ),
        toGeoOrpcError
      );
      trackGeoRouterEvent({
        context,
        input,
        event: POSTHOG_EVENTS.GEO_PERSONA_RUN,
        properties: {
          persona_id: input.personaId,
          outcome: GEO_SEQUENCE_RUN_OUTCOMES.COMPLETED,
          rate_limited: false,
          checks: result.checks,
          mentions: result.mentions,
          engine_count: result.engines.length,
        },
      });
      return result;
    }),
  projectsList: authorizedProcedure
    .input(geoOrganizationInputSchema)
    .handler(geoOpenHandler((input) => listGeoProjects(input.organizationId))),
  projectsCreate: authorizedProcedure
    .input(geoProjectCreateInputSchema)
    .handler(async (options) => {
      await assertOrganizationAccess(accessParams(options));
      const scanEnabled =
        (await resolveGeoEntitlement(
          options.input.organizationId,
          options.context.headers
        )) !== "denied";
      return geoOpenHandler(
        (input: GeoProjectCreateHandlerInput) =>
          requireBrandIdentity(
            input.organizationId,
            input.brandSettingsId
          ).pipe(
            Effect.flatMap((identity) =>
              createGeoProjectFromWebsite(
                input.organizationId,
                input.name,
                input.brandSettingsId,
                identity.websiteUrl,
                scanEnabled,
                input.languages
              )
            )
          ),
        async ({ context, input, output }) => {
          const projectCount = await countGeoProjects(
            input.organizationId
          ).catch(() => null);
          identifyProjectGroup({
            projectId: output.id,
            organizationId: input.organizationId,
            userId: context.user?.id ?? null,
            properties: {
              name: output.name,
              is_sample: false,
              brand_settings_id: output.brandSettingsId,
              created_at: output.createdAt,
            },
          });
          trackGeoRouterEvent({
            context,
            input,
            event: POSTHOG_EVENTS.GEO_PROJECT_CREATED,
            projectId: output.id,
            properties: { is_sample: false, project_count: projectCount },
          });
        }
      )(options);
    }),
  projectsUpdate: authorizedProcedure
    .input(geoProjectUpdateInputSchema)
    .handler(
      geoHandler((input) =>
        updateGeoProject(input.organizationId, input.projectId, {
          brandSettingsId: input.brandSettingsId,
        })
      )
    ),
  projectsDelete: authorizedProcedure
    .input(geoProjectDeleteInputSchema)
    .handler(
      geoHandler((input) =>
        deleteGeoProject(input.organizationId, input.projectId)
      )
    ),
  generateFromWebsite: authorizedProcedure
    .input(geoGenerateFromWebsiteInputSchema)
    .handler(
      geoHandler(
        (input) => generateGeoFromWebsite(input, input.url),
        ({ context, input, output }) => {
          trackGeoRouterEvent({
            context,
            input,
            event: POSTHOG_EVENTS.GEO_PROMPTS_GENERATED_FROM_WEBSITE,
            properties: {
              prompt_count: output.promptsAdded,
              conversation_count: output.conversationsAdded,
              competitor_count: output.competitors.length,
              alias_count: output.aliases.length,
            },
          });
        }
      )
    ),
  discoverWebsite: authorizedProcedure
    .input(geoDiscoverWebsiteInputSchema)
    .handler(
      geoOpenHandler((input) =>
        discoverGeoWebsite(
          input.organizationId,
          input.url,
          false,
          input.language
        )
      )
    ),
  onboardingBrand: authorizedProcedure
    .input(geoOnboardingBrandInputSchema)
    .handler(geoOpenHandler((input) => saveGeoOnboardingBrand(input))),
  competitorSuggestions: authorizedProcedure
    .input(geoCompetitorSuggestionsInputSchema)
    .handler(async (options) => {
      await assertOrganizationAccess(accessParams(options));
      const rate = await ratelimit.geoCompetitorSuggestions.limit(
        options.input.organizationId
      );
      if (!rate.success) {
        const tErrors = await getTranslations("errors.geo");
        throw badRequest(tErrors("tooManyLookups"));
      }
      return geoOpenHandler((input: GeoCompetitorSuggestionsHandlerInput) =>
        suggestGeoCompetitors(input, input.domain)
      )(options);
    }),
  brandSearch: authorizedProcedure
    .input(geoBrandSearchInputSchema)
    .handler(async (options) => {
      await assertOrganizationAccess(accessParams(options));
      const rate = await ratelimit.geoBrandSearch.limit(
        options.input.organizationId
      );
      if (!rate.success) {
        const tErrors = await getTranslations("errors.geo");
        throw badRequest(tErrors("tooManySearches"));
      }
      return geoOpenHandler((input: GeoBrandSearchHandlerInput) =>
        searchGeoBrands(input, input.query)
      )(options);
    }),
  startScan: authorizedProcedure.input(geoScanStartInputSchema).handler(
    geoHandler(
      (input) => startGeoScan(input),
      async ({ context, input, output }) => {
        const snapshot = await loadGeoScanStartSnapshot(input);
        trackGeoRouterEvent({
          context,
          input,
          event: POSTHOG_EVENTS.GEO_SCAN_STARTED,
          projectId: snapshot?.projectId,
          properties: {
            trigger: input.trigger ?? GEO_DEFAULT_SCAN_TRIGGER,
            scan_id: output.scanId,
            prompt_count: snapshot?.prompt_count,
            engine_count: snapshot?.engine_count,
            language_count: snapshot?.language_count,
            is_first_scan: snapshot?.is_first_scan,
            zdr_enforced: snapshot?.zdr_enforced,
          },
        });
      }
    )
  ),
  startFreeScan: authorizedProcedure
    .input(geoOrganizationInputSchema)
    .handler(async ({ context, input }) => {
      await assertOrganizationAccess(accessParams({ context, input }));
      return runOrpcEffect(
        startFreeGeoScan(input, context.user).pipe(
          Effect.provide(geoCoreDashboardLayer)
        ),
        toGeoOrpcError
      );
    }),
  rescanPrompt: authorizedProcedure
    .input(geoPromptRescanInputSchema)
    .handler(geoHandler((input) => startGeoPromptRescan(input))),
  scanStatus: authorizedProcedure
    .input(geoScanStatusInputSchema)
    .handler(geoOpenHandler((input) => loadGeoScanStatus(input, input.scanId))),
  scanRuns: authorizedProcedure
    .input(geoScanRunsInputSchema)
    .handler(geoOpenHandler((input) => loadGeoScanRuns(input))),
  scanRun: authorizedProcedure
    .input(geoScanRunInputSchema)
    .handler(geoOpenHandler((input) => loadGeoScanRun(input))),
  writerGaps: authorizedProcedure
    .input(geoOrganizationInputSchema)
    .handler(geoOpenHandler((input) => loadGeoContentGaps(input))),
  writerGapIgnore: authorizedProcedure
    .input(geoPromptGapIgnoreInputSchema)
    .handler(
      geoHandler(
        (input) =>
          setGeoPromptGapIgnored(input).pipe(
            Effect.tap(() => refreshGeoContentGapsBestEffort(input))
          ),
        ({ context, input }) => {
          trackGeoRouterEvent({
            context,
            input,
            event: POSTHOG_EVENTS.GEO_GAP_IGNORED,
            properties: { ignored: input.ignored },
          });
        }
      )
    ),
  writerBriefsList: authorizedProcedure
    .input(geoOrganizationInputSchema)
    .handler(geoOpenHandler((input) => listGeoContentBriefs(input))),
  writerBrief: authorizedProcedure
    .input(geoWriterBriefIdInputSchema)
    .handler(
      geoOpenHandler((input) => getGeoContentBrief(input, input.briefId))
    ),
  writerPlan: authorizedProcedure
    .input(geoWriterPlanInputSchema)
    .handler(async ({ context, input }) => {
      await assertOrganizationAccess(accessParams({ context, input }));
      const [, , rate] = await Promise.all([
        assertGeoEntitlement(input.organizationId, context.headers),
        assertActiveSubscription(input.organizationId),
        ratelimit.geoWriterPlan.limit(input.organizationId),
      ]);
      const briefTraits = {
        auto_approve: input.autoApprove,
        subtype: input.contentSubtype ?? null,
        source_kind: input.sourceKind ?? "manual",
        competitor_count: input.competitorIds?.length ?? 0,
        has_sitemap: Boolean(input.sitemapId),
        brand_voice_count: input.brandVoiceIds?.length ?? 0,
      };
      if (!rate.success) {
        trackGeoRouterEvent({
          context,
          input,
          event: POSTHOG_EVENTS.GEO_BRIEF_PLANNED,
          properties: { ...briefTraits, rate_limited: true },
        });
        const tErrors = await getTranslations("errors.geo");
        throw badRequest(tErrors("tooManyBriefs"));
      }

      const plan = await runOrpcEffect(
        planGeoContentBrief(input, context.user?.id).pipe(
          Effect.provide(geoCoreDashboardLayer)
        ),
        toGeoOrpcError
      );
      await runOrpcEffect(
        refreshGeoContentGapsBestEffort(input),
        toGeoOrpcError
      );
      trackGeoRouterEvent({
        context,
        input,
        event: POSTHOG_EVENTS.GEO_BRIEF_PLANNED,
        properties: {
          ...briefTraits,
          rate_limited: false,
          brief_id: plan.briefId,
          brief_status: plan.status,
          has_post: plan.postId !== null,
        },
      });
      return plan;
    }),
  writerStart: authorizedProcedure
    .input(geoWriterBriefIdInputSchema)
    .handler(async ({ context, input }) => {
      await assertOrganizationAccess(accessParams({ context, input }));
      await Promise.all([
        assertGeoEntitlement(input.organizationId, context.headers),
        assertActiveSubscription(input.organizationId),
      ]);

      const started = await runOrpcEffect(
        approveAndStartGeoWriter(input, input.briefId).pipe(
          Effect.provide(geoCoreDashboardLayer)
        ),
        toGeoOrpcError
      );
      await runOrpcEffect(
        refreshGeoContentGapsBestEffort(input),
        toGeoOrpcError
      );
      trackGeoRouterEvent({
        context,
        input,
        event: POSTHOG_EVENTS.GEO_WRITER_STARTED,
        properties: { brief_id: input.briefId, run_id: started.runId },
      });
      return started;
    }),
  writerUpdate: authorizedProcedure
    .input(geoWriterUpdateInputSchema)
    .handler(async ({ context, input }) => {
      await assertOrganizationAccess(accessParams({ context, input }));
      await Promise.all([
        assertGeoEntitlement(input.organizationId, context.headers),
        assertActiveSubscription(input.organizationId),
      ]);

      const result = await runOrpcEffect(
        updateGeoContentBrief(input).pipe(
          Effect.provide(geoCoreDashboardLayer)
        ),
        toGeoOrpcError
      );
      await runOrpcEffect(
        refreshGeoContentGapsBestEffort(input),
        toGeoOrpcError
      );
      return result;
    }),
  sampleData: authorizedProcedure
    .input(geoOrganizationInputSchema)
    .handler(async (options) => {
      if (!GEO_SAMPLE_DATA_ENABLED) {
        throw notFound();
      }
      assertNotDemo();
      return geoHandler((input) => seedGeoSampleData(input))(options);
    }),
  sampleDataClear: authorizedProcedure
    .input(geoOrganizationInputSchema)
    .handler(async (options) => {
      if (!GEO_SAMPLE_DATA_ENABLED) {
        throw notFound();
      }
      assertNotDemo();
      return geoHandler((input) => clearGeoSampleData(input))(options);
    }),
  searchConsoleStatus: authorizedProcedure
    .input(geoOrganizationInputSchema)
    .handler(async ({ context, input }): Promise<GeoSearchConsoleStatus> => {
      await assertOrganizationAccess(accessParams({ context, input }));

      const configured = getGscOAuthCredentials() !== null;
      const [integration, scope] = await Promise.all([
        getGscIntegration(input.organizationId),
        runOrpcEffect(resolveGeoScope(input), toGeoOrpcError),
      ]);
      const project = scope.projectId
        ? await db.query.projects.findFirst({
            columns: {
              gscSiteUrl: true,
              gscLastSyncedAt: true,
              gscLastError: true,
            },
            where: eq(projects.id, scope.projectId),
          })
        : null;
      if (!integration) {
        return {
          configured,
          connected: false,
          email: null,
          siteUrl: null,
          status: null,
          lastSyncedAt: null,
          lastError: null,
          weeklySyncScheduled: false,
          sites: [],
        };
      }

      let sites: GeoSearchConsoleStatus["sites"] = [];
      let lastError: string | null = null;
      let refreshed = integration;
      if (
        !integration.disconnectingAt &&
        !project?.gscSiteUrl &&
        integration.status === "active"
      ) {
        try {
          sites = await listGscSites(integration);
        } catch (error) {
          logError("[GSC] Failed to list sites", error);
          lastError = await toGscErrorMessage(error, "properties");
        }
        refreshed =
          (await getGscIntegration(input.organizationId)) ?? integration;
      }

      return {
        configured,
        connected: true,
        email: refreshed.googleAccountEmail,
        siteUrl: project?.gscSiteUrl ?? null,
        status: refreshed.status,
        lastSyncedAt: project?.gscLastSyncedAt?.toISOString() ?? null,
        lastError: project?.gscLastError ?? lastError,
        weeklySyncScheduled: refreshed.qstashScheduleId !== null,
        sites,
      };
    }),
  searchConsoleKeywords: authorizedProcedure
    .input(geoOrganizationInputSchema)
    .handler(async ({ context, input }): Promise<GscKeywordsResponse> => {
      await assertGeoAccess(accessParams({ context, input }));

      const [integration, scope] = await Promise.all([
        getGscIntegration(input.organizationId),
        runOrpcEffect(resolveGeoScope(input), toGeoOrpcError),
      ]);
      const project = scope.projectId
        ? await db.query.projects.findFirst({
            columns: { gscTopQueries: true },
            where: eq(projects.id, scope.projectId),
          })
        : null;
      return {
        keywords:
          integration && !integration.disconnectingAt
            ? (project?.gscTopQueries ?? [])
            : [],
      };
    }),
  searchConsoleSites: authorizedProcedure
    .input(geoOrganizationInputSchema)
    .handler(async ({ context, input }): Promise<GscSitesResponse> => {
      await assertGeoAccess(accessParams({ context, input }));

      const integration = await requireConnectedGscIntegration(
        input.organizationId
      );

      try {
        return { sites: await listGscSites(integration) };
      } catch (error) {
        logError("[GSC] Failed to list sites", error);
        throw badRequest(await toGscErrorMessage(error, "properties"));
      }
    }),
  searchConsoleSelectSite: authorizedProcedure
    .input(gscSelectSiteInputSchema)
    .handler(async ({ context, input }): Promise<GscSyncResult> => {
      await assertGeoAccess(accessParams({ context, input }));

      const integration = await requireConnectedGscIntegration(
        input.organizationId
      );

      let sites: Awaited<ReturnType<typeof listGscSites>>;
      try {
        sites = await listGscSites(integration);
      } catch (error) {
        logError("[GSC] Failed to verify property", error);
        throw badRequest(await toGscErrorMessage(error, "properties"));
      }
      if (!sites.some((site) => site.siteUrl === input.siteUrl)) {
        const tErrors = await getTranslations("errors.geo");
        throw badRequest(tErrors("propertyUnavailable"));
      }
      const { projectId } = await runOrpcEffect(
        requireGeoProject(input),
        toGeoOrpcError
      );

      let synced: GscSyncResult;
      try {
        synced = await Effect.runPromise(
          selectGscSiteAndSyncSuggestions(
            integration,
            input.siteUrl,
            projectId
          ).pipe(Effect.provide(geoCoreDashboardLayer))
        );
      } catch (error) {
        logError("[GSC] Initial sync failed after selecting property", error);
        throw badRequest(await toGscErrorMessage(error, "sync"));
      }
      if (synced.status !== "completed") {
        const tErrors = await getTranslations("errors.geo");
        throw badRequest(tErrors("gscChangedBeforeConnect"));
      }
      await runOrpcEffect(
        refreshGeoContentGapsBestEffort(input),
        toGeoOrpcError
      );

      const selectedIntegration = await getGscIntegration(input.organizationId);
      let scheduleId = selectedIntegration?.qstashScheduleId ?? null;
      if (selectedIntegration) {
        try {
          scheduleId = await ensureGscSchedule(selectedIntegration);
        } catch (error) {
          logError(
            "[GSC] Failed to schedule weekly sync after selecting property",
            error
          );
        }
      }

      trackGeoRouterEvent({
        context,
        input,
        event: POSTHOG_EVENTS.GSC_SITE_SELECTED,
        properties: {
          sync_status: synced.status,
          keywords: synced.keywords ?? 0,
          suggestions_created: synced.suggestionsAdded ?? 0,
          weekly_sync_scheduled: scheduleId !== null,
        },
      });
      return synced;
    }),
  searchConsoleSync: authorizedProcedure
    .input(geoOrganizationInputSchema)
    .handler(async ({ context, input }): Promise<GscSyncResult> => {
      await assertGeoAccess(accessParams({ context, input }));

      const { success: withinLimit } = await ratelimit.gscSync.limit(
        input.organizationId
      );
      trackGeoRouterEvent({
        context,
        input,
        event: POSTHOG_EVENTS.GSC_SYNC_REQUESTED,
        properties: { rate_limited: !withinLimit },
      });
      if (!withinLimit) {
        const tErrors = await getTranslations("errors.geo");
        throw badRequest(tErrors("tooManySyncs"));
      }

      const integration = await requireConnectedGscIntegration(
        input.organizationId
      );
      const { projectId } = await runOrpcEffect(
        requireGeoProject(input),
        toGeoOrpcError
      );
      const project = await db.query.projects.findFirst({
        columns: { gscSiteUrl: true },
        where: eq(projects.id, projectId),
      });
      if (!project?.gscSiteUrl) {
        const tErrors = await getTranslations("errors.geo");
        throw badRequest(tErrors("selectPropertyFirst"));
      }

      if (!integration.qstashScheduleId) {
        await ensureGscSchedule(integration);
      }

      return await runGscSyncOrBadRequest(input.organizationId, projectId);
    }),
  searchConsoleDisconnect: authorizedProcedure
    .input(geoOrganizationInputSchema)
    .handler(async ({ context, input }): Promise<{ disconnected: boolean }> => {
      await assertGeoAccess(accessParams({ context, input }));

      const integration = await withGscIntegrationLockOrServiceUnavailable(
        input.organizationId,
        async (signal, assertLockOwned) => {
          signal.throwIfAborted();
          const disconnecting = await beginGscIntegrationDisconnect(
            input.organizationId,
            signal,
            assertLockOwned
          );
          if (!disconnecting) {
            return null;
          }

          await assertLockOwned();
          if (!(await revokeGscToken(disconnecting))) {
            const tErrors = await getTranslations("errors.geo");
            throw serviceUnavailable(tErrors("gscDisconnectFailed"));
          }
          signal.throwIfAborted();

          const scheduleIds = getGscScheduleIdsForDisconnect(disconnecting);
          try {
            await Promise.all(scheduleIds.map(deleteGscScheduleIfPresent));
          } catch (error) {
            logError("[GSC] Failed to remove schedules on disconnect", error);
            const tErrors = await getTranslations("errors.geo");
            throw serviceUnavailable(tErrors("gscDisconnectFailed"));
          }
          signal.throwIfAborted();

          const deleted = await deleteGscIntegration(
            disconnecting,
            signal,
            assertLockOwned
          );
          if (!deleted) {
            const tErrors = await getTranslations("errors.geo");
            throw serviceUnavailable(tErrors("gscChangedDuringDisconnect"));
          }

          await Promise.all(scheduleIds.map(removeGscSchedule));
          return deleted;
        }
      );
      if (!integration) {
        return { disconnected: false };
      }
      const affectedProjects = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.organizationId, input.organizationId));
      await Promise.all(
        affectedProjects.map((project) =>
          runOrpcEffect(
            refreshGeoContentGapsBestEffort({
              organizationId: input.organizationId,
              projectId: project.id,
            }),
            toGeoOrpcError
          )
        )
      );
      trackGeoRouterEvent({
        context,
        input,
        event: POSTHOG_EVENTS.GSC_DISCONNECTED,
        properties: {
          had_site: integration.siteUrl !== null,
          had_schedule: integration.qstashScheduleId !== null,
        },
      });
      return { disconnected: true };
    }),
  suggestionsList: authorizedProcedure
    .input(geoOrganizationInputSchema)
    .handler(
      async ({ context, input }): Promise<GeoPromptSuggestionsResponse> => {
        await assertOrganizationAccess(accessParams({ context, input }));

        return await runOrpcEffect(listSuggestions(input), toGeoOrpcError);
      }
    ),
  autopilotPromptSuggestionsList: authorizedProcedure
    .input(geoOrganizationInputSchema)
    .handler(async ({ context, input }) => {
      await assertOrganizationAccess(accessParams({ context, input }));
      const result = await runOrpcEffect(
        listAutopilotPromptSuggestions(input),
        toGeoOrpcError
      );
      // Behind the Autopilot flag, like everything else Autopilot made.
      return (await isAutopilotEnabledForOrganization(input.organizationId))
        ? result
        : { ...result, suggestions: [] };
    }),
  suggestionAccept: authorizedProcedure
    .input(geoSuggestionIdInputSchema)
    .handler(async ({ context, input }): Promise<GeoTrackedPrompt> => {
      await assertGeoAccess(accessParams({ context, input }));

      const {
        projectId,
        prompt: accepted,
        suggestion,
      } = await runOrpcEffect(acceptSuggestion(input), toGeoOrpcError);
      await runOrpcEffect(
        refreshGeoContentGapsBestEffort(input),
        toGeoOrpcError
      );
      if (suggestion.action === "pause") {
        trackGeoRouterEvent({
          context,
          input,
          event: POSTHOG_EVENTS.GEO_SUGGESTION_ACCEPTED,
          projectId,
          properties: {
            count: 1,
            suggestion_id: suggestion.id,
            source: suggestion.source,
            action: suggestion.action,
          },
        });
        return accepted;
      }
      const keywordSummary = summarizeSuggestionKeywords(
        suggestion.sourceKeywords
      );
      trackGeoRouterEvent({
        context,
        input,
        event: POSTHOG_EVENTS.GEO_SUGGESTION_ACCEPTED,
        projectId,
        properties: {
          count: 1,
          suggestion_id: suggestion.id,
          impressions: keywordSummary.impressions,
          clicks: keywordSummary.clicks,
          position: keywordSummary.position,
        },
      });
      trackGeoRouterEvent({
        context,
        input,
        event: POSTHOG_EVENTS.GEO_PROMPT_ADDED,
        projectId,
        properties: {
          source: GEO_PROMPT_SOURCES.GSC_SUGGESTION,
          prompt_id: accepted.id,
        },
      });
      return accepted;
    }),
  suggestionsAcceptAll: authorizedProcedure
    .input(geoOrganizationInputSchema)
    .handler(async ({ context, input }): Promise<{ accepted: number }> => {
      await assertGeoAccess(accessParams({ context, input }));

      const { projectId, suggestions: rows } = await runOrpcEffect(
        acceptAllSuggestions(input),
        toGeoOrpcError
      );
      if (rows.length === 0) {
        return { accepted: 0 };
      }
      await runOrpcEffect(
        refreshGeoContentGapsBestEffort(input),
        toGeoOrpcError
      );

      const keywordSummary = summarizeSuggestionKeywords(
        rows.flatMap((row) => row.sourceKeywords)
      );
      trackGeoRouterEvent({
        context,
        input,
        event: POSTHOG_EVENTS.GEO_SUGGESTION_ACCEPTED_ALL,
        projectId,
        properties: {
          count: rows.length,
          impressions: keywordSummary.impressions,
          clicks: keywordSummary.clicks,
          position: keywordSummary.position,
        },
      });
      return { accepted: rows.length };
    }),
  suggestionDismiss: authorizedProcedure
    .input(geoSuggestionIdInputSchema)
    .handler(async ({ context, input }): Promise<{ dismissed: boolean }> => {
      await assertGeoAccess(accessParams({ context, input }));

      const result = await runOrpcEffect(
        dismissSuggestion(input),
        toGeoOrpcError
      );
      await runOrpcEffect(
        refreshGeoContentGapsBestEffort(input),
        toGeoOrpcError
      );
      trackGeoRouterEvent({
        context,
        input,
        event: POSTHOG_EVENTS.GEO_SUGGESTION_DISMISSED,
        properties: { count: 1, suggestion_id: result.suggestionId },
      });
      return { dismissed: true };
    }),
};
