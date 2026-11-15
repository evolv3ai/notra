import {
  TRANSIENT_BOX_ERROR_MESSAGES,
  TRANSIENT_BOX_NETWORK_CODES,
} from "@notra/ai/constants/box-retry";
import { Cause, Duration, Effect, Exit, Schedule } from "effect";

function errorCode(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || !("code" in value)) {
    return undefined;
  }
  return typeof value.code === "string" ? value.code : undefined;
}

/**
 * Transport failures worth retrying against Upstash Box for idempotent calls:
 * the legacy message checks plus connect-phase codes undici sets on the error
 * or its cause.
 */
export function isTransientBoxNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  if (
    TRANSIENT_BOX_ERROR_MESSAGES.some((fragment) =>
      error.message.includes(fragment)
    )
  ) {
    return true;
  }
  const code = errorCode(error) ?? errorCode(error.cause);
  return code !== undefined && TRANSIENT_BOX_NETWORK_CODES.has(code);
}

/**
 * Stricter variant for calls that are not idempotent (box create, exec). A
 * structured code decides first, so a "fetch failed" whose cause shows the
 * request was already sent (header/body timeout, socket reset) is not retried.
 */
export function isRetrySafeBoxNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = errorCode(error) ?? errorCode(error.cause);
  if (code !== undefined) {
    return TRANSIENT_BOX_NETWORK_CODES.has(code);
  }
  return isTransientBoxNetworkError(error);
}

/**
 * Up to `attempts` runs in total, waiting `delayMs * n` before retry n.
 */
export function linearRetrySchedule(attempts: number, delayMs: number) {
  return Schedule.recurs(Math.max(0, attempts - 1)).pipe(
    Schedule.addDelay(({ output }) =>
      Effect.succeed(Duration.millis(delayMs * (output + 1)))
    )
  );
}

export function retryBoxOperation<A>(
  callback: () => Promise<A>,
  options: {
    attempts: number;
    delayMs: number;
    shouldRetry: (error: unknown) => boolean;
  }
): Effect.Effect<A, unknown> {
  return Effect.tryPromise({
    try: () => callback(),
    catch: (cause) => cause,
  }).pipe(
    Effect.retry({
      schedule: linearRetrySchedule(options.attempts, options.delayMs),
      while: options.shouldRetry,
    })
  );
}

/**
 * Runs a box effect as a Promise. An aborted `signal` interrupts whatever is
 * pending (a request or a backoff sleep) and rejects with `onAbort(signal)`;
 * any other failure rejects with the original error.
 */
export async function runBoxEffect<A>(
  effect: Effect.Effect<A, unknown>,
  signal: AbortSignal | undefined,
  onAbort: (signal: AbortSignal) => unknown
): Promise<A> {
  const exit = await Effect.runPromiseExit(
    effect,
    signal ? { signal } : undefined
  );
  if (Exit.isSuccess(exit)) {
    return exit.value;
  }
  if (signal?.aborted && Cause.hasInterruptsOnly(exit.cause)) {
    throw onAbort(signal);
  }
  throw Cause.squash(exit.cause);
}
