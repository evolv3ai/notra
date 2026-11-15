import { ORPCError } from "@orpc/client";
import type { FileDiffMetadata, ThemeTypes } from "@pierre/diffs";

import type {
  SiteDraftSaveState,
  SiteDraftChange,
  SiteDiffLineCounts,
} from "@/types/site-drafts";
import type { SiteEditorDraft } from "@/types/sites";

export function publishConflictPaths(error: unknown): string[] | null {
  if (!(error instanceof ORPCError) || error.code !== "CONFLICT") {
    return null;
  }
  const data: unknown = error.data;
  if (
    typeof data === "object" &&
    data !== null &&
    "paths" in data &&
    Array.isArray(data.paths)
  ) {
    return data.paths.filter(
      (path): path is string => typeof path === "string"
    );
  }
  return [];
}

export function isSiteDraftUnsaved(saveState: SiteDraftSaveState): boolean {
  return saveState.status !== "idle" && saveState.status !== "saved";
}

export function diffLineCounts(fileDiff: FileDiffMetadata): SiteDiffLineCounts {
  let additions = 0;
  let deletions = 0;
  for (const hunk of fileDiff.hunks) {
    additions += hunk.additionLines;
    deletions += hunk.deletionLines;
  }
  return { additions, deletions };
}

export function siteCodeThemeType(
  resolvedTheme: string | undefined
): ThemeTypes {
  if (resolvedTheme === "light" || resolvedTheme === "dark") {
    return resolvedTheme;
  }
  return "system";
}

export function siteDraftChange(
  draft: SiteEditorDraft,
  sourcePaths: ReadonlySet<string>
): SiteDraftChange {
  if (draft.deleted) {
    return "deleted";
  }
  return sourcePaths.has(draft.path) ? "modified" : "added";
}
