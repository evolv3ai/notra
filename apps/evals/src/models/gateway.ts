import { createGateway } from "@ai-sdk/gateway";
import {
  ROUTER_METADATA_KEY,
  ROUTE_USAGE_LOOKUP_CONCURRENCY,
} from "@notra/ai/constants/router";
import { createVercelAdapter } from "@notra/ai/router/adapters/vercel";
import { isRecord } from "@notra/utils/unknown-record";
import {
  experimental_evaluate as evaluateWithModel,
  generateText,
  Output,
  type Experimental_EvaluationQuestion,
  type ModelMessage,
} from "ai";
import type { z } from "zod";

import { PROD_GATEWAY_CACHING } from "../constants/gateway";
import type {
  CallResult,
  EvalCost,
  EvalCostStep,
  TokenUsage,
  UsageLike,
} from "../types/eval";
import { readGatewayCost, summarizeCosts } from "../utils/cost";
import { priceFor } from "./pricing";

let gatewayInstance: ReturnType<typeof createGateway> | undefined;

export function getGateway(): ReturnType<typeof createGateway> {
  const apiKey = process.env.AI_GATEWAY_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "AI_GATEWAY_API_KEY is missing. Run from the repo root .env or use --demo."
    );
  }
  gatewayInstance ??= createGateway({
    apiKey,
    headers: {
      "http-referer": "https://www.usenotra.com",
      "x-title": "Notra evals",
    },
  });
  return gatewayInstance;
}

const gatewayProviderOptions = (feature: string) => ({
  gateway: {
    disallowPromptTraining: true,
    tags: [`eval-${feature}`],
    caching: PROD_GATEWAY_CACHING,
  },
});

export function toUsage(usage: UsageLike | undefined): TokenUsage {
  return {
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    cachedInputTokens: usage?.inputTokenDetails?.cacheReadTokens ?? 0,
  };
}

export async function runCostDetails(
  modelId: string,
  usage: TokenUsage,
  steps: readonly EvalCostStep[]
): Promise<EvalCost> {
  const calls: EvalCostStep[] = [...(steps.length ? steps : [{ usage }])];
  const apiKey = process.env.AI_GATEWAY_API_KEY?.trim();
  if (apiKey) {
    const adapter = createVercelAdapter({ apiKey });
    for (
      let offset = 0;
      offset < calls.length;
      offset += ROUTE_USAGE_LOOKUP_CONCURRENCY
    ) {
      const enriched = await Promise.all(
        calls
          .slice(offset, offset + ROUTE_USAGE_LOOKUP_CONCURRENCY)
          .map(async (step) => {
            const metadata = step.providerMetadata;
            const gateway = isRecord(metadata) ? metadata.gateway : undefined;
            if (
              !isRecord(gateway) ||
              typeof gateway.generationId !== "string" ||
              !gateway.generationId
            ) {
              return step;
            }
            try {
              const route = await adapter.lookupRouteMetadata?.(
                gateway.generationId
              );
              return {
                ...step,
                providerMetadata: {
                  ...(isRecord(metadata) ? metadata : {}),
                  [ROUTER_METADATA_KEY]: route,
                },
              };
            } catch {
              return step;
            }
          })
      );
      calls.splice(offset, enriched.length, ...enriched);
    }
  }
  const needsPrice = calls.some(
    (step) => readGatewayCost(step.providerMetadata) === undefined
  );
  return summarizeCosts(
    calls,
    needsPrice ? await priceFor(modelId) : undefined
  );
}

async function costFor(
  modelId: string,
  usage: UsageLike | undefined,
  metadata: unknown
): Promise<EvalCost> {
  return runCostDetails(modelId, toUsage(usage), [
    { usage, providerMetadata: metadata },
  ]);
}

export interface ObjectCallParams<SCHEMA extends z.ZodType> {
  modelId: string;
  feature: string;
  schema: SCHEMA;
  system?: string;
  prompt?: string;
  messages?: ModelMessage[];
  abortSignal: AbortSignal;
  temperature?: number;
  maxOutputTokens?: number;
  reasoning?: Parameters<typeof generateText>[0]["reasoning"];
  providerOptions?: Record<string, Record<string, unknown>>;
}

export async function callObject<SCHEMA extends z.ZodType>(
  params: ObjectCallParams<SCHEMA>
): Promise<CallResult<z.infer<SCHEMA>>> {
  const result = await generateText({
    model: getGateway()(params.modelId),
    system: params.system,
    messages: params.messages ?? [
      { role: "user", content: params.prompt ?? "" },
    ],
    output: Output.object({ schema: params.schema }),
    abortSignal: params.abortSignal,
    temperature: params.temperature,
    maxOutputTokens: params.maxOutputTokens,
    reasoning: params.reasoning,
    maxRetries: 0,
    providerOptions: {
      ...gatewayProviderOptions(params.feature),
      ...params.providerOptions,
    },
  });

  const usage = toUsage(result.totalUsage);
  return {
    output: result.output as z.infer<SCHEMA>,
    usage,
    ...(await runCostDetails(params.modelId, usage, result.steps)),
    transcript: result.text,
  };
}

export type JevQuestions = Readonly<
  Record<string, Experimental_EvaluationQuestion>
>;

export interface JevCallParams<QUESTIONS extends JevQuestions> {
  modelId: string;
  feature: string;
  state: Parameters<typeof evaluateWithModel>[0]["state"];
  questions: QUESTIONS;
  abortSignal: AbortSignal;
}

export interface JevAnswer<QUESTIONS extends JevQuestions> {
  answers: Awaited<ReturnType<typeof evaluateWithModel<QUESTIONS>>>["answers"];
  confidence: Record<string, number>;
}

export async function callJev<QUESTIONS extends JevQuestions>(
  params: JevCallParams<QUESTIONS>
): Promise<CallResult<JevAnswer<QUESTIONS>>> {
  const result = await evaluateWithModel({
    model: getGateway().evaluationModel(params.modelId),
    state: params.state,
    questions: params.questions,
    abortSignal: params.abortSignal,
    providerOptions: {
      gateway: {
        zeroDataRetention: true,
        disallowPromptTraining: true,
        tags: [`eval-${params.feature}`],
      },
    },
  });

  const confidence: Record<string, number> = {};
  const raw = (
    result.providerMetadata as
      | Record<string, Record<string, unknown>>
      | undefined
  )?.typesafe?.confidence;
  if (raw && typeof raw === "object") {
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === "number") {
        confidence[key] = value;
      }
    }
  }

  const usage = toUsage(result.usage as UsageLike);
  return {
    output: { answers: result.answers, confidence },
    usage,
    ...(await costFor(
      params.modelId,
      result.usage as UsageLike,
      result.providerMetadata
    )),
    transcript: JSON.stringify(
      { answers: result.answers, confidence },
      null,
      2
    ),
  };
}
