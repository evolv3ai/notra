import { afterEach, describe, expect, mock, test } from "bun:test";

const limitCalls: { prefix: string; identifier: string }[] = [];
const constructed: Record<string, unknown>[] = [];

mock.module("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow(requests: number, window: string) {
      return { requests, window };
    }
    readonly config: { prefix: string };
    constructor(config: { prefix: string }) {
      this.config = config;
      constructed.push(config);
    }
    limit(identifier: string) {
      limitCalls.push({ prefix: this.config.prefix, identifier });
      return Promise.resolve({
        success: true,
        limit: 5,
        remaining: 4,
        reset: 0,
        pending: Promise.resolve(),
      });
    }
  },
}));

const { createLimiter, getRateLimitHeaders } = await import("../src/ratelimit");

const env = process.env as Record<string, string | undefined>;
const original = {
  NODE_ENV: env.NODE_ENV,
  UPSTASH_REDIS_REST_URL: env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: env.UPSTASH_REDIS_REST_TOKEN,
};

afterEach(() => {
  for (const [name, value] of Object.entries(original)) {
    if (value === undefined) {
      delete env[name];
    } else {
      env[name] = value;
    }
  }
  limitCalls.length = 0;
  constructed.length = 0;
});

describe("createLimiter", () => {
  test("allows every call outside production when Redis is not configured", async () => {
    delete env.UPSTASH_REDIS_REST_URL;
    delete env.UPSTASH_REDIS_REST_TOKEN;
    env.NODE_ENV = "development";
    const limiter = createLimiter({
      prefix: "ratelimit:test",
      requests: 3,
      window: "1m",
    });
    const result = await limiter.limit("key");
    expect(result).toMatchObject({ success: true, limit: 3, remaining: 3 });
    expect(constructed).toHaveLength(0);
  });

  test("rejects in production when Redis is not configured", async () => {
    delete env.UPSTASH_REDIS_REST_URL;
    delete env.UPSTASH_REDIS_REST_TOKEN;
    env.NODE_ENV = "production";
    const limiter = createLimiter({
      prefix: "ratelimit:test",
      requests: 3,
      window: "1m",
    });
    await expect(limiter.limit("key")).rejects.toThrow(
      "UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is not set"
    );
  });

  test("builds one sliding-window limiter lazily and keeps the prefix", async () => {
    const redis = {} as never;
    const limiter = createLimiter({
      redis,
      prefix: "ratelimit:web:ip-checker",
      requests: 10,
      window: "1 h",
      timeout: 500,
    });
    expect(constructed).toHaveLength(0);
    await limiter.limit("a");
    await limiter.limit("b");
    expect(constructed).toEqual([
      {
        redis,
        prefix: "ratelimit:web:ip-checker",
        timeout: 500,
        limiter: { requests: 10, window: "1 h" },
      },
    ]);
    expect(limitCalls).toEqual([
      { prefix: "ratelimit:web:ip-checker", identifier: "a" },
      { prefix: "ratelimit:web:ip-checker", identifier: "b" },
    ]);
  });
});

describe("getRateLimitHeaders", () => {
  test("writes both header families and an optional Retry-After", () => {
    const reset = Date.now() + 30_500;
    const headers = getRateLimitHeaders(
      { limit: 10, remaining: -1, reset },
      true
    );
    expect(headers.get("RateLimit-Limit")).toBe("10");
    expect(headers.get("RateLimit-Remaining")).toBe("0");
    expect(headers.get("RateLimit-Reset")).toBe("31");
    expect(headers.get("X-RateLimit-Reset")).toBe(
      String(Math.ceil(reset / 1000))
    );
    expect(headers.get("Retry-After")).toBe("31");
    expect(
      getRateLimitHeaders({ limit: 1, remaining: 1, reset }).has("Retry-After")
    ).toBe(false);
  });
});
