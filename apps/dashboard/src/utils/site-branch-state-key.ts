import type { SiteBranchStatus } from "@/types/site-branches";
export function siteBranchStateKey(
  pr: SiteBranchStatus["pullRequest"] | undefined
) {
  if (pr?.state === "MERGED") {
    return "merged";
  }
  if (pr?.state === "CLOSED") {
    return "closed";
  }
  return !pr || pr.isDraft ? "draft" : "open";
}
