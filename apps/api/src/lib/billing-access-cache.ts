import { Cache, Effect, Exit } from "effect";

import {
  BILLING_ACCESS_CACHE_CAPACITY,
  BILLING_ACCESS_CACHE_TTL,
} from "../constants/billing";

export function makeBillingAccessCache<E>(
  lookup: (organizationId: string) => Effect.Effect<boolean, E>
) {
  return Cache.makeWith(lookup, {
    capacity: BILLING_ACCESS_CACHE_CAPACITY,
    timeToLive: (exit) =>
      Exit.isSuccess(exit) && exit.value ? BILLING_ACCESS_CACHE_TTL : 0,
  });
}
