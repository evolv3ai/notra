import { siteBranchDrafts, siteDrafts } from "@notra/db/schema";

/** Keep the previous deployment's site/path upsert working during promotion. */
export function siteDraftTable(branch: string, productionBranch: string) {
  return branch === productionBranch ? siteDrafts : siteBranchDrafts;
}
