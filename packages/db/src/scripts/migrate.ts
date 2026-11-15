import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const migrationsFolder = process.argv[2];
const databaseUrl =
  process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;

if (!migrationsFolder) {
  throw new Error("Usage: migrate <migrations-folder>");
}
if (!databaseUrl) {
  throw new Error("MIGRATION_DATABASE_URL or DATABASE_URL must be defined");
}

const db = drizzle({ connection: { connectionString: databaseUrl } });
try {
  await migrate(db, { migrationsFolder });
  console.log("[migrate] migrations applied");
} finally {
  await db.$client.end();
}
