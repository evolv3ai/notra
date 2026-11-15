import { Cache, Effect } from "effect";

import {
  AI_TRAFFIC_EVENTS_QUOTA_CACHE_CAPACITY,
  AI_TRAFFIC_EVENTS_QUOTA_CACHE_TTL_MS,
} from "../constants/ai-traffic-events";
import { logError, logWarn } from "../utils/server-log";
import {
  allowUnmeteredAiInDevelopment,
  autumn,
  AUTUMN_READ_TIMEOUT_MS,
} from "./autumn";
import { FEATURES } from "./features";

let warnedMissingBilling = false;

function warnMissingBilling() {
  if (warnedMissingBilling || allowUnmeteredAiInDevelopment) {
    return;
  }
  warnedMissingBilling = true;
  logWarn(
    "AUTUMN_SECRET_KEY is not set; AI traffic events are not metered or limited"
  );
}

const quota = Effect.runSync(
  Cache.makeWith(
    (organizationId: string) =>
      Effect.promise(async () => {
        if (!autumn) {
          warnMissingBilling();
          return true;
        }
        try {
          const result = await autumn.check(
            {
              customerId: organizationId,
              featureId: FEATURES.AI_TRAFFIC_EVENTS,
            },
            { timeoutMs: AUTUMN_READ_TIMEOUT_MS }
          );
          return result.allowed !== false;
        } catch (error) {
          logError("AI traffic events quota check failed", error, {
            organizationId,
          });
          return true;
        }
      }),
    {
      capacity: AI_TRAFFIC_EVENTS_QUOTA_CACHE_CAPACITY,
      timeToLive: () => AI_TRAFFIC_EVENTS_QUOTA_CACHE_TTL_MS,
    }
  )
);

export const hasAiTrafficEventsQuota = (organizationId: string) =>
  Cache.get(quota, organizationId);

export async function trackAiTrafficEvent(organizationId: string, value = 1) {
  if (!autumn) {
    warnMissingBilling();
    return;
  }
  await autumn
    .track({
      customerId: organizationId,
      featureId: FEATURES.AI_TRAFFIC_EVENTS,
      value,
    })
    .catch((error: unknown) => {
      logError("AI traffic events usage tracking failed", error, {
        organizationId,
      });
    });
}
