import { createHash } from "node:crypto";

import { createLimiter } from "@notra/utils/ratelimit";
import type { Limiter, RateLimitResult } from "@notra/utils/types/ratelimit";
import { Data, Effect } from "effect";

import { CONTACT_RATE_LIMITS } from "@/constants/contact";
import { getClientIpHash } from "@/utils/client-ip";

type LimiterKind = keyof typeof CONTACT_RATE_LIMITS;

class ContactMessageRateLimitExceeded extends Data.TaggedError(
  "ContactMessageRateLimitExceeded"
)<{
  readonly limit: number;
  readonly remaining: number;
  readonly reset: number;
}> {}

class ContactMessageRateLimitError extends Data.TaggedError(
  "ContactMessageRateLimitError"
)<{
  readonly message: string;
  readonly cause: unknown;
}> {}

const limiters = Object.fromEntries(
  Object.entries(CONTACT_RATE_LIMITS).map(([kind, { requests, window }]) => [
    kind,
    createLimiter({
      prefix:
        kind === "ipHourly"
          ? "ratelimit:web:contact-message"
          : `ratelimit:web:contact-message-${kind}`,
      requests,
      window,
    }),
  ])
) as Record<LimiterKind, Limiter>;

function getEmailRateLimitKey(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function getMoreBindingRateLimit(
  current: RateLimitResult,
  candidate: RateLimitResult
): RateLimitResult {
  if (candidate.remaining !== current.remaining) {
    return candidate.remaining < current.remaining ? candidate : current;
  }

  return candidate.reset > current.reset ? candidate : current;
}

const enforceLimit = Effect.fn("enforceContactMessageLimit")(function* (
  kind: LimiterKind,
  key: string
) {
  const result = yield* Effect.tryPromise({
    try: () => limiters[kind].limit(key),
    catch: (cause) =>
      new ContactMessageRateLimitError({
        message: `Failed to enforce ${kind} contact message rate limit`,
        cause,
      }),
  });

  if (result.reason === "timeout") {
    return yield* Effect.fail(
      new ContactMessageRateLimitError({
        message: "Rate limit service timed out",
        cause: new Error("Contact rate limit could not be confirmed"),
      })
    );
  }

  if (!result.success) {
    return yield* Effect.fail(
      new ContactMessageRateLimitExceeded({
        limit: result.limit,
        remaining: Math.max(0, result.remaining),
        reset: result.reset,
      })
    );
  }

  return {
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
});

export const enforceContactVerificationRateLimit = Effect.fn(
  "enforceContactVerificationRateLimit"
)(function* (request: Request) {
  yield* enforceLimit("verificationIpMinute", getClientIpHash(request));
  yield* enforceLimit("verificationGlobalMinute", "global");
});

export const enforceContactMessageRateLimit = Effect.fn(
  "enforceContactMessageRateLimit"
)(function* (request: Request, email: string) {
  const ipKey = getClientIpHash(request);
  const hourlyResult = yield* enforceLimit("ipHourly", ipKey);
  const dailyResult = yield* enforceLimit("ipDaily", ipKey);
  const emailResult = yield* enforceLimit(
    "emailDaily",
    getEmailRateLimitKey(email)
  );
  const globalResult = yield* enforceLimit("globalHourly", "global");

  return [dailyResult, emailResult, globalResult].reduce(
    getMoreBindingRateLimit,
    hourlyResult
  );
});
