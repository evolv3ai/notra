import { createLimiter } from "@notra/utils/ratelimit";
import { Data, Effect } from "effect";

import { getClientIpHash } from "@/utils/client-ip";

class StarVideoRateLimitExceeded extends Data.TaggedError(
  "StarVideoRateLimitExceeded"
)<{ readonly reset: number }> {}

const limiters = {
  lookup: createLimiter({
    prefix: "ratelimit:web:star-video-lookup",
    requests: 20,
    window: "1 h",
  }),
  render: createLimiter({
    prefix: "ratelimit:web:star-video-render",
    requests: 10,
    window: "1 h",
  }),
  "render-global": createLimiter({
    prefix: "ratelimit:web:star-video-render-global",
    requests: 40,
    window: "1 h",
  }),
};

const enforceLimit = Effect.fn("enforceStarVideoLimit")(function* (
  kind: keyof typeof limiters,
  key: string
) {
  const result = yield* Effect.tryPromise({
    try: () => limiters[kind].limit(key),
    catch: (cause) => {
      console.warn(
        `star-video rate limiter unavailable for "${kind}"; failing closed`,
        cause
      );
      return new StarVideoRateLimitExceeded({ reset: 0 });
    },
  });

  if (!result.success) {
    return yield* Effect.fail(
      new StarVideoRateLimitExceeded({ reset: result.reset })
    );
  }
});

export const enforceStarVideoRateLimit = Effect.fn("enforceStarVideoRateLimit")(
  function* (request: Request, kind: "lookup" | "render") {
    yield* enforceLimit(kind, getClientIpHash(request));
  }
);

export const enforceGlobalRenderLimit = Effect.fn("enforceGlobalRenderLimit")(
  function* () {
    yield* enforceLimit("render-global", "global");
  }
);
