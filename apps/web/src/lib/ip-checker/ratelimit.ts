import { createLimiter } from "@notra/utils/ratelimit";
import { Data, Effect } from "effect";

import { IP_CHECKER_RATE_LIMIT } from "@/constants/ip-checker";
import { getClientIpHash } from "@/utils/client-ip";

class IpCheckRateLimitExceeded extends Data.TaggedError(
  "IpCheckRateLimitExceeded"
)<{
  readonly reset: number;
}> {}

class IpCheckRateLimitUnavailable extends Data.TaggedError(
  "IpCheckRateLimitUnavailable"
)<{
  readonly cause: unknown;
}> {}

const limiter = createLimiter({
  prefix: "ratelimit:web:ip-checker",
  ...IP_CHECKER_RATE_LIMIT,
});

export const enforceIpCheckRateLimit = Effect.fn("enforceIpCheckRateLimit")(
  function* (request: Request) {
    const result = yield* Effect.tryPromise({
      try: () => limiter.limit(getClientIpHash(request)),
      catch: (cause) => new IpCheckRateLimitUnavailable({ cause }),
    });
    if (!result.success) {
      return yield* Effect.fail(
        new IpCheckRateLimitExceeded({ reset: result.reset })
      );
    }
  }
);
