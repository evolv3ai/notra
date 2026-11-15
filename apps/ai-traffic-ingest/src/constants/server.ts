export const INGEST_MAX_BODY_BYTES = 256 * 1024;
export const INGEST_DEFAULT_PORT = 3101;
// Nominal shutdown budget: 35s drain + 12s concurrent batcher stops + 2s
// database close + 10s log flush = 59s. Verify the host's termination grace;
// forced exits can lose buffered events.
export const INGEST_DRAIN_TIMEOUT_MS = 35_000;
export const INGEST_EVENTS_FLUSH_TIMEOUT_MS = 12_000;
export const INGEST_FLUSH_TIMEOUT_MS = 10_000;
export const INGEST_DATABASE_CLOSE_TIMEOUT_MS = 2_000;
export const INGEST_RUNTIME_LOG_INTERVAL_MS = 60_000;
export const INGEST_REQUIRED_ENV = [
  "DATABASE_URL",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "TINYBIRD_TOKEN",
] as const;
