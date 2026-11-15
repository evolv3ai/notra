import { siteBranchDrafts } from "@notra/db/schema";
import { and, eq, notExists } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { SiteInputError } from "../errors/sites";
import type { SiteStorageTransaction } from "../types/deployments";

/** Caller holds both edit locks. Preserve conflicting target content rather than overwrite it. */
export async function moveSiteBranchDrafts(
  tx: SiteStorageTransaction,
  siteId: string,
  from: string,
  to: string
) {
  const drafts = await tx
    .select({ id: siteBranchDrafts.id, path: siteBranchDrafts.path })
    .from(siteBranchDrafts)
    .where(
      and(
        eq(siteBranchDrafts.siteId, siteId),
        eq(siteBranchDrafts.branch, from)
      )
    );
  const occupied = alias(siteBranchDrafts, "occupied");
  for (const draft of drafts) {
    const moved = await tx
      .update(siteBranchDrafts)
      .set({ branch: to })
      .where(
        and(
          eq(siteBranchDrafts.id, draft.id),
          notExists(
            tx
              .select({ id: occupied.id })
              .from(occupied)
              .where(
                and(
                  eq(occupied.siteId, siteId),
                  eq(occupied.branch, to),
                  eq(occupied.path, draft.path)
                )
              )
          )
        )
      )
      .returning({ id: siteBranchDrafts.id });
    if (moved.length === 0) {
      throw new SiteInputError(
        "The target branch already has drafts. Choose another name."
      );
    }
  }
}
