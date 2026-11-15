import type { Client } from "pg";

export interface AdvisoryLockSession {
  client: Client;
  keys: Set<string>;
}
