import { AsyncLocalStorage } from "node:async_hooks";

import { Client } from "pg";

import type { AdvisoryLockSession } from "../types/advisory-session-lock";

const sessions = new AsyncLocalStorage<AdvisoryLockSession>();

/**
 * Session locks conflict with the editor's transaction locks. One dedicated
 * connection holds nested post + site locks while GitHub runs; no pooled
 * connection or SQL transaction is held across network calls. Closing the
 * session releases every lock, including on failure.
 */
export async function withAdvisorySessionLocks<T>(
  keys: string[][],
  run: () => Promise<T>
): Promise<T> {
  const session = sessions.getStore();
  if (session) {
    for (const parts of keys) {
      const key = JSON.stringify(parts);
      if (!session.keys.has(key)) {
        await session.client.query(
          "SELECT pg_advisory_lock(hashtextextended($1, 0))",
          [key]
        );
        session.keys.add(key);
      }
    }
    return await run();
  }
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10_000,
  });
  await client.connect();
  try {
    await client.query("SET lock_timeout = '30s'");
    return await sessions.run({ client, keys: new Set() }, () =>
      withAdvisorySessionLocks(keys, run)
    );
  } finally {
    await client.end();
  }
}
