import { fileURLToPath } from "node:url";

import { requireTestDatabaseUrl } from "./utils/database";

const started = performance.now();
process.env.DATABASE_URL = requireTestDatabaseUrl();
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";
const { createDb } = await import("../../../packages/db/src/drizzle");
const { migrate } = await import("drizzle-orm/node-postgres/migrator");
const db = createDb(process.env.DATABASE_URL, 1);
try {
  await migrate(db, {
    migrationsFolder: fileURLToPath(
      new URL("../../../packages/db/migrations", import.meta.url)
    ),
  });
  console.log(
    JSON.stringify({
      command: "migrate",
      durationMs: +(performance.now() - started).toFixed(2),
    })
  );
} finally {
  await db.$client.end();
}
