import { Cache, Duration, Effect, Exit } from "effect";

import {
  GEO_CODING_AGENT_ACCESS_CACHE_CAPACITY,
  GEO_CODING_AGENT_ACCESS_CACHE_TTL,
} from "../constants/geo-coding-agents";
import { GeoCodingAgentAccessService } from "../deps";
import { GeoCodingAgentAccessCacheKey } from "../types/coding-agent-access";
import { GeoScanError } from "./errors";

const accessCache = Effect.runSync(
  Cache.makeWith(
    ({ organizationId, access }: GeoCodingAgentAccessCacheKey) =>
      access.hasPaidPlanForOrganization(organizationId),
    {
      capacity: GEO_CODING_AGENT_ACCESS_CACHE_CAPACITY,
      timeToLive: (exit) =>
        Exit.isSuccess(exit) && exit.value
          ? GEO_CODING_AGENT_ACCESS_CACHE_TTL
          : Duration.zero,
    }
  )
);

export const loadGeoCodingAgentAccess = Effect.fn("geo.codingAgentAccess")(
  function* (organizationId: string) {
    const access = yield* GeoCodingAgentAccessService;
    return yield* Cache.get(
      accessCache,
      new GeoCodingAgentAccessCacheKey({ organizationId, access })
    ).pipe(
      Effect.catchTag("GeoCodingAgentAccessError", () => Effect.succeed(false))
    );
  }
);

export const requireGeoCodingAgentAccess = Effect.fn(
  "geo.requireCodingAgentAccess"
)(function* (organizationId: string) {
  if (!(yield* loadGeoCodingAgentAccess(organizationId))) {
    return yield* Effect.fail(
      new GeoScanError({ message: "Coding agents require an active paid plan" })
    );
  }
});
