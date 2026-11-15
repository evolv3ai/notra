import { devToolsMiddleware } from "@ai-sdk/devtools";
import { EVALUATION_MODEL_ID } from "@notra/ai/constants/evaluation";
import { gateway as routedModel } from "@notra/ai/gateway";
import { readEnvSwitch } from "@notra/ai/utils/env-switch";
import { withGatewayAgentOptions } from "@notra/ai/utils/gateway-agent-model";
import { withGatewayEvaluationTelemetry } from "@notra/ai/utils/gateway-evaluation-model";
import { gatewayAttributionOptions } from "@notra/ai/utils/usage-attribution";
import { getOrganizationId } from "@notra/tools/utils/organization";
import { gateway, type LanguageModel, wrapLanguageModel } from "ai";
import { defineDynamic } from "eve";
import { defineState } from "eve/context";
import { autoModel } from "eve/experimental/evaluate";

import {
  ASSISTANT_AUTO_MODEL_OPTIONS,
  ASSISTANT_MODEL_ID,
  ASSISTANT_MODEL_TIERS,
  ASSISTANT_TASK_MODEL_ID,
  AUTO_MODEL_FLAG_ENV,
  GPT_6_SOL_CONTEXT_WINDOW_TOKENS,
  SONNET_5_CONTEXT_WINDOW_TOKENS,
} from "../constants/models";

export function createAgentModel(
  modelId: string,
  tag = "agent-chat",
  organizationId?: string | null
): LanguageModel {
  const tagged = withGatewayAgentOptions(
    routedModel(modelId, { organizationId: organizationId ?? undefined }),
    tag
  );
  if (process.env.AI_SDK_DEVTOOLS !== "true") {
    return tagged;
  }

  return wrapLanguageModel({
    model: tagged,
    middleware: devToolsMiddleware(),
  });
}

export function getStepTurnId(event: unknown): string | undefined {
  const turnId = (event as { data?: { turnId?: unknown } }).data?.turnId;
  return typeof turnId === "string" ? turnId : undefined;
}

interface AssistantModelSelection {
  turnId: string;
  modelId: string;
}

const assistantModelSelection = defineState<AssistantModelSelection | null>(
  "notra.assistant-model-selection",
  () => null
);

export function getSelectedAssistantModelId(turnId: string): string {
  const selection = assistantModelSelection.get();
  return selection?.turnId === turnId ? selection.modelId : ASSISTANT_MODEL_ID;
}

function isAutoModelEnabled(): boolean {
  return readEnvSwitch(AUTO_MODEL_FLAG_ENV, { defaultOn: true });
}

type DynamicModelResult = Awaited<
  ReturnType<
    NonNullable<ReturnType<typeof autoModel>["events"]["step.started"]>
  >
>;
type ModelSelection = Extract<DynamicModelResult, { reasoning?: unknown }>;

function isModelSelection(
  result: DynamicModelResult
): result is ModelSelection {
  return (
    typeof result === "object" &&
    "model" in result &&
    !("specificationVersion" in result)
  );
}

export function createAssistantModel() {
  return defineDynamic({
    events: {
      "step.started": async (event, ctx) => {
        const organizationId = getOrganizationId(ctx);
        // Models are built per step so the router sees the organization's
        // plan and ZDR entitlement.
        const autoOptions = Object.fromEntries(
          Object.entries(ASSISTANT_AUTO_MODEL_OPTIONS).map(
            ([modelId, { description, reasoning }]) => [
              modelId,
              {
                model: createAgentModel(modelId, "agent-chat", organizationId),
                description,
                reasoning,
              },
            ]
          )
        );
        const turnId = getStepTurnId(event);
        const providerOptions = {
          gateway: gatewayAttributionOptions({
            organizationId,
            sessionId: ctx.session.id,
            turnId,
          }),
        };
        const modelOptions = { providerOptions };
        const surface =
          ctx.session.auth.current?.attributes.surface ??
          ctx.session.auth.initiator?.attributes.surface;
        if (surface === "task") {
          if (turnId !== undefined) {
            assistantModelSelection.update(() => ({
              turnId,
              modelId: ASSISTANT_TASK_MODEL_ID,
            }));
          }
          return {
            model: createAgentModel(
              ASSISTANT_TASK_MODEL_ID,
              "agent-task",
              organizationId
            ),
            reasoning: "low" as const,
            modelContextWindowTokens: GPT_6_SOL_CONTEXT_WINDOW_TOKENS,
            modelOptions,
          };
        }

        if (!isAutoModelEnabled()) {
          if (turnId !== undefined) {
            assistantModelSelection.update(() => ({
              turnId,
              modelId: ASSISTANT_MODEL_ID,
            }));
          }
          return {
            model: createAgentModel(
              ASSISTANT_MODEL_ID,
              "agent-chat",
              organizationId
            ),
            modelContextWindowTokens: SONNET_5_CONTEXT_WINDOW_TOKENS,
            modelOptions,
          };
        }

        const auto = autoModel({
          model: withGatewayEvaluationTelemetry(
            gateway.evaluationModel(EVALUATION_MODEL_ID),
            {
              organizationId,
              sessionId: ctx.session.id,
              turnId,
            }
          ),
          providerOptions: {
            gateway: {
              ...providerOptions.gateway,
              tags: ["evaluation-agent-model"],
              zeroDataRetention: true,
              disallowPromptTraining: true,
            },
          },
          options: autoOptions,
        });
        const selectAutoModel = auto.events["step.started"];
        if (!selectAutoModel) {
          throw new Error("autoModel no longer resolves on step.started");
        }
        const selection = await selectAutoModel(event, ctx);
        let normalized = isModelSelection(selection)
          ? selection
          : { model: selection };
        const previous = assistantModelSelection.get();
        const retained = previous ? autoOptions[previous.modelId] : undefined;
        const candidateTier = ASSISTANT_MODEL_TIERS.indexOf(
          typeof normalized.model === "string"
            ? normalized.model
            : normalized.model.modelId
        );
        if (
          previous &&
          retained &&
          candidateTier >= 0 &&
          ASSISTANT_MODEL_TIERS.indexOf(previous.modelId) > candidateTier
        ) {
          normalized = {
            model: retained.model,
            reasoning: retained.reasoning,
          };
        }
        const { modelId } = normalized.model as { modelId?: unknown };
        if (typeof modelId === "string" && turnId !== undefined) {
          assistantModelSelection.update(() => ({ turnId, modelId }));
        }
        return {
          ...normalized,
          modelContextWindowTokens: SONNET_5_CONTEXT_WINDOW_TOKENS,
          modelOptions,
        };
      },
    },
  });
}
