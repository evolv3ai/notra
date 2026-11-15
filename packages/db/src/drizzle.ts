import { attachDatabasePool } from "@vercel/functions";
import { upstashCache } from "drizzle-orm/cache/upstash";
import { drizzle } from "drizzle-orm/node-postgres";

// biome-ignore lint/performance/noNamespaceImport: Required for drizzle-kit
import * as schema from "./schema";
import type { Database } from "./types/database";

const databaseUrl = process.env.DATABASE_URL;
const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const dbByUrl = new Map<string, Database>();

function createQueryCache(url: string, token: string) {
  const cache = upstashCache({ url, token, global: false });
  cache.onMutate = async () => {};
  return cache;
}

export function createDb(
  databaseUrl: string,
  maximumConnections?: number
): Database {
  const connectionKey = JSON.stringify([
    databaseUrl,
    maximumConnections ?? null,
  ]);
  const cached = dbByUrl.get(connectionKey);
  if (cached) {
    return cached;
  }

  const client = drizzle({
    connection: {
      connectionString: databaseUrl,
      connectionTimeoutMillis: 10_000,
      max: maximumConnections,
    },
    cache:
      upstashUrl && upstashToken
        ? createQueryCache(upstashUrl, upstashToken)
        : undefined,
    schema,
  });
  // Fluid compute suspends idle instances; this closes idle clients first so a
  // resumed instance does not hand out connections the server already dropped.
  attachDatabasePool(client.$client);
  // pg emits "error" when the server drops an idle client. Without a listener
  // that is an uncaught exception and kills long-running processes.
  client.$client.on("error", (error) => {
    console.error("[db] Idle client error", error);
  });
  dbByUrl.set(connectionKey, client);
  return client;
}

function createMissingDatabaseUrlProxy(): Database {
  return new Proxy({} as Database, {
    get() {
      throw new Error("[ENV]: DATABASE_URL is not defined");
    },
  });
}

export const db: Database = databaseUrl
  ? createDb(databaseUrl)
  : createMissingDatabaseUrlProxy();
