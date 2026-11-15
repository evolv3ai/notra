import { gateway } from "@notra/ai/gateway";
import { withRouterDefaults } from "@notra/ai/provider-options";
import type { AgentTokenUsage } from "@notra/ai/types/agents";
import { buildTelemetryOptions } from "@notra/ai/utils/tcc";
import { toAgentTokenUsage } from "@notra/ai/utils/token-usage";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import type * as z from "zod";

import type { AutopilotLogger } from "@/types/autopilot-runtime";

export async function generateAutopilotObject<T extends z.ZodType>(params: {
  organizationId: string;
  modelId: string;
  tag: string;
  schema: T;
  instructions: string;
  prompt: string;
  maxOutputTokens?: number;
  /** Reasoning for the retry when the first answer ran out of tokens. */
  retryReasoning?: "low" | "medium";
  log: AutopilotLogger;
  /** Reports what the call cost, e.g. to bill an @notra request. */
  onUsage?: (usage: AgentTokenUsage) => void;
}): Promise<z.infer<T>> {
  const startedAt = Date.now();
  const generate = (reasoning?: "low" | "medium") =>
    generateText({
      model: gateway(params.modelId, { organizationId: params.organizationId }),
      output: Output.object({ schema: params.schema }),
      instructions: params.instructions,
      prompt: params.prompt,
      maxOutputTokens: params.maxOutputTokens,
      reasoning,
      providerOptions: withRouterDefaults(
        { gateway: { tags: ["autopilot", params.tag] } },
        { modelId: params.modelId }
      ),
      ...buildTelemetryOptions({
        feature: "autopilot",
        organizationId: params.organizationId,
        routeName: `autopilot/${params.tag}`,
      }),
    });
  // Models occasionally loop inside a JSON string until the token limit; a
  // fresh sample almost always parses.
  const { output, usage } = await generate().catch(async (error: unknown) => {
    if (!NoObjectGeneratedError.isInstance(error)) {
      throw error;
    }
    // The failed attempt was paid for too.
    if (error.usage) {
      params.onUsage?.({
        ...toAgentTokenUsage(error.usage),
        modelId: params.modelId,
      });
    }
    const reasoning =
      error.finishReason === "length" ? params.retryReasoning : undefined;
    await params.log.action(`Retrying ${params.modelId} (${params.tag})`, {
      reason:
        error.finishReason === "length"
          ? "The response ran out of tokens"
          : "The response was not valid JSON",
      outputTokens: error.usage?.outputTokens ?? null,
      reasoning: reasoning ?? null,
    });
    return generate(reasoning);
  });
  params.onUsage?.({ ...toAgentTokenUsage(usage), modelId: params.modelId });
  await params.log.action(
    `Called ${params.modelId} (${params.tag})`,
    {
      model: params.modelId,
      inputTokens: usage.inputTokens ?? null,
      outputTokens: usage.outputTokens ?? null,
      durationMs: Date.now() - startedAt,
    },
    {
      instructions: params.instructions,
      prompt: params.prompt,
      output: JSON.stringify(output),
    }
  );
  return output as z.infer<T>;
}
