import {
  BOX_RETRY_ATTEMPTS,
  BOX_RETRY_DELAY_MS,
} from "@notra/ai/constants/box-retry";
import {
  isRetrySafeBoxNetworkError,
  retryBoxOperation,
} from "@notra/ai/utils/box-retry";
import { Effect } from "effect";

const RATE_LIMITED_STATUS = 429;

/**
 * Retries transient Box failures with linear backoff (1 s, 2 s, ...) and
 * rejects with the last error. Only transport failures and 429s retry: the
 * wrapped calls (create, exec) are not idempotent, so a 5xx after the server
 * may have acted is surfaced instead.
 */
export function withBoxRetry<T>(
  callback: () => Promise<T>,
  attempts = BOX_RETRY_ATTEMPTS
): Promise<T> {
  return Effect.runPromise(
    retryBoxOperation(callback, {
      attempts,
      delayMs: BOX_RETRY_DELAY_MS,
      shouldRetry: isTransientBoxError,
    })
  );
}

function isTransientBoxError(error: unknown) {
  if (
    error instanceof Error &&
    "statusCode" in error &&
    error.statusCode === RATE_LIMITED_STATUS
  ) {
    return true;
  }
  return isRetrySafeBoxNetworkError(error);
}
