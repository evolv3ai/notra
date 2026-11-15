import { type Duration, Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import type { Limiter, RateLimitResult } from "./types/ratelimit";

let sharedRedis: Redis | null | undefined;

function getSharedRedis(): Redis | null {
  if (sharedRedis === undefined) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    sharedRedis = url && token ? new Redis({ url, token }) : null;
  }
  return sharedRedis;
}

/**
 * A sliding-window limiter on Upstash Redis, built on first use. Without
 * `redis` it uses UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN; when
 * those are missing every call rejects in production and is allowed
 * elsewhere, so local development works without Redis.
 */
export function createLimiter({
  redis,
  requests,
  window,
  ...config
}: {
  prefix: string;
  requests: number;
  window: Duration;
  redis?: Redis;
  timeout?: number;
  analytics?: boolean;
}): Limiter {
  let ratelimit: Ratelimit | undefined;
  return {
    limit(identifier, options) {
      const client = redis ?? getSharedRedis();
      if (!client) {
        if (process.env.NODE_ENV === "production") {
          return Promise.reject(
            new Error(
              "UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is not set"
            )
          );
        }
        return Promise.resolve({
          success: true,
          limit: requests,
          remaining: requests,
          reset: Date.now(),
          pending: Promise.resolve(),
        });
      }
      ratelimit ??= new Ratelimit({
        ...config,
        redis: client,
        limiter: Ratelimit.slidingWindow(requests, window),
      });
      return ratelimit.limit(identifier, options);
    },
  };
}

/** `RateLimit-*` and `X-RateLimit-*` headers, plus `Retry-After` on request. */
export function getRateLimitHeaders(
  result: RateLimitResult,
  includeRetryAfter = false
): Headers {
  const resetSeconds = Math.max(
    0,
    Math.ceil((result.reset - Date.now()) / 1000)
  );
  const remaining = String(Math.max(0, result.remaining));
  const headers = new Headers({
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": remaining,
    "RateLimit-Reset": String(resetSeconds),
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": remaining,
    "X-RateLimit-Reset": String(Math.ceil(result.reset / 1000)),
  });
  if (includeRetryAfter) {
    headers.set("Retry-After", String(resetSeconds));
  }
  return headers;
}
