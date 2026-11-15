import { GEO_WRITER_TRIGGER_ID } from "@notra/geo-core/constants/geo";
import { sourceMetadataSchema } from "@notra/schemas/dashboard/content";

import type {
  ContentArticleLoadingInput,
  GeoGapsWriteEntry,
  WriteDialogInitialState,
} from "@/types/components/geo-writer";
import { normalizeGeoProjectId } from "@/utils/geo-hydration";
import { isNotFoundError } from "@/utils/orpc-errors";

export function geoContentPath(
  organizationSlug: string,
  postId: string
): string {
  return `/${organizationSlug}/content/${postId}`;
}

export function writeDialogStateFromGap(
  input: GeoGapsWriteEntry
): WriteDialogInitialState {
  const mentioned = input.mentionedEngines?.length ?? 0;
  const missing = input.missingEngines?.length ?? 0;
  const total = mentioned + missing;
  return {
    sourceKind: "gap",
    sourceId: input.promptId,
    topic: input.prompt,
    baseline:
      total > 0 ? { mentionedEngines: mentioned, totalEngines: total } : null,
    mentionedCompetitors: [...(input.mentionedCompetitors ?? [])],
  };
}

export function emptyWriteDialogState(): WriteDialogInitialState {
  return { sourceKind: "manual" };
}

export function parseGeoWriterDraft(sourceMetadata: unknown): {
  briefId: string;
  projectId?: string;
} | null {
  const parsed = sourceMetadataSchema.safeParse(sourceMetadata);
  if (!parsed.success || !parsed.data) {
    return null;
  }
  if (parsed.data.triggerId !== GEO_WRITER_TRIGGER_ID || !parsed.data.briefId) {
    return null;
  }
  return {
    briefId: parsed.data.briefId,
    projectId: normalizeGeoProjectId(parsed.data.projectId),
  };
}

function isGeoWriterPlanReviewable(status: string | undefined): boolean {
  return status === "draft" || status === "failed";
}

export function getGeoWriterDocumentState(
  hasDraft: boolean,
  briefError: unknown,
  briefStatus: string | undefined,
  isPostStillPlan: boolean
) {
  const hasBriefError = briefError !== null && briefError !== undefined;
  const isBriefMissing = hasBriefError && isNotFoundError(briefError);
  const isBriefError = hasBriefError && !isBriefMissing;
  const isBriefReviewable = isGeoWriterPlanReviewable(briefStatus);
  return {
    isBriefError,
    isBriefMissing,
    isChatLocked:
      hasDraft &&
      !isBriefMissing &&
      !isBriefReviewable &&
      briefStatus !== "completed",
    isPlanMode:
      hasDraft &&
      (isPostStillPlan ||
        (!isBriefMissing &&
          (briefStatus === undefined ||
            briefStatus === "approved" ||
            briefStatus === "writing"))),
    // An article saved over the outline (e.g. through the API) leaves the
    // brief in draft; it must be edited as an article, not as a plan.
    isPlanReviewable: isBriefReviewable && isPostStillPlan,
  };
}

export function getContentArticleLoadingState(
  input: ContentArticleLoadingInput
) {
  const completedArticleStale =
    input.briefStatus === "completed" &&
    input.isPostStillPlan &&
    input.loadedArticleBriefId !== input.briefId;
  return {
    shouldLoadArticle: Boolean(
      input.briefId &&
      input.briefStatus &&
      (input.briefStatus !== "completed" || completedArticleStale) &&
      input.pendingArticleBriefId !== input.briefId
    ),
    isGeoArticleLoading: Boolean(
      input.hasDraft &&
      input.briefStatus === "completed" &&
      input.pendingArticleBriefId === input.briefId &&
      input.loadedArticleBriefId !== input.briefId
    ),
  };
}
