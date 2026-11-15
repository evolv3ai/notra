import type { generateRepoImage } from "@notra/ai/agents/repo-image";
import { RepoImageError } from "@notra/ai/agents/repo-image-agent";
import { calculateAiCreditCostCents } from "@notra/ai/billing/ai-credit-cost";
import {
  allowUnmeteredAiInDevelopment,
  autumn,
} from "@notra/ai/billing/autumn";
import { FEATURES } from "@notra/ai/billing/features";
import { IMAGE_GEN_MODEL_ID } from "@notra/ai/constants/repo-image";
import { maybeGenerateCollectionTitle } from "@notra/ai/jobs/collection-title";
import type { GenerateRepoImageResult } from "@notra/ai/types/repo-image";
import {
  readDiagramRevision,
  readDiagramSpec,
  readImageFormat,
} from "@notra/ai/utils/diagram-metadata";
import {
  uploadGeneratedExcalidrawAsset,
  uploadGeneratedHtmlAsset,
  uploadGeneratedImageAsset,
} from "@notra/ai/utils/image-assets";
import { ensureChatPostCollection } from "@notra/ai/utils/post-service";
import { logError, logInfo } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { postCollections, posts } from "@notra/db/schema";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { captureServerEvent, flushPostHogServer } from "@notra/posthog/server";
import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * Uploads the editable Excalidraw scene for diagram images and returns the
 * metadata fields the dashboard reads to offer Excalidraw/tldraw export.
 */
async function buildImageFormatMetadata(params: {
  organizationId: string;
  postId: string;
  result: Pick<
    GenerateRepoImageResult,
    "format" | "excalidrawScene" | "diagramSpec"
  >;
}) {
  if (params.result.format !== "diagram" || !params.result.excalidrawScene) {
    return {
      format: params.result.format,
      excalidrawUrl: null,
      diagramSpec: null,
    };
  }

  const excalidrawUrl = await uploadGeneratedExcalidrawAsset({
    organizationId: params.organizationId,
    postId: params.postId,
    scene: params.result.excalidrawScene,
  });
  return {
    format: params.result.format,
    excalidrawUrl,
    diagramSpec: params.result.diagramSpec ?? null,
  };
}

export async function buildRevisionSourceMetadata(params: {
  organizationId: string;
  postId: string;
  integrationId: string;
  branch: string;
  prompt: string;
  result: Awaited<ReturnType<typeof generateRepoImage>>;
}) {
  const post = await db.query.posts.findFirst({
    where: and(
      eq(posts.id, params.postId),
      eq(posts.organizationId, params.organizationId)
    ),
  });
  const existing =
    post?.sourceMetadata &&
    typeof post.sourceMetadata === "object" &&
    !Array.isArray(post.sourceMetadata)
      ? post.sourceMetadata
      : {};
  const formatMetadata = await buildImageFormatMetadata({
    organizationId: params.organizationId,
    postId: params.postId,
    result: params.result,
  });

  return {
    ...existing,
    ...formatMetadata,
    type: "generated_image",
    integrationId: params.integrationId,
    branch: params.branch,
    brandIdentityId:
      params.result.brandIdentityId ?? getStoredBrandIdentityId(existing),
    mode: "prompt",
    prompt: params.prompt,
    sourcePostId: params.postId,
    sandbox: params.result.sandbox,
    usage: params.result.usage ?? null,
    ...(params.result.format === "diagram"
      ? { diagramRevision: readDiagramRevision(existing) + 1 }
      : {}),
  };
}

export async function trackImageGenerationUsage(params: {
  organizationId: string;
  postId: string;
  usage: Awaited<ReturnType<typeof generateRepoImage>>["usage"];
  useMarkup?: boolean;
  chargeAiCredits?: boolean;
}) {
  if (
    !autumn ||
    allowUnmeteredAiInDevelopment ||
    !params.usage ||
    params.chargeAiCredits === false
  ) {
    return;
  }

  const model = params.usage.modelId ?? IMAGE_GEN_MODEL_ID;
  const markupApplied = params.useMarkup ?? false;
  const cost = calculateAiCreditCostCents(params.usage, model, markupApplied);

  logInfo("[Autumn] Marketing asset usage cost comparison", {
    organizationId: params.organizationId,
    postId: params.postId,
    model,
    billingBasis: cost.billingBasis,
    computedCostCents: cost.costCents,
    reportedCostCents: cost.reportedCostCents,
    tokenCostCents: cost.tokenCostCents,
    reportedTotalUsd: params.usage.totalUsd,
    inputTokens: params.usage.inputTokens,
    outputTokens: params.usage.outputTokens,
    cacheReadTokens: params.usage.cacheReadTokens,
    cacheWriteTokens: params.usage.cacheWriteTokens,
    totalTokens: params.usage.totalTokens,
    markupApplied,
  });

  try {
    await autumn.track({
      customerId: params.organizationId,
      featureId: FEATURES.AI_CREDITS,
      value: cost.costCents,
      properties: {
        source: "marketing_assets",
        post_id: params.postId,
        model,
        billing_basis: cost.billingBasis,
        input_tokens: params.usage.inputTokens,
        output_tokens: params.usage.outputTokens,
        cache_read_tokens: params.usage.cacheReadTokens,
        cache_write_tokens: params.usage.cacheWriteTokens,
        total_tokens: params.usage.totalTokens,
        sandbox_total_usd: params.usage.totalUsd,
        markup_applied: markupApplied,
        cost_cents: cost.costCents,
        reported_cost_cents: cost.reportedCostCents,
        token_cost_cents: cost.tokenCostCents,
      },
    });
    captureServerEvent({
      event: POSTHOG_EVENTS.AI_CREDITS_CHARGED,
      organizationId: params.organizationId,
      properties: {
        cost_cents: cost.costCents,
        source: "marketing_assets",
        model,
        billing_basis: cost.billingBasis,
        input_tokens: params.usage.inputTokens,
        output_tokens: params.usage.outputTokens,
        cache_read_tokens: params.usage.cacheReadTokens,
        cache_write_tokens: params.usage.cacheWriteTokens,
        total_tokens: params.usage.totalTokens,
        markup_applied: markupApplied,
        post_id: params.postId,
      },
    });
    await flushPostHogServer();
  } catch (error) {
    logError("[Autumn] Track error after marketing asset generation", error, {
      customerId: params.organizationId,
      postId: params.postId,
    });
  }
}

export async function getImageSnapshot(organizationId: string, postId: string) {
  const post = await db.query.posts.findFirst({
    where: and(eq(posts.id, postId), eq(posts.organizationId, organizationId)),
  });

  if (!post) {
    throw new RepoImageError("not_found", "Source image post not found");
  }

  const metadata = post.sourceMetadata;
  if (
    !metadata ||
    typeof metadata !== "object" ||
    !("sandbox" in metadata) ||
    typeof metadata.sandbox !== "object" ||
    metadata.sandbox === null ||
    !("snapshotId" in metadata.sandbox) ||
    typeof metadata.sandbox.snapshotId !== "string"
  ) {
    throw new RepoImageError(
      "invalid_source",
      "Source image post does not have a sandbox snapshot"
    );
  }

  const boxId =
    "boxId" in metadata.sandbox && typeof metadata.sandbox.boxId === "string"
      ? metadata.sandbox.boxId
      : undefined;
  const brandIdentityId = getStoredBrandIdentityId(metadata) ?? undefined;

  return {
    boxId,
    snapshotId: metadata.sandbox.snapshotId,
    brandIdentityId,
    diagramSpec: readDiagramSpec(metadata),
    format: readImageFormat(metadata),
  };
}

function getStoredBrandIdentityId(metadata: object) {
  if (
    "brandIdentityId" in metadata &&
    typeof metadata.brandIdentityId === "string"
  ) {
    return metadata.brandIdentityId;
  }

  if ("brandVoiceId" in metadata && typeof metadata.brandVoiceId === "string") {
    return metadata.brandVoiceId;
  }

  return null;
}

export async function saveGeneratedImagePost(params: {
  chatId?: string;
  organizationId: string;
  title: string;
  postId?: string;
  collectionId?: string;
  pngBase64: string;
  html: string;
  sourceMetadata: Record<string, unknown>;
  result?: Pick<
    GenerateRepoImageResult,
    "format" | "excalidrawScene" | "diagramSpec"
  >;
}) {
  const postId = params.postId ?? nanoid();
  const [imageUrl, htmlUrl, formatMetadata] = await Promise.all([
    uploadGeneratedImageAsset({
      organizationId: params.organizationId,
      pngBase64: params.pngBase64,
      postId,
    }),
    uploadGeneratedHtmlAsset({
      organizationId: params.organizationId,
      html: params.html,
      postId,
    }),
    params.result
      ? buildImageFormatMetadata({
          organizationId: params.organizationId,
          postId,
          result: params.result,
        })
      : null,
  ]);
  const sourceMetadata = { ...params.sourceMetadata, ...formatMetadata };

  if (params.collectionId) {
    const ownedCollection = await db.query.postCollections.findFirst({
      columns: { id: true },
      where: and(
        eq(postCollections.id, params.collectionId),
        eq(postCollections.organizationId, params.organizationId)
      ),
    });
    if (!ownedCollection) {
      throw new Error("The collection does not belong to this organization");
    }
    await insertGeneratedImagePost({
      collectionId: params.collectionId,
      htmlUrl,
      imageUrl,
      incrementCollectionCount: true,
      organizationId: params.organizationId,
      postId,
      sourceMetadata,
      title: params.title,
    });
    return { imageUrl, postId };
  }

  const collectionId = await ensureChatPostCollection({
    organizationId: params.organizationId,
    chatId: params.chatId,
    contentType: "image",
  });

  await insertGeneratedImagePost({
    collectionId,
    htmlUrl,
    imageUrl,
    organizationId: params.organizationId,
    postId,
    sourceMetadata,
    title: params.title,
  });

  await maybeGenerateCollectionTitle({
    collectionId,
    organizationId: params.organizationId,
  });

  return { imageUrl, postId };
}

async function insertGeneratedImagePost(params: {
  collectionId: string;
  htmlUrl: string;
  imageUrl: string;
  organizationId: string;
  postId: string;
  sourceMetadata: Record<string, unknown>;
  title: string;
  incrementCollectionCount?: boolean;
}) {
  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(posts)
      .values({
        id: params.postId,
        organizationId: params.organizationId,
        collectionId: params.collectionId,
        title: params.title,
        slug: null,
        content: params.imageUrl,
        htmlUrl: params.htmlUrl,
        markdown: null,
        recommendations: null,
        contentType: "image",
        status: "draft",
        sourceMetadata: params.sourceMetadata,
      })
      .onConflictDoNothing({ target: posts.id })
      .returning({ id: posts.id });

    if (inserted.length === 0 || !params.incrementCollectionCount) {
      return;
    }

    await tx
      .update(postCollections)
      .set({
        completedPostCount: sql`${postCollections.completedPostCount} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(postCollections.id, params.collectionId),
          eq(postCollections.organizationId, params.organizationId)
        )
      );
  });
}
