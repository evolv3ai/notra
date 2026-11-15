import { parseRetryAfterMs } from "@notra/utils/retry-after";

import { MAX_ATTEMPTS, RETRY_DELAYS_SECONDS } from "../constants/delivery";
import type { DeliveryOutcome } from "../types/webhooks";

export function shouldRetry(
  outcome: DeliveryOutcome,
  attempt: number,
  limit = MAX_ATTEMPTS
) {
  if (
    attempt >= limit ||
    outcome.error === "unsafe_url" ||
    outcome.error === "signing_failed"
  ) {
    return false;
  }
  return (
    outcome.statusCode === null ||
    outcome.statusCode === 408 ||
    outcome.statusCode === 429 ||
    outcome.statusCode >= 500
  );
}

export function retryDelaySeconds(
  attempt: number,
  retryAfterSeconds: number | null
) {
  const delay = RETRY_DELAYS_SECONDS[Math.max(0, attempt - 1)] ?? 21600;
  return Math.min(86400, Math.max(delay, retryAfterSeconds ?? 0));
}

export function parseRetryAfter(value: string | null, now: number) {
  const delayMs = parseRetryAfterMs(value, now);
  return delayMs === undefined
    ? null
    : Math.max(0, Math.min(86400, Math.ceil(delayMs / 1000)));
}
