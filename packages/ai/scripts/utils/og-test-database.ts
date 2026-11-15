import { PGlite } from "@electric-sql/pglite";
import * as schema from "@notra/db/schema";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { drizzle } from "drizzle-orm/pglite";

export async function createOgTestDatabase() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  // The baseline contains multiple SQL commands per breakpoint; PGlite's
  // prepared-query migrator rejects those. Replay the committed SQL via exec.
  for (const migration of readMigrationFiles({
    migrationsFolder: new URL("../../../db/migrations", import.meta.url)
      .pathname,
  })) {
    await client.transaction(async (transaction) => {
      for (const statement of migration.sql) {
        await transaction.exec(statement);
      }
    });
  }
  const organizationId = `og-test-${crypto.randomUUID()}`;
  await db.insert(schema.organizations).values({
    id: organizationId,
    name: "OG local verification",
    slug: organizationId,
    createdAt: new Date(),
  });
  return { client, db, organizationId };
}
