export const GEO_INGEST_FIRST_HIT_KEY_PREFIX = "geo:ingest-first-hit:v1";
export const GEO_INGEST_FIRST_HIT_MEMO_MAX_ENTRIES = 1024;
export const GEO_INGEST_RECEIVED_SAMPLE_RATE = 0.01;
export const GEO_INGEST_RECEIVED_SAMPLE_DENOMINATOR = 100;
export const GEO_INGEST_DROPPED_LOG_SAMPLE_RATE = 0.05;
export const GEO_INGEST_ERROR_MESSAGE_MAX_LENGTH = 200;
export const GEO_INGEST_RATELIMIT_TIMEOUT_MS = 1000;
export const GEO_INGEST_REDIS_RETRIES = 1;
export const GEO_INGEST_ADMISSION_RATELIMIT_PREFIX =
  "ratelimit:geo-ingest-admission";
export const GEO_INGEST_ADMISSION_RATELIMIT_MAX_REQUESTS = 1000;
export const WEB_INGEST_RATELIMIT_PREFIX = "ratelimit:web-ingest";
export const WEB_INGEST_RATELIMIT_MAX_REQUESTS = 20_000;
export const GEO_INGEST_TINYBIRD_TIMEOUT_MS = 5000;
export const GEO_INGEST_MAX_CLOCK_SKEW_FUTURE_MS = 5 * 60 * 1000;
export const GEO_INGEST_MAX_EVENT_AGE_MS = 24 * 60 * 60 * 1000;
export const GEO_INGEST_FLUSH_MAX_ROWS = 1000;
export const GEO_INGEST_MAX_BUFFERED_EVENTS = 50_000;
export const GEO_INGEST_FLUSH_TIMEOUT_MS = 10_000;
export const GEO_INGEST_LIVE_FLUSH_DELAY_MS = 1000;
export const GEO_INGEST_LIVE_RETRY_DELAY_MS = 5000;
export const GEO_INGEST_LIVE_MAX_RETRIES = 3;
export const GEO_DRAIN_MAX_BODY_BYTES = 16 * 1024 * 1024;
export const GEO_DRAIN_MAX_DECOMPRESSED_BYTES = 128 * 1024 * 1024;
export const GEO_DRAIN_CONCURRENCY = 16;
export const GEO_DRAIN_DEDUPE_KEY_PREFIX = "geo:drain-request:v1";
export const GEO_DRAIN_DEDUPE_TTL_SECONDS = 60 * 60;
export const GEO_DRAIN_GZIP_MAGIC = [0x1f, 0x8b] as const;
export const GEO_DRAIN_RETRYABLE_OUTCOMES = ["rate_limited", "failed"] as const;
export const GEO_DRAIN_CLOUDFLARE_EYEBALL_SOURCE = "eyeball";
export const GEO_DRAIN_TRACING_HEADERS = ["traceparent", "b3", "x-b3-traceid"];
export const GEO_DRAIN_HTTP_STATUS_RANGE = { min: 100, max: 599 } as const;
export const GEO_DRAIN_EPOCH_THRESHOLDS = {
  nanoseconds: 1e17,
  microseconds: 1e14,
  milliseconds: 1e11,
} as const;
export const GEO_DRAIN_NUMERIC_TIMESTAMP_PATTERN = /^\d+(\.\d+)?$/;
