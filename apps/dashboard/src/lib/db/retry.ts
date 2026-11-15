import { Effect, Schedule } from "effect";

import {
  TRANSIENT_DB_CODES,
  TRANSIENT_DB_MESSAGES,
  TRANSIENT_DB_RETRY_DELAYS_MS,
} from "@/constants/db-retry";

function isTransientDbError(error: unknown): boolean {
  let current: unknown = error;
  const seen = new Set<unknown>();

  while (current) {
    if (seen.has(current)) {
      return false;
    }
    seen.add(current);

    const message =
      current instanceof Error ? current.message : String(current);
    if (TRANSIENT_DB_MESSAGES.some((value) => message.includes(value))) {
      return true;
    }
    if (typeof current !== "object") {
      return false;
    }
    if (
      "code" in current &&
      typeof current.code === "string" &&
      TRANSIENT_DB_CODES.has(current.code)
    ) {
      return true;
    }

    current = "cause" in current ? current.cause : undefined;
  }

  return false;
}

const retryTransientDbEffect = Effect.fn("db.retryTransient")(function* <T>(
  operation: () => Promise<T>
) {
  return yield* Effect.tryPromise({
    try: operation,
    catch: (cause) => cause,
  }).pipe(
    Effect.retry({
      schedule: Schedule.recurs(TRANSIENT_DB_RETRY_DELAYS_MS.length).pipe(
        Schedule.modifyDelay(({ attempt }) =>
          Effect.succeed(TRANSIENT_DB_RETRY_DELAYS_MS[attempt - 1] ?? 0)
        )
      ),
      while: isTransientDbError,
    })
  );
});

export function retryTransientDbError<T>(
  operation: () => Promise<T>
): Promise<T> {
  return Effect.runPromise(retryTransientDbEffect(operation));
}
