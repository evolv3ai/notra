import { db } from "@notra/db/drizzle";
import { sql } from "drizzle-orm";

import { SiteInputError } from "../errors/sites";
import type { SiteStorageTransaction } from "../types/deployments";

export async function withSiteBranchLock<T>(
  siteId: string,
  branch: string,
  run: (tx: SiteStorageTransaction) => Promise<T>,
  exclusive = false,
  onBusy?: () => Promise<T>
): Promise<T> {
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL lock_timeout = '2s'`);
      const key = JSON.stringify(["sites-branch", siteId, branch]);
      if (onBusy) {
        const result = await tx.execute(
          sql`select pg_try_advisory_xact_lock(hashtextextended(${key}, 0)) as acquired`
        );
        if (!result.rows[0]?.acquired) {
          return await onBusy();
        }
      } else {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`
        );
      }
      await lockSiteBranchEdits(tx, siteId, branch, exclusive);
      return await run(tx);
    });
  } catch (error) {
    throw branchLockError(error);
  }
}

export async function lockSiteBranchEdits(
  tx: SiteStorageTransaction,
  siteId: string,
  branch: string,
  exclusive = false
) {
  const key = JSON.stringify(["sites-branch-edits", siteId, branch]);
  try {
    await tx.execute(
      exclusive
        ? sql`SET LOCAL lock_timeout = '30s'`
        : sql`SET LOCAL lock_timeout = '2s'`
    );
    if (exclusive) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`
      );
    } else {
      await tx.execute(
        sql`select pg_advisory_xact_lock_shared(hashtextextended(${key}, 0))`
      );
    }
  } catch (error) {
    throw branchLockError(error);
  }
}

function branchLockError(error: unknown): unknown {
  const cause = error instanceof Error ? error.cause : null;
  if (
    [error, cause].some(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        Reflect.get(entry, "code") === "55P03"
    )
  ) {
    return new SiteInputError("Publish in progress, try again shortly");
  }
  return error;
}
