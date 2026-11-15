import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { autopilotNamespaceDeletions } from "@notra/db/schema";
import { and, asc, eq, lte } from "drizzle-orm";

import { AUTOPILOT_NAMESPACE_CLEANUP_BUDGET_MS } from "@/constants/autopilot";
import { deleteAutopilotMemory } from "@/lib/autopilot/memory";

/** Only committed organization deletions are visible here, even after account deletion. */
export async function cleanupAutopilotNamespaces(
  now = new Date(),
  signal = AbortSignal.timeout(AUTOPILOT_NAMESPACE_CLEANUP_BUDGET_MS)
) {
  const due = lte(autopilotNamespaceDeletions.nextAttemptAt, now);
  const rows = await db
    .select()
    .from(autopilotNamespaceDeletions)
    .where(due)
    .orderBy(asc(autopilotNamespaceDeletions.nextAttemptAt))
    .limit(100);
  let failed = 0;
  for (const row of rows) {
    if (signal.aborted) {
      failed = Math.max(failed, 1);
      break;
    }
    try {
      // Await the retry write and transaction release even when the request aborts.
      const cleanupFailed = await db.transaction(async (tx) => {
        const condition = and(
          due,
          eq(autopilotNamespaceDeletions.organizationId, row.organizationId)
        );
        const [claimed] = await tx
          .select()
          .from(autopilotNamespaceDeletions)
          .where(condition)
          .for("update", { skipLocked: true });
        if (!claimed) {
          return false;
        }
        try {
          signal.throwIfAborted();
          await deleteAutopilotMemory(row.organizationId, signal);
        } catch (error) {
          logError("[Autopilot] Namespace cleanup will retry", error, {
            organizationId: row.organizationId,
          });
          await tx
            .update(autopilotNamespaceDeletions)
            .set({ nextAttemptAt: new Date(now.getTime() + 300_000) })
            .where(condition);
          return true;
        }
        // If this write/commit fails, the retained row retries the idempotent DELETE.
        await tx.delete(autopilotNamespaceDeletions).where(condition);
        return false;
      });
      if (cleanupFailed) {
        failed += 1;
      }
    } catch (error) {
      failed += 1;
      logError("[Autopilot] Namespace cleanup transaction failed", error, {
        organizationId: row.organizationId,
      });
    }
  }
  return { checked: rows.length, failed };
}
