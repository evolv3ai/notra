import type { Redis } from "@upstash/redis";
import { Effect } from "effect";

import {
  GEO_TRAFFIC_FLUSH_INTERVAL_MS,
  GEO_TRAFFIC_FLUSH_SETTLE_MS,
  GLOBAL_SCOPE_ID,
  INITIAL_CACHE_VERSION,
  LIVE_QUERY_CACHE_TTL_SECONDS,
  PURGE_GENERATION_KEY_PREFIX,
  QUERY_CACHE_KEY_PREFIX,
  QUERY_CACHE_TTL_SECONDS,
  VERSION_KEY_PREFIX,
  VERSIONED_CACHE_SCOPES,
} from "../constants/cache";
import type { AnalyticsCacheScope, CachedQueryOptions } from "../types/cache";
import { getAnalyticsRedis } from "./redis";

function versionKey(
  scope: AnalyticsCacheScope,
  organizationId: string | null
): string {
  return `${VERSION_KEY_PREFIX}:${scope}:${organizationId ?? GLOBAL_SCOPE_ID}`;
}

function purgeGenerationKey(
  scope: AnalyticsCacheScope,
  organizationId: string | null
): string {
  return `${PURGE_GENERATION_KEY_PREFIX}:${scope}:${organizationId ?? GLOBAL_SCOPE_ID}`;
}

function queryCacheKey(
  options: CachedQueryOptions<unknown>,
  version: number | "live"
): string {
  return `${QUERY_CACHE_KEY_PREFIX}:${options.scope}:${version}:${options.organizationId ?? GLOBAL_SCOPE_ID}:${options.pipe}:${stableParams(options.params)}`;
}

function toJsonSafe(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? Number(item) : item
    )
  );
}

function stableParams(params: Record<string, unknown>): string {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify(Object.fromEntries(entries));
}

/**
 * Seconds until the next geo flush window has settled. Entries cached right
 * after a boundary but before the batch is readable expire at the settle
 * point, so the new batch is never hidden for a whole window.
 */
function geoLiveTtlSeconds(): number {
  const now = Date.now();
  const boundary =
    now - (now % GEO_TRAFFIC_FLUSH_INTERVAL_MS) + GEO_TRAFFIC_FLUSH_SETTLE_MS;
  const expiresAt =
    boundary > now ? boundary : boundary + GEO_TRAFFIC_FLUSH_INTERVAL_MS;
  return Math.max(1, Math.ceil((expiresAt - now) / 1000));
}

function liveTtlSeconds(scope: AnalyticsCacheScope): number {
  return scope === "geo" ? geoLiveTtlSeconds() : LIVE_QUERY_CACHE_TTL_SECONDS;
}

function readVersion(
  redis: Redis,
  scope: AnalyticsCacheScope,
  organizationId: string | null
): Effect.Effect<number> {
  return Effect.tryPromise(() =>
    redis.get<number>(versionKey(scope, organizationId))
  ).pipe(
    Effect.orElseSucceed(() => null),
    Effect.map((version) => version ?? INITIAL_CACHE_VERSION)
  );
}

export function cachedQuery<TResult>(
  options: CachedQueryOptions<TResult>
): Promise<TResult> {
  const redis = getAnalyticsRedis();
  if (!redis) {
    return options.fetch();
  }
  const program = VERSIONED_CACHE_SCOPES.has(options.scope)
    ? versionedQuery(redis, options)
    : liveQuery(redis, options);
  return Effect.runPromise(program);
}

interface LiveQueryCacheEntry<TResult> {
  generation: number;
  value: TResult;
}

function versionedQuery<TResult>(
  redis: Redis,
  options: CachedQueryOptions<TResult>
): Effect.Effect<TResult, unknown> {
  return Effect.gen(function* () {
    const version = yield* readVersion(
      redis,
      options.scope,
      options.organizationId
    );
    const key = queryCacheKey(options, version);
    const hit = yield* Effect.tryPromise(() => redis.get<TResult>(key)).pipe(
      Effect.orElseSucceed(() => null)
    );
    if (hit !== null) {
      return hit;
    }
    const fresh = yield* Effect.tryPromise(() => options.fetch());
    if (fresh !== null) {
      yield* Effect.tryPromise(() =>
        redis.set(key, toJsonSafe(fresh), { ex: QUERY_CACHE_TTL_SECONDS })
      ).pipe(Effect.ignore);
    }
    return fresh;
  });
}

function liveQuery<TResult>(
  redis: Redis,
  options: CachedQueryOptions<TResult>
): Effect.Effect<TResult, unknown> {
  const key = queryCacheKey(options, "live");
  const generationKey = purgeGenerationKey(
    options.scope,
    options.organizationId
  );
  return Effect.gen(function* () {
    const [hit, storedGeneration] = yield* Effect.tryPromise(() =>
      redis
        .pipeline()
        .get<LiveQueryCacheEntry<TResult>>(key)
        .get<number>(generationKey)
        .exec()
    ).pipe(
      Effect.orElseSucceed(
        (): [LiveQueryCacheEntry<TResult> | null, number | null] => [null, null]
      )
    );
    const generation = storedGeneration ?? INITIAL_CACHE_VERSION;
    if (hit !== null && hit.generation === generation) {
      return hit.value;
    }
    const fresh = yield* Effect.tryPromise(() => options.fetch());
    if (fresh !== null) {
      yield* Effect.tryPromise(() =>
        redis.set(key, toJsonSafe({ generation, value: fresh }), {
          ex: liveTtlSeconds(options.scope),
        })
      ).pipe(Effect.ignore);
    }
    return fresh;
  });
}

export function bumpAnalyticsVersions(
  scope: AnalyticsCacheScope,
  organizationIds: ReadonlyArray<string | null>
): Promise<void> {
  const redis = getAnalyticsRedis();
  const keys = [...new Set(organizationIds.map((id) => versionKey(scope, id)))];
  if (!redis || keys.length === 0 || !VERSIONED_CACHE_SCOPES.has(scope)) {
    return Promise.resolve();
  }
  const program = Effect.tryPromise(() => {
    const pipeline = redis.pipeline();
    for (const key of keys) {
      pipeline.incr(key);
    }
    return pipeline.exec();
  }).pipe(Effect.ignore);
  return Effect.runPromise(program);
}

export async function advancePurgeGeneration(
  scope: AnalyticsCacheScope,
  organizationId: string | null
): Promise<void> {
  const redis = getAnalyticsRedis();
  if (!redis || VERSIONED_CACHE_SCOPES.has(scope)) {
    return;
  }
  await redis.incr(purgeGenerationKey(scope, organizationId));
}

/**
 * Best-effort `advancePurgeGeneration` for freshness signals: errors are
 * swallowed, so entries stay readable until they expire. Deletions must use
 * `advancePurgeGeneration` and fail instead.
 */
export function bumpPurgeGeneration(
  scope: AnalyticsCacheScope,
  organizationId: string | null
): Promise<void> {
  return Effect.runPromise(
    Effect.tryPromise(() => advancePurgeGeneration(scope, organizationId)).pipe(
      Effect.ignore
    )
  );
}
