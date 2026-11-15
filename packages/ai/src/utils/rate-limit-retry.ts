import { Clock, Duration, Effect, Result, Schedule } from "effect";
import * as Headers from "effect/http/Headers";
import * as HttpClient from "effect/http/HttpClient";
import type * as HttpClientResponse from "effect/http/HttpClientResponse";

import {
  RATE_LIMIT_RETRY_BASE_DELAY,
  RATE_LIMIT_RETRY_MAX_WAIT,
  RATE_LIMIT_RETRY_TIMES,
} from "../constants/rate-limits";

const retryAfter = (
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<Duration.Duration | undefined> =>
  Effect.map(Clock.currentTimeMillis, (now) => {
    const header = response.headers["retry-after"];
    const parsed =
      header === undefined ? undefined : Headers.parseRetryAfter(header);
    if (parsed === undefined || Result.isFailure(parsed)) {
      return undefined;
    }
    const delay = Headers.retryAfterDelay(parsed.success, now);
    return Duration.isZero(delay) ? undefined : delay;
  });

const isRetryableRateLimit = (
  response: HttpClientResponse.HttpClientResponse
) =>
  response.status === 429
    ? Effect.map(
        retryAfter(response),
        (delay) =>
          delay === undefined ||
          Duration.isLessThanOrEqualTo(delay, RATE_LIMIT_RETRY_MAX_WAIT)
      )
    : Effect.succeed(false);

const rateLimitSchedule = Schedule.exponential(
  RATE_LIMIT_RETRY_BASE_DELAY
).pipe(
  Schedule.setInputType<HttpClientResponse.HttpClientResponse>(),
  Schedule.modifyDelay(({ input, duration }) =>
    Effect.map(retryAfter(input), (delay) => delay ?? duration)
  )
);

/**
 * Retries 429 responses after their Retry-After delay (exponential backoff
 * when absent). Only 429s: the server did not process the request, so even
 * paid or non-idempotent calls are safe to replay. A 429 asking for a longer
 * wait than the cap is returned as is.
 */
export const withRateLimitRetry = <E, R>(
  client: HttpClient.HttpClient.With<E, R>
) =>
  HttpClient.transformResponse(
    client,
    Effect.repeat({
      schedule: rateLimitSchedule,
      times: RATE_LIMIT_RETRY_TIMES,
      while: isRetryableRateLimit,
    })
  );
