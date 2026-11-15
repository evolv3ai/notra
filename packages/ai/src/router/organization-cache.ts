import type {
  OrganizationLookup,
  OrganizationLookupEntry,
  OrganizationLookupOptions,
} from "@notra/ai/types/router";
import { Cache, type Cause, Clock, Effect, Exit } from "effect";

/**
 * Effect clock driven by the router's `now`, so cache expiry follows the
 * same time source as the rest of the router (and test clocks).
 */
export function clockFromNow(now: () => number): Clock.Clock {
  const base = Clock.Clock.defaultValue();
  return {
    currentTimeMillisUnsafe: now,
    currentTimeMillis: Effect.sync(now),
    currentTimeNanosUnsafe: () => BigInt(now()) * 1_000_000n,
    currentTimeNanos: Effect.sync(() => BigInt(now()) * 1_000_000n),
    monotonicTimeNanosUnsafe: () => base.monotonicTimeNanosUnsafe(),
    monotonicTimeNanos: base.monotonicTimeNanos,
    sleep: (duration) => base.sleep(duration),
  };
}

/**
 * Per-organization lookup cache. Concurrent misses share one resolver call,
 * the cache is capacity bounded, and failures are kept only briefly so an
 * upstream outage neither hammers the resolver nor pins a fallback for the
 * full TTL. An optional store (e.g. Redis) is consulted before the resolver.
 */
export function createOrganizationLookup<T>(
  options: OrganizationLookupOptions<T>
): OrganizationLookup<T> {
  const { resolve, store, ttlMs, failureTtlMs, capacity, onFailure } = options;
  const clock = clockFromNow(options.now);

  // A failed lookup is cached as `undefined` so it expires on the short
  // failure TTL instead of being retried by every request.
  const load = Effect.fn("ai.router.organizationLookup")(
    function* (
      organizationId: string
    ): Effect.fn.Return<OrganizationLookupEntry<T>, Cause.UnknownError> {
      const stored = store
        ? yield* Effect.tryPromise(() => store.get(organizationId))
        : undefined;
      if (stored !== undefined) {
        return { value: stored, fromStore: true, claimed: false };
      }
      const value = yield* Effect.tryPromise(() => resolve(organizationId));
      if (store) {
        yield* Effect.tryPromise(() => store.set(organizationId, value, ttlMs));
      }
      return { value, fromStore: false, claimed: false };
    },
    (effect, organizationId) =>
      effect.pipe(
        Effect.catch((error) =>
          Effect.sync(() => {
            onFailure(organizationId, error.cause);
            return undefined;
          })
        )
      )
  );

  const cache = Effect.runSync(
    Cache.makeWith(load, {
      capacity,
      timeToLive: (exit) =>
        Exit.isSuccess(exit) && exit.value ? ttlMs : failureTtlMs,
    })
  );

  return async (organizationId) => {
    const entry = await Effect.runPromise(
      Cache.get(cache, organizationId).pipe(
        Effect.provideService(Clock.Clock, clock)
      )
    );
    if (!entry) {
      return undefined;
    }
    // The caller that triggered the resolver reports it; everyone sharing
    // the cached entry afterwards reports a cache hit.
    const source = entry.fromStore || entry.claimed ? "cache" : "resolver";
    entry.claimed = true;
    return { value: entry.value, source };
  };
}
