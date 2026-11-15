import { devToolsMiddleware } from "@ai-sdk/devtools";
import { gateway } from "@notra/ai/gateway";
import { withGatewayAgentOptions } from "@notra/ai/utils/gateway-agent-model";
import { gatewayAttributionOptions } from "@notra/ai/utils/usage-attribution";
import { getOrganizationId } from "@notra/tools/utils/organization";
import { wrapLanguageModel } from "ai";
import { defineDynamic } from "eve";

function buildModel(modelId: string, tag: string, organizationId?: string) {
  const tagged = withGatewayAgentOptions(
    gateway(modelId, { organizationId }),
    tag
  );
  return process.env.AI_SDK_DEVTOOLS === "true"
    ? wrapLanguageModel({ model: tagged, middleware: devToolsMiddleware() })
    : tagged;
}

export function createAgentModel(
  modelId: string,
  tag: string,
  modelContextWindowTokens: number
) {
  return defineDynamic({
    fallback: buildModel(modelId, tag),
    events: {
      "step.started": (event, ctx) => {
        const organizationId = getOrganizationId(ctx);
        const turnId = (event as { data?: { turnId?: unknown } }).data?.turnId;
        return {
          // Built per step so the router sees the organization's ZDR entitlement.
          model: buildModel(modelId, tag, organizationId ?? undefined),
          modelContextWindowTokens,
          modelOptions: {
            providerOptions: {
              gateway: gatewayAttributionOptions({
                organizationId,
                sessionId: ctx.session.id,
                turnId: typeof turnId === "string" ? turnId : undefined,
              }),
            },
          },
        };
      },
    },
  });
}
