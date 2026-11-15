import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import * as schema from "@notra/db/schema";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { drizzle } from "drizzle-orm/pglite";

/** Real committed migrations, fresh PostgreSQL semantics, no connection URL or network. */
export async function createAutopilotSandbox() {
  const postgres = new PGlite();
  const db = drizzle(postgres, { schema });
  try {
    const migrations = readMigrationFiles({
      migrationsFolder: fileURLToPath(
        new URL("../../../../packages/db/migrations", import.meta.url)
      ),
    });
    // The baseline contains several commands per statement; PGlite's prepared
    // query API cannot execute it, but exec can. Preserve journal ordering.
    for (const migration of migrations) {
      await postgres.exec("BEGIN");
      for (const statement of migration.sql) {
        await postgres.exec(statement);
      }
      await postgres.exec("COMMIT");
    }
    return { postgres, db };
  } catch (error) {
    await postgres.close();
    throw error;
  }
}
