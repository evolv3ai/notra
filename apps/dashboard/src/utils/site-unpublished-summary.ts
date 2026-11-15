import type { SiteUnpublishedTitle } from "@/types/components/sites";

/** Names sections when only Design changed, files when only files did, neither when both. */
export function siteUnpublishedTitle({
  sections,
  files,
  drafts,
  branchFiles,
}: {
  sections: number;
  files: number;
  drafts: number;
  branchFiles: number;
}): SiteUnpublishedTitle {
  const committed = Math.max(0, branchFiles - drafts);
  if (sections > 0 && files === 0 && committed === 0) {
    return { key: "unpublishedTitle", count: sections };
  }
  if (sections === 0) {
    return {
      key: "unpublishedFilesTitle",
      count: Math.max(drafts, branchFiles, 1),
    };
  }
  return { key: "unpublishedMixedTitle", count: 0 };
}

/** The changes to name, and how many collapse into "N more" (committed branch files included). */
export function splitVisibleChanges<T>(
  items: readonly T[],
  committed: number,
  limit: number
): { visible: readonly T[]; more: number } {
  const total = items.length + (committed > 0 ? 1 : 0);
  const visible = total > limit ? items.slice(0, limit - 1) : items;
  return { visible, more: items.length - visible.length + committed };
}
