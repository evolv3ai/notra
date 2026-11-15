import { GATEWAY_LIMIT_DESCRIPTIONS } from "@notra/ai/constants/evlog";
import {
  DAILY_LIMIT_ERROR_PATTERN,
  HTTP_PAYMENT_REQUIRED,
  HTTP_TOO_MANY_REQUESTS,
} from "@notra/ai/constants/router";
import { readMessage, readStatusCode } from "@notra/ai/router/upstream-failure";
import type {
  GatewayLimitDetails,
  GatewayLimitType,
} from "@notra/ai/types/gateway-limit";
import { parseRetryAfterMs } from "@notra/utils/retry-after";
import { isRecord } from "@notra/utils/unknown-record";

function responseHeadersOf(error: unknown): Record<string, unknown> {
  // GatewayError keeps the APICallError (and its headers) in `cause`.
  let current = error;
  for (let depth = 0; depth < 3 && isRecord(current); depth += 1) {
    if (isRecord(current.responseHeaders)) {
      return Object.fromEntries(
        Object.entries(current.responseHeaders).map(([name, value]) => [
          name.toLowerCase(),
          value,
        ])
      );
    }
    current = current.cause;
  }
  return {};
}

function headerNumber(
  headers: Record<string, unknown>,
  name: string
): number | undefined {
  const value = headers[name];
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

/** Only emit classified reasons and allowlisted numeric headers, never raw errors/prompts. */
export function readGatewayLimitDetails(
  error: unknown,
  now = Date.now()
): GatewayLimitDetails | undefined {
  const status = readStatusCode(error);
  if (status !== HTTP_PAYMENT_REQUIRED && status !== HTTP_TOO_MANY_REQUESTS) {
    return undefined;
  }
  const message = readMessage(error);
  let limitType: GatewayLimitType = "unknown";
  if (status === HTTP_PAYMENT_REQUIRED) {
    limitType = "credit-balance";
  } else if (DAILY_LIMIT_ERROR_PATTERN.test(message)) {
    limitType = /\bspend\b/i.test(message) ? "daily-spend" : "daily-tokens";
  } else if (
    /rate.?limit|tokens per minute|requests per minute/i.test(message)
  ) {
    limitType = "rate-limit";
  }
  const headers = responseHeadersOf(error);
  const details: GatewayLimitDetails = {
    limitType,
    limitReason: GATEWAY_LIMIT_DESCRIPTIONS[limitType].reason,
  };
  const retryAfter = headers["retry-after"];
  const retryAfterMs = parseRetryAfterMs(
    typeof retryAfter === "string" ? retryAfter : undefined,
    now
  );
  if (retryAfterMs !== undefined) {
    const retryAt = now + retryAfterMs;
    if (retryAt >= now && retryAt <= 8.64e15) {
      details.retryAt = new Date(retryAt).toISOString();
      details.retryAfterSeconds = Math.ceil((retryAt - now) / 1000);
    }
  }
  // Rate-limit headers describe a rate window, not a daily spend/token reset.
  if (limitType === "rate-limit" || limitType === "unknown") {
    const resetSeconds = headerNumber(headers, "x-ratelimit-reset");
    if (
      resetSeconds !== undefined &&
      resetSeconds * 1000 >= now &&
      resetSeconds * 1000 <= 8.64e15
    ) {
      details.rateLimitResetAt = new Date(resetSeconds * 1000).toISOString();
    }
  }
  details.requestLimit = headerNumber(headers, "x-ratelimit-limit-requests");
  details.tokenLimit = headerNumber(headers, "x-ratelimit-limit-tokens");
  return details;
}
