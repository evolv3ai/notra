import { redis } from "@notra/ai/utils/redis";
import { createLimiter } from "@notra/utils/ratelimit";
import type { Limiter } from "@notra/utils/types/ratelimit";

import { internalServerError, tooManyRequests } from "./errors";

export const MCP_CONNECTION_RATE_LIMIT = {
  limit: 10,
  windowSeconds: 60,
} as const;
export const BRANDING_UPLOAD_RATE_LIMIT = {
  limit: 20,
  windowSeconds: 60,
} as const;
const limiters = new Map<string, Limiter>();
const developmentHits = new Map<string, number[]>();

export async function assertRateLimit(params: {
  key: string;
  limit: number;
  windowSeconds: number;
  message?: string;
}) {
  let success: boolean;
  if (redis) {
    const policy = `${params.limit}:${params.windowSeconds}`;
    let limiter = limiters.get(policy);
    if (!limiter) {
      limiter = createLimiter({
        redis,
        prefix: `console:rate-limit:${policy}`,
        requests: params.limit,
        window: `${params.windowSeconds} s`,
      });
      limiters.set(policy, limiter);
    }
    success = (await limiter.limit(params.key)).success;
  } else {
    if (process.env.NODE_ENV === "production") {
      throw internalServerError("Shared rate limiting is not configured");
    }
    const now = Date.now();
    const cutoff = now - params.windowSeconds * 1000;
    for (const [key, hits] of developmentHits) {
      if ((hits.at(-1) ?? 0) <= cutoff) {
        developmentHits.delete(key);
      }
    }
    const key = `${params.limit}:${params.windowSeconds}:${params.key}`;
    const hits = (developmentHits.get(key) ?? []).filter(
      (time) => time > cutoff
    );
    success = hits.length < params.limit;
    if (success) {
      hits.push(now);
    }
    developmentHits.set(key, hits);
  }
  if (!success) {
    throw tooManyRequests(
      params.message ?? "Too many attempts. Wait a minute and try again."
    );
  }
}
