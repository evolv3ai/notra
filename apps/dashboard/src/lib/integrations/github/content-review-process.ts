import { db } from "@notra/db/drizzle";
import { siteDrafts, siteBranchDrafts } from "@notra/db/schema";
import { requiresPullRequest } from "@notra/sites-server/utils/branch-protection";
import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";

import type { ContentReviewProcessInput } from "@/types/integrations/content-review-process";

export async function resolveContentReviewProcess(
  input: ContentReviewProcessInput
) {
  if (input.reviewProcess !== "direct") {
    return { direct: false };
  }
  if (await requiresPullRequest(input.repository, input.token, input.branch)) {
    return { direct: false, reason: "protected" as const };
  }
  if (input.siteId) {
    const siteId = input.siteId;
    const root = input.rootDirectory?.replace(/^\/+|\/+$/g, "");
    const path =
      root && input.path.startsWith(`${root}/`)
        ? input.path.slice(root.length + 1)
        : input.path;
    const branches = [
      input.branch,
      ...(input.targetBranch ? [input.targetBranch] : []),
    ];
    const pending = await Promise.all(
      [siteDrafts, siteBranchDrafts].map((table) =>
        db
          .select({ id: table.id })
          .from(table)
          .where(
            and(
              eq(table.siteId, siteId),
              inArray(table.branch, branches),
              eq(table.path, path),
              or(
                isNull(table.committedRevision),
                gt(table.revision, table.committedRevision)
              )
            )
          )
          .limit(1)
      )
    );
    if (pending.some((rows) => rows.length > 0)) {
      return { direct: false, reason: "draft" as const };
    }
  }
  return { direct: true };
}
