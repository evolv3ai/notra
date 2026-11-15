import {
  OPENAI_GPT_5_6_SOL_PRICING,
  OPENAI_LONG_CONTEXT_PROMPT_TOKENS,
} from "@notra/ai/constants/token-pricing";
import type { Balance } from "autumn-js";

import type { AgentTokenUsage } from "../types/agents";
import type { ModelPricing, ModelPricingSource } from "../types/billing";
import type { GatewayId } from "../types/router";

const CLAUDE_SONNET_4_6_PRICING: ModelPricing = {
  inputPerMillionTokens: 3.0,
  outputPerMillionTokens: 15.0,
  cacheReadPerMillionTokens: 0.3,
  cacheWritePerMillionTokens: 3.75,
};

const CLAUDE_SONNET_5_PRICING: ModelPricing = {
  inputPerMillionTokens: 2.0,
  outputPerMillionTokens: 10.0,
  cacheReadPerMillionTokens: 0.2,
  cacheWritePerMillionTokens: 2.5,
};

const CLAUDE_OPUS_5_PRICING: ModelPricing = {
  inputPerMillionTokens: 5.0,
  outputPerMillionTokens: 25.0,
  cacheReadPerMillionTokens: 0.5,
  cacheWritePerMillionTokens: 6.25,
};

const CLAUDE_OPUS_5_5_PRICING: ModelPricing = {
  inputPerMillionTokens: 4.0,
  outputPerMillionTokens: 20.0,
  cacheReadPerMillionTokens: 0.2,
  cacheWritePerMillionTokens: 5.0,
};

const CLAUDE_OPUS_4_8_PRICING: ModelPricing = {
  inputPerMillionTokens: 5.0,
  outputPerMillionTokens: 25.0,
  cacheReadPerMillionTokens: 0.5,
  cacheWritePerMillionTokens: 6.25,
};

const CLAUDE_FABLE_5_1_PRICING: ModelPricing = {
  inputPerMillionTokens: 10.0,
  outputPerMillionTokens: 50.0,
  cacheReadPerMillionTokens: 0.25,
  cacheWritePerMillionTokens: 12.5,
};

const CLAUDE_FABLE_5_PRICING: ModelPricing = {
  inputPerMillionTokens: 10.0,
  outputPerMillionTokens: 50.0,
  cacheReadPerMillionTokens: 1.0,
  cacheWritePerMillionTokens: 12.5,
};

export const MODEL_PRICING: Record<string, ModelPricing> = {
  "anthropic/claude-fable-5.1": CLAUDE_FABLE_5_1_PRICING,
  "anthropic/claude-fable-5-1": CLAUDE_FABLE_5_1_PRICING,
  "anthropic/claude-fable-5": CLAUDE_FABLE_5_PRICING,
  "opencode/claude-opus-5": CLAUDE_OPUS_5_PRICING,
  "anthropic/claude-opus-5": CLAUDE_OPUS_5_PRICING,
  "vercel/anthropic/claude-opus-5": CLAUDE_OPUS_5_PRICING,
  "opencode/claude-opus-5.5": CLAUDE_OPUS_5_5_PRICING,
  "anthropic/claude-opus-5.5": CLAUDE_OPUS_5_5_PRICING,
  "anthropic/claude-opus-5-5": CLAUDE_OPUS_5_5_PRICING,
  "vercel/anthropic/claude-opus-5.5": CLAUDE_OPUS_5_5_PRICING,
  "opencode/claude-opus-4-8": CLAUDE_OPUS_4_8_PRICING,
  "anthropic/claude-opus-4.8": CLAUDE_OPUS_4_8_PRICING,
  "vercel/anthropic/claude-opus-4.8": CLAUDE_OPUS_4_8_PRICING,
  "opencode/claude-sonnet-4-6": CLAUDE_SONNET_4_6_PRICING,
  "anthropic/claude-sonnet-4.6": CLAUDE_SONNET_4_6_PRICING,
  "vercel/anthropic/claude-sonnet-4.6": CLAUDE_SONNET_4_6_PRICING,
  "opencode/claude-sonnet-5": CLAUDE_SONNET_5_PRICING,
  "anthropic/claude-sonnet-5": CLAUDE_SONNET_5_PRICING,
  "vercel/anthropic/claude-sonnet-5": CLAUDE_SONNET_5_PRICING,
  "anthropic/claude-sonnet-5.5": CLAUDE_SONNET_5_PRICING,
  "anthropic/claude-sonnet-5-5": CLAUDE_SONNET_5_PRICING,
  "vercel/anthropic/claude-sonnet-5.5": CLAUDE_SONNET_5_PRICING,
  "anthropic/claude-haiku-4.5": {
    inputPerMillionTokens: 1.0,
    outputPerMillionTokens: 5.0,
    cacheReadPerMillionTokens: 0.1,
    cacheWritePerMillionTokens: 1.25,
  },
  "openai/gpt-5.4": {
    inputPerMillionTokens: 2.5,
    outputPerMillionTokens: 15.0,
    cacheReadPerMillionTokens: 0.25,
    cacheWritePerMillionTokens: 0,
    longContext: {
      promptTokens: OPENAI_LONG_CONTEXT_PROMPT_TOKENS,
      inputPerMillionTokens: 5.0,
      outputPerMillionTokens: 22.5,
      cacheReadPerMillionTokens: 0.5,
      cacheWritePerMillionTokens: 0,
    },
  },
  "openai/gpt-5.4-mini": {
    inputPerMillionTokens: 0.75,
    outputPerMillionTokens: 4.5,
    cacheReadPerMillionTokens: 0.075,
    cacheWritePerMillionTokens: 0,
  },
  "openai/gpt-5.4-nano": {
    inputPerMillionTokens: 0.2,
    outputPerMillionTokens: 1.25,
    cacheReadPerMillionTokens: 0.02,
    cacheWritePerMillionTokens: 0,
  },
  "openai/gpt-6-astra": {
    inputPerMillionTokens: 10.0,
    outputPerMillionTokens: 50.0,
    cacheReadPerMillionTokens: 1.0,
    cacheWritePerMillionTokens: 12.5,
    longContext: {
      promptTokens: OPENAI_LONG_CONTEXT_PROMPT_TOKENS,
      inputPerMillionTokens: 20.0,
      outputPerMillionTokens: 75.0,
      cacheReadPerMillionTokens: 2.0,
      cacheWritePerMillionTokens: 25.0,
    },
  },
  "google/gemini-3.8-flash": {
    inputPerMillionTokens: 0.75,
    outputPerMillionTokens: 3.75,
    cacheReadPerMillionTokens: 0.075,
    cacheWritePerMillionTokens: 0,
  },
  "openai/gpt-5.5": {
    inputPerMillionTokens: 5.0,
    outputPerMillionTokens: 30.0,
    cacheReadPerMillionTokens: 0.5,
    cacheWritePerMillionTokens: 0,
    longContext: {
      promptTokens: OPENAI_LONG_CONTEXT_PROMPT_TOKENS,
      inputPerMillionTokens: 10.0,
      outputPerMillionTokens: 45.0,
      cacheReadPerMillionTokens: 1.0,
      cacheWritePerMillionTokens: 0,
    },
  },
  "openai/gpt-6.1-sol": {
    inputPerMillionTokens: 2.0,
    outputPerMillionTokens: 10.0,
    cacheReadPerMillionTokens: 0.1,
    cacheWritePerMillionTokens: 2.5,
    longContext: {
      promptTokens: OPENAI_LONG_CONTEXT_PROMPT_TOKENS,
      inputPerMillionTokens: 4.0,
      outputPerMillionTokens: 15.0,
      cacheReadPerMillionTokens: 0.2,
      cacheWritePerMillionTokens: 5.0,
    },
  },
  "openai/gpt-6-sol": {
    inputPerMillionTokens: 2.0,
    outputPerMillionTokens: 10.0,
    cacheReadPerMillionTokens: 0.2,
    cacheWritePerMillionTokens: 2.5,
    longContext: {
      promptTokens: OPENAI_LONG_CONTEXT_PROMPT_TOKENS,
      inputPerMillionTokens: 4.0,
      outputPerMillionTokens: 15.0,
      cacheReadPerMillionTokens: 0.4,
      cacheWritePerMillionTokens: 5.0,
    },
  },
  "openai/gpt-6-luna": {
    inputPerMillionTokens: 0.1,
    outputPerMillionTokens: 0.5,
    cacheReadPerMillionTokens: 0.01,
    cacheWritePerMillionTokens: 0.125,
    longContext: {
      promptTokens: OPENAI_LONG_CONTEXT_PROMPT_TOKENS,
      inputPerMillionTokens: 0.2,
      outputPerMillionTokens: 0.75,
      cacheReadPerMillionTokens: 0.02,
      cacheWritePerMillionTokens: 0.25,
    },
  },
  "openai/gpt-5.6-luna": {
    inputPerMillionTokens: 0.2,
    outputPerMillionTokens: 1.2,
    cacheReadPerMillionTokens: 0.02,
    cacheWritePerMillionTokens: 0.25,
    longContext: {
      promptTokens: OPENAI_LONG_CONTEXT_PROMPT_TOKENS,
      inputPerMillionTokens: 0.4,
      outputPerMillionTokens: 1.8,
      cacheReadPerMillionTokens: 0.04,
      cacheWritePerMillionTokens: 0.5,
    },
  },
  "openai/gpt-5.6-terra": {
    inputPerMillionTokens: 2.0,
    outputPerMillionTokens: 12.0,
    cacheReadPerMillionTokens: 0.2,
    cacheWritePerMillionTokens: 2.5,
    longContext: {
      promptTokens: OPENAI_LONG_CONTEXT_PROMPT_TOKENS,
      inputPerMillionTokens: 4.0,
      outputPerMillionTokens: 18.0,
      cacheReadPerMillionTokens: 0.4,
      cacheWritePerMillionTokens: 5.0,
    },
  },
  "openai/gpt-5.6-sol": {
    inputPerMillionTokens: 2.0,
    outputPerMillionTokens: 10.0,
    cacheReadPerMillionTokens: 0.2,
    cacheWritePerMillionTokens: 2.5,
    longContext: {
      promptTokens: OPENAI_LONG_CONTEXT_PROMPT_TOKENS,
      inputPerMillionTokens: 4.0,
      outputPerMillionTokens: 15.0,
      cacheReadPerMillionTokens: 0.4,
      cacheWritePerMillionTokens: 5.0,
    },
  },
  "vercel/openai/gpt-5.6-sol": OPENAI_GPT_5_6_SOL_PRICING,
  "direct/openai/gpt-5.6-sol": OPENAI_GPT_5_6_SOL_PRICING,
  "moonshotai/kimi-k3": {
    inputPerMillionTokens: 3.0,
    outputPerMillionTokens: 15.0,
    cacheReadPerMillionTokens: 0.3,
    cacheWritePerMillionTokens: 0,
  },
  "openai/gpt-oss-120b": {
    inputPerMillionTokens: 0.1,
    outputPerMillionTokens: 0.5,
    cacheReadPerMillionTokens: 0.05,
    cacheWritePerMillionTokens: 0,
  },
  "zai/glm-5.3-flash": {
    inputPerMillionTokens: 0.15,
    outputPerMillionTokens: 0.5,
    cacheReadPerMillionTokens: 0.03,
    cacheWritePerMillionTokens: 0,
  },
  // Neon AI Gateway list prices (GET /v1/models, 2026-10-22).
  "anthropic/claude-haiku-5.5": {
    inputPerMillionTokens: 0.1,
    outputPerMillionTokens: 0.5,
    cacheReadPerMillionTokens: 0.01,
    cacheWritePerMillionTokens: 0.125,
  },
  "neon/anthropic/claude-opus-4.6": {
    inputPerMillionTokens: 5.0,
    outputPerMillionTokens: 25.0,
    cacheReadPerMillionTokens: 0.5,
    cacheWritePerMillionTokens: 6.25,
  },
  "openai/gpt-5-mini": {
    inputPerMillionTokens: 0.25,
    outputPerMillionTokens: 2.0,
    cacheReadPerMillionTokens: 0.025,
    cacheWritePerMillionTokens: 0,
  },
  "openai/gpt-oss-20b": {
    inputPerMillionTokens: 0.07,
    outputPerMillionTokens: 0.3,
    cacheReadPerMillionTokens: 0,
    cacheWritePerMillionTokens: 0,
  },
  "neon/google/gemini-3-flash": {
    inputPerMillionTokens: 0.5,
    outputPerMillionTokens: 3.0,
    cacheReadPerMillionTokens: 0.05,
    cacheWritePerMillionTokens: 0,
  },
  "google/gemini-3.5-flash": {
    inputPerMillionTokens: 1.5,
    outputPerMillionTokens: 9.0,
    cacheReadPerMillionTokens: 0.15,
    cacheWritePerMillionTokens: 0,
  },
  "google/gemini-3.1-pro-preview": {
    inputPerMillionTokens: 2.0,
    outputPerMillionTokens: 12.0,
    cacheReadPerMillionTokens: 0.2,
    cacheWritePerMillionTokens: 0,
  },
  "spacexai/grok-4.7": {
    inputPerMillionTokens: 2.5,
    outputPerMillionTokens: 7.5,
    cacheReadPerMillionTokens: 0.5,
    cacheWritePerMillionTokens: 0,
  },
  "zai/glm-5.3": {
    inputPerMillionTokens: 1.4,
    outputPerMillionTokens: 4.4,
    cacheReadPerMillionTokens: 0.26,
    cacheWritePerMillionTokens: 0,
  },
  "meta/llama-4-maverick": {
    inputPerMillionTokens: 0.5,
    outputPerMillionTokens: 1.5,
    cacheReadPerMillionTokens: 0,
    cacheWritePerMillionTokens: 0,
  },
  "neon/openai/gpt-5.6-sol": {
    inputPerMillionTokens: 5.0,
    outputPerMillionTokens: 30.0,
    cacheReadPerMillionTokens: 0.5,
    cacheWritePerMillionTokens: 6.25,
  },
  "neon/google/gemini-3.8-flash": {
    inputPerMillionTokens: 1.5,
    outputPerMillionTokens: 7.5,
    cacheReadPerMillionTokens: 0.15,
    cacheWritePerMillionTokens: 0,
  },
  "neon/openai/gpt-oss-120b": {
    inputPerMillionTokens: 0.15,
    outputPerMillionTokens: 0.6,
    cacheReadPerMillionTokens: 0,
    cacheWritePerMillionTokens: 0,
  },
};

const DEFAULT_PRICING: ModelPricing = {
  inputPerMillionTokens: 1.0,
  outputPerMillionTokens: 4.0,
  cacheReadPerMillionTokens: 0.1,
  cacheWritePerMillionTokens: 1.0,
};

export const MARKUP_PERCENT = 10;
export const MARKUP_MULTIPLIER = 1 + MARKUP_PERCENT / 100;

export const MINIMUM_COST_CENTS = 1;

export function calculateTokenCostCents(
  usage: AgentTokenUsage,
  modelId?: string,
  applyMarkup = true,
  gateway?: GatewayId
): number {
  const baseCostDollars = calculateTokenCostUsd(usage, modelId, gateway);

  const multiplier = applyMarkup ? MARKUP_MULTIPLIER : 1;
  const costCents = Math.ceil(baseCostDollars * multiplier * 100);

  return Math.max(costCents, MINIMUM_COST_CENTS);
}

/** Unrounded token cost; round and apply markup only when settling the total. */
export function calculateTokenCostUsd(
  usage: AgentTokenUsage,
  modelId?: string,
  source?: ModelPricingSource,
  serviceTier?: string
): number {
  if (usage.tokenCostUsd !== undefined) {
    return usage.tokenCostUsd;
  }

  const pricing = resolvePricingTier(getModelPricing(modelId, source), usage);
  const tierMultiplier =
    serviceTier === "flex" &&
    modelId?.startsWith("openai/") &&
    source !== "openrouter"
      ? 0.5
      : 1;

  const inputCostDollars =
    (usage.inputTokens / 1_000_000) * pricing.inputPerMillionTokens;
  const outputCostDollars =
    (usage.outputTokens / 1_000_000) * pricing.outputPerMillionTokens;
  const cacheReadCostDollars =
    (usage.cacheReadTokens / 1_000_000) * pricing.cacheReadPerMillionTokens;
  const cacheWriteCostDollars =
    (usage.cacheWriteTokens / 1_000_000) * pricing.cacheWritePerMillionTokens;

  return (
    tierMultiplier *
    (inputCostDollars +
      outputCostDollars +
      cacheReadCostDollars +
      cacheWriteCostDollars)
  );
}

export function shouldApplyMarkup(balance: Balance | null): boolean {
  if (!balance || balance.remaining <= 0) {
    return false;
  }

  if (balance.breakdown?.length) {
    const hasRemainingPlanCredits = balance.breakdown.some(
      (entry) => entry.remaining > 0 && entry.reset?.interval !== "one_off"
    );
    return !hasRemainingPlanCredits;
  }

  return false;
}

export function getModelPricing(
  modelId?: string,
  source?: ModelPricingSource
): ModelPricing {
  const normalizedModelId = modelId?.replace(/^openrouter\//, "");
  const routedModelId =
    source && normalizedModelId ? `${source}/${normalizedModelId}` : undefined;
  return (
    (routedModelId && MODEL_PRICING[routedModelId]) ||
    (normalizedModelId && MODEL_PRICING[normalizedModelId]) ||
    DEFAULT_PRICING
  );
}

/** Everything the model read for one call: fresh, cache-read and cache-write. */
export function promptTokensOf(usage: AgentTokenUsage): number {
  return (
    usage.maxPromptTokens ??
    usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
  );
}

function resolvePricingTier(
  pricing: ModelPricing,
  usage: AgentTokenUsage
): ModelPricing {
  const { longContext } = pricing;
  if (!longContext || promptTokensOf(usage) <= longContext.promptTokens) {
    return pricing;
  }
  return longContext;
}
