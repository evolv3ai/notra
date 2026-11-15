import { createHash } from "node:crypto";

import type { CachedWrapper } from "@notra/ai/types/tools";
import { Cache, Effect, Equal, Exit, Hash } from "effect";

interface ExecutableTool {
  execute?: (params: unknown, context?: unknown) => Promise<unknown> | unknown;
}

type ToolCallOutcome =
  | { ok: true; value: unknown; cacheable: boolean; served: boolean }
  | { ok: false; error: unknown };

/**
 * Cache key for one tool call. Equality and hash only look at the string
 * key; the loader travels along so the first caller's execution is shared
 * with identical concurrent calls.
 */
class ToolCallKey implements Equal.Equal {
  readonly key: string;
  readonly ttlMs: number;
  readonly execute: () => Promise<unknown>;
  readonly shouldCache: (result: unknown) => boolean;

  constructor(options: {
    key: string;
    ttlMs: number;
    execute: () => Promise<unknown>;
    shouldCache: (result: unknown) => boolean;
  }) {
    this.key = options.key;
    this.ttlMs = options.ttlMs;
    this.execute = options.execute;
    this.shouldCache = options.shouldCache;
  }

  [Equal.symbol](that: Equal.Equal): boolean {
    return that instanceof ToolCallKey && that.key === this.key;
  }

  [Hash.symbol](): number {
    return Hash.string(this.key);
  }
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_KEY_PREFIX = "notra:ai-tools:";
const TOOL_CACHE_CAPACITY = 1000;

const toolCallCache = Effect.runSync(
  Cache.makeWith(
    (call: ToolCallKey) =>
      Effect.promise(async (): Promise<ToolCallOutcome> => {
        try {
          const value = await call.execute();
          return {
            ok: true,
            value,
            cacheable: call.shouldCache(value),
            served: false,
          };
        } catch (error) {
          return { ok: false, error };
        }
      }),
    {
      capacity: TOOL_CACHE_CAPACITY,
      // Failures and results the tool opted out of are only shared with
      // concurrent identical calls, never kept.
      timeToLive: (exit, call) =>
        Exit.isSuccess(exit) && exit.value.ok && exit.value.cacheable
          ? call.ttlMs
          : 0,
    }
  )
);

function normalizeKeyPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function getAICachedTools(options: {
  organizationId?: string;
  namespace: string;
  /** Access policy of the tool instance (allowlists, selection filters).
   * Entries are partitioned by it, because authorization and filtering run
   * inside the cached call and must not be skipped by another instance's hit.
   */
  scope?: unknown;
}) {
  const orgPart = normalizeKeyPart(options.organizationId ?? "anonymous");
  const namespacePart = normalizeKeyPart(options.namespace);
  const scopePart =
    options.scope === undefined
      ? ""
      : `scope=${createHash("sha256")
          .update(JSON.stringify(options.scope))
          .digest("hex")
          .slice(0, 32)}:`;
  const keyPrefix = `${DEFAULT_KEY_PREFIX}${namespacePart}:${orgPart}:${scopePart}`;

  const debug = process.env.NODE_ENV === "development";

  return ((tool: ExecutableTool, cacheOptions = {}) => {
    if (typeof tool.execute !== "function") {
      return tool;
    }

    const originalExecute = tool.execute;
    const toolTtl = cacheOptions.ttl ?? DEFAULT_TTL_MS;
    return {
      ...tool,
      execute: async (params: unknown, context?: unknown) => {
        const cacheKey = `${keyPrefix}${cacheOptions.keyGenerator?.(params, context) ?? createDefaultCacheKey(params)}`;
        const outcome = await Effect.runPromise(
          Cache.get(
            toolCallCache,
            new ToolCallKey({
              key: cacheKey,
              ttlMs: toolTtl,
              execute: async () => await originalExecute(params, context),
              shouldCache: (result) =>
                cacheOptions.shouldCache?.(params, result) !== false,
            })
          )
        );
        if (!outcome.ok) {
          throw outcome.error;
        }
        if (outcome.served && (cacheOptions.debug ?? debug)) {
          console.debug("[ai-tool-cache] hit", cacheKey);
        }
        outcome.served = true;
        return outcome.value;
      },
    };
  }) as CachedWrapper;
}

function createDefaultCacheKey(params: unknown) {
  return JSON.stringify(params ?? {});
}
