import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { captureServerEvent, flushPostHogServer } from "@notra/posthog/server";
import { Effect } from "effect";

import {
  GEO_INGEST_RECEIVED_SAMPLE_DENOMINATOR,
  GEO_INGEST_RECEIVED_SAMPLE_RATE,
} from "../constants/ingest";
import type { GeoIngestAnalyticsInput } from "../types/ingest";
import { claimFirstIngestHit } from "../utils/claim-first-ingest-hit";

export const trackGeoIngestAnalytics = Effect.fn("geoIngest.analytics")(
  function* ({ identity, event }: GeoIngestAnalyticsInput) {
    const scope = {
      organizationId: identity.organizationId,
      projectId: identity.projectId,
    };
    const traits = {
      visitor_type: event.visitor_type,
      agent_family: event.source,
      agent: event.agent,
      purpose: event.category,
      wants_markdown: event.wants_markdown,
    };

    const firstHit = yield* Effect.promise(() => claimFirstIngestHit(identity));
    if (firstHit) {
      captureServerEvent({
        ...scope,
        event: POSTHOG_EVENTS.TRAFFIC_INGEST_FIRST_HIT,
        properties: traits,
      });
    }

    const sampled = Math.random() < GEO_INGEST_RECEIVED_SAMPLE_RATE;
    if (sampled) {
      captureServerEvent({
        ...scope,
        event: POSTHOG_EVENTS.TRAFFIC_INGEST_RECEIVED,
        properties: {
          ...traits,
          sample_denominator: GEO_INGEST_RECEIVED_SAMPLE_DENOMINATOR,
        },
      });
    }
    if (firstHit || sampled) {
      yield* Effect.promise(() => flushPostHogServer());
    }
  }
);
