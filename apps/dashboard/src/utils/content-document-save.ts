import { CONTENT_CHECKPOINT_RETRYABLE_CODES } from "@/constants/content-document-save";
import type { SavedContentDocument } from "@/types/content/document-save";
import type { ContentApiResponse } from "@/types/hooks/content";

export function mergeSavedContentDetail(
  current: ContentApiResponse | undefined,
  document: SavedContentDocument
): ContentApiResponse | undefined {
  if (
    !current ||
    current.content.id !== document.id ||
    current.content.revision > document.revision
  ) {
    return current;
  }

  return {
    ...current,
    content: {
      ...current.content,
      title: document.title,
      slug: document.slug,
      markdown: document.markdown,
      content: document.content,
      revision: document.revision,
    },
  };
}

export function isContentSaveConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "CONFLICT"
  );
}

export function isTransientContentCheckpointError(error: unknown): boolean {
  if (typeof error === "object" && error !== null) {
    if ("code" in error && typeof error.code === "string") {
      return CONTENT_CHECKPOINT_RETRYABLE_CODES.has(error.code);
    }
    if ("status" in error && typeof error.status === "number") {
      return (
        error.status >= 500 || error.status === 408 || error.status === 429
      );
    }
  }
  return error instanceof Error;
}
