import type { db } from "../drizzle";

export function retainDatabaseConnections(pool: (typeof db)["$client"]) {
  pool.options.idleTimeoutMillis = 0;
}
