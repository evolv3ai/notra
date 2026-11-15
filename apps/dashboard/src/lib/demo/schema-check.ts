import { db } from "@notra/db/drizzle";
import * as schema from "@notra/db/schema";
import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  return error.cause instanceof Error ? error.cause.message : error.message;
}

/**
 * Selects every column of every table this build knows, without reading
 * rows. Fails when the demo database is behind the code's migrations or the
 * app role cannot read a table, which a liveness probe never notices.
 */
export async function checkDemoDatabaseSchema(): Promise<number> {
  const tables = Object.values(schema).filter((value) => is(value, PgTable));
  await Promise.all(
    tables.map((table) =>
      db
        .select()
        .from(table)
        .limit(0)
        .catch((error: unknown) => {
          throw new Error(`${getTableName(table)}: ${errorMessage(error)}`);
        })
    )
  );
  return tables.length;
}
