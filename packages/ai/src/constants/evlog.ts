import type {
  GatewayLimitDescription,
  GatewayLimitType,
} from "@notra/ai/types/gateway-limit";

export const DEFAULT_AXIOM_AI_DATASET = "ai-logs";
export const DEFAULT_AXIOM_GEO_DATASET = "notra-geo-scan";
export const GEO_LOG_EVENT_PREFIX = "geo.";
export const GATEWAY_LIMIT_ALERT = {
  dedupeSeconds: 60 * 60,
  timeoutMs: 5000,
};
export const GATEWAY_LIMIT_DESCRIPTIONS = {
  "daily-spend": {
    name: "Daily spend limit",
    reason:
      "The provider reports that the account's daily spend limit has been reached.",
    recovery:
      "Wait for the provider's daily reset or request a higher spend limit.",
  },
  "daily-tokens": {
    name: "Daily token limit",
    reason:
      "The provider reports that the account's daily token limit has been reached.",
    recovery:
      "Wait for the provider's daily reset or request a higher token limit.",
  },
  "credit-balance": {
    name: "Credit balance",
    reason: "The provider requires a positive credit balance (HTTP 402).",
    recovery: "Add credits or check the provider's billing settings.",
  },
  "rate-limit": {
    name: "Rate limit",
    reason: "The provider reports a request or token rate limit.",
    recovery: "Wait before retrying or reduce request/token throughput.",
  },
  unknown: {
    name: "Unspecified rate or quota limit",
    reason:
      "The provider returned HTTP 429 without an identifiable limit type.",
    recovery: "Check the provider's usage and limits settings.",
  },
} satisfies Record<GatewayLimitType, GatewayLimitDescription>;
export const REQUEST_AI_USAGE_FIELDS = new Set([
  "calls",
  "model",
  "models",
  "inputTokens",
  "outputTokens",
  "totalTokens",
  "cacheReadTokens",
  "cacheWriteTokens",
  "reasoningTokens",
  "costUsd",
]);
export const AXIOM_PERMANENT_ERROR_PATTERN =
  /^Axiom API error: (401|403|404)\b/;
export const LOG_TRANSPORT_TIMEOUT_MS = 3000;
export const LOG_PIPELINE_OPTIONS = {
  batch: { size: 50, intervalMs: 2000 },
  retry: { maxAttempts: 3, initialDelayMs: 250, maxDelayMs: 1000 },
  maxBufferSize: 1000,
};
