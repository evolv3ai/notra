export const REDIS_TEST_CONTAINER = /^notra-dashboard-redis-e2e-[a-f0-9-]+$/;
export const REDIS_TEST_LABEL = "notra.dashboard-redis-e2e";
export const REDIS_TEST_LABEL_VALUE = "isolated-test";
export const REDIS_REST_MAX_BODY_BYTES = 1024 * 1024;
export const REDIS_TRANSACTION_CONTROL_COMMANDS = new Set([
  "MULTI",
  "EXEC",
  "DISCARD",
  "WATCH",
  "UNWATCH",
  "RESET",
  "QUIT",
]);
