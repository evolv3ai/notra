import type { SharedV4ProviderMetadata } from "@ai-sdk/provider";
import type { getOpenRequestLogger } from "@notra/ai/utils/evlog-request";

export type RequestLogger = NonNullable<
  ReturnType<typeof getOpenRequestLogger>
>;

export interface RequestAIUsage {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  costUsd: number;
  unmeasuredCalls: number;
  models: Set<string>;
  costedGenerations: Set<string>;
  pendingGenerations: Set<string>;
}

export interface ModelCallUsage {
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
  providerMetadata?: SharedV4ProviderMetadata;
}

export interface RequestRouteCost {
  costUsd?: number;
  gateway?: string;
  generationId?: string;
  model?: string;
}
