import { db } from "@notra/db/drizzle";
import { sql } from "drizzle-orm";

export async function withInthProjectLock<T>(
  projectId: string,
  run: () => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`inth-project:${projectId}`}, 0))`
    );
    return await run();
  });
}
