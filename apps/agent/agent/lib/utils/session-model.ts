import { gatewayAttributionOptions } from "@notra/ai/utils/usage-attribution";
import { getOrganizationId } from "@notra/tools/utils/organization";
import { defineDynamic } from "eve";

import { createAgentModel, getStepTurnId } from "./model";

export function createSessionAgentModel(
  modelId: string,
  tag: string,
  modelContextWindowTokens: number
) {
  return defineDynamic({
    events: {
      "step.started": (event, ctx) => {
        const organizationId = getOrganizationId(ctx);
        return {
          model: createAgentModel(modelId, tag, organizationId),
          modelContextWindowTokens,
          modelOptions: {
            providerOptions: {
              gateway: gatewayAttributionOptions({
                organizationId,
                sessionId: ctx.session.id,
                turnId: getStepTurnId(event),
              }),
            },
          },
        };
      },
    },
  });
}
