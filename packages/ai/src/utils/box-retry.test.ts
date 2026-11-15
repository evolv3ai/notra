import { expect, test } from "bun:test";

import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";

import {
  isRetrySafeBoxNetworkError,
  isTransientBoxNetworkError,
  retryBoxOperation,
} from "./box-retry";

test("retries with linear backoff and surfaces the last error", async () => {
  const attempts: number[] = [];
  const failures = [1, 2, 3].map(
    (attempt) =>
      new Error(`attempt ${attempt}`, {
        cause: { code: "UND_ERR_CONNECT_TIMEOUT" },
      })
  );

  await Effect.runPromise(
    Effect.gen(function* () {
      const fiber = yield* retryBoxOperation(
        () => {
          attempts.push(attempts.length);
          return Promise.reject(failures[attempts.length - 1]);
        },
        { attempts: 3, delayMs: 1000, shouldRetry: isTransientBoxNetworkError }
      ).pipe(Effect.flip, Effect.forkChild);

      yield* TestClock.adjust(999);
      expect(attempts).toHaveLength(1);
      yield* TestClock.adjust(1);
      expect(attempts).toHaveLength(2);
      yield* TestClock.adjust(1999);
      expect(attempts).toHaveLength(2);
      yield* TestClock.adjust(1);
      expect(yield* Fiber.join(fiber)).toBe(failures[2]);
      expect(attempts).toHaveLength(3);
    }).pipe(Effect.provide(TestClock.layer()))
  );
});

test("does not retry failures after the request may have been sent", () => {
  expect(
    isTransientBoxNetworkError(
      new TypeError("terminated", { cause: { code: "UND_ERR_BODY_TIMEOUT" } })
    )
  ).toBe(false);
  expect(
    isTransientBoxNetworkError(
      new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } })
    )
  ).toBe(true);
});

test("non-idempotent calls let the structured code win over the message", () => {
  const sentThenTimedOut = new TypeError("fetch failed", {
    cause: { code: "UND_ERR_HEADERS_TIMEOUT" },
  });
  expect(isRetrySafeBoxNetworkError(sentThenTimedOut)).toBe(false);
  expect(isTransientBoxNetworkError(sentThenTimedOut)).toBe(true);
  expect(
    isRetrySafeBoxNetworkError(
      new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } })
    )
  ).toBe(true);
  expect(isRetrySafeBoxNetworkError(new TypeError("fetch failed"))).toBe(true);
});
