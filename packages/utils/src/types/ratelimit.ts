import type { Ratelimit } from "@upstash/ratelimit";

export type Limiter = Pick<Ratelimit, "limit">;

export interface RateLimitResult {
  readonly limit: number;
  readonly remaining: number;
  readonly reset: number;
}
