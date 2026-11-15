import type { askGeoOpenCode } from "@notra/ai/agents/geo-opencode";
import { Effect } from "effect";

import { GeoCodingAgentAccessService, GeoModelService } from "../../src/deps";
import type { GeoModelServiceShape } from "../../src/types/model";
import { CODING_AGENT_USAGE } from "../constants/coding-agents";
import { fakeModels } from "../constants/geo-boundaries";

export function withCodingAgentModels(
  models: GeoModelServiceShape = fakeModels
) {
  return <A, E>(
    effect: Effect.Effect<A, E, GeoModelService | GeoCodingAgentAccessService>
  ) =>
    effect.pipe(
      Effect.provideService(GeoModelService, models),
      Effect.provideService(GeoCodingAgentAccessService, {
        hasPaidPlanForOrganization: () => Effect.succeed(true),
      })
    );
}

export function codingAgentAnswer(
  text = "Notra is a good choice. https://docs.example.com/guide"
): Awaited<ReturnType<typeof askGeoOpenCode>> {
  return {
    text,
    sources: [{ url: "https://docs.example.com/guide", title: null }],
    groundingSources: [
      { url: "https://example.com/search-result", title: null },
    ],
    toolCalls: [{ input: { query: "content generation tools" } }],
    usage: CODING_AGENT_USAGE,
  };
}
