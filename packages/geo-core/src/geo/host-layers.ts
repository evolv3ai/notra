import { resolveOrganizationPlan } from "@notra/ai/billing/plan";
import { isDemoMode } from "@notra/utils/demo-mode";
import { Effect, Layer } from "effect";

import { GeoCodingAgentAccessService } from "../deps";
import { agentReadinessNetworkDemo } from "./agent-readiness-demo";
import { agentReadinessNetworkLive } from "./agent-readiness-live";
import { GeoCodingAgentAccessError } from "./errors";
import { geoModelDemo } from "./model-demo";
import { geoModelLive } from "./model-live";

export const geoCodingAgentAccessLayer = Layer.succeed(
  GeoCodingAgentAccessService,
  {
    hasPaidPlanForOrganization: Effect.fn("GeoCodingAgentAccess.hasPaidPlan")(
      (organizationId) =>
        Effect.tryPromise({
          try: async () =>
            (await resolveOrganizationPlan(organizationId)) === "paid",
          catch: (cause) => new GeoCodingAgentAccessError({ cause }),
        })
    ),
  }
);

/**
 * The model and agent-readiness layers every host provides. The public demo
 * swaps in local fakes here, so hosts compose the same layers either way.
 */
export const geoModelLayer = isDemoMode() ? geoModelDemo : geoModelLive;

export const agentReadinessNetworkLayer = isDemoMode()
  ? agentReadinessNetworkDemo
  : agentReadinessNetworkLive;
