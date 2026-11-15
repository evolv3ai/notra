import { sql } from "drizzle-orm";

import type { AdvisoryXactLockOptions } from "../types/advisory-xact-lock";
import type { Database } from "../types/database";

/**
 * Takes a transaction-scoped advisory lock on hashtextextended(key, 0); it is
 * released at commit or rollback. Resolves false only when `try` is set and
 * the lock is busy.
 */
export async function advisoryXactLock(
  tx: Pick<Database, "execute">,
  key: string,
  options: AdvisoryXactLockOptions = {}
): Promise<boolean> {
  const lockFunction = sql.raw(
    `pg${options.try ? "_try" : ""}_advisory_xact_lock${options.shared ? "_shared" : ""}`
  );
  const result = await tx.execute<{ acquired: boolean | null }>(
    sql`select ${lockFunction}(hashtextextended(${key}, 0)) as acquired`
  );
  return options.try ? result.rows[0]?.acquired === true : true;
}
