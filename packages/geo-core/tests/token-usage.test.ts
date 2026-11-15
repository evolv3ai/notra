import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";

import { calculateAiCreditCostCents } from "@notra/ai/billing/ai-credit-cost";
import { getModelPricing } from "@notra/ai/billing/token-pricing";
import { geoBoxTokenUsage } from "@notra/ai/utils/geo-opencode-usage";

import { geoBoxAgentForEngine } from "../src/utils/geo-coding-agents";
import {
  addAgentTokenUsage,
  addLanguageModelTokenUsage,
  EMPTY_AGENT_TOKEN_USAGE,
} from "../src/utils/token-usage";

describe("GEO billing usage", () => {
  test.each([
    ["claude-code/claude-sonnet-5.5", 2, 10],
    ["claude-code/claude-opus-5.5", 4, 20],
    ["claude-code/claude-fable-5.1", 10, 50],
    ["codex/gpt-6.1-sol", 2, 10],
    ["codex/gpt-6-luna", 0.1, 0.5],
    ["codex/gpt-6-astra", 10, 50],
    ["opencode/gpt-6.1-sol-medium", 2, 10],
    ["opencode/gpt-6-luna", 0.1, 0.5],
    ["opencode/gpt-6-astra", 10, 50],
    ["opencode/claude-sonnet-5.5", 2, 10],
    ["opencode/claude-opus-5.5", 4, 20],
  ] as const)("%s prices its actual run model", (engine, input, output) => {
    const target = geoBoxAgentForEngine(engine);
    assert.ok(target);
    expect(getModelPricing(target.model)).toMatchObject({
      inputPerMillionTokens: input,
      outputPerMillionTokens: output,
    });
  });

  test("Codex fallback pricing matches its observed Box backend run cost", () => {
    const usage = geoBoxTokenUsage(
      {
        inputTokens: 28_747,
        outputTokens: 96,
        cachedInputTokens: 12_359,
        computeMs: 6469,
        totalUsd: 0,
      },
      "openai/gpt-6-astra",
      "codex"
    );
    expect(usage.totalUsd).toBeUndefined();
    const priced = addAgentTokenUsage(EMPTY_AGENT_TOKEN_USAGE, usage);
    expect(priced.totalUsd).toBeCloseTo(0.181039, 8);
    expect(priced.cacheReadTokens).toBe(12_359);
    expect(priced.inputTokens).toBe(16_388);
  });

  test("adds usage from retried language-model calls", () => {
    const usage = addLanguageModelTokenUsage(
      {
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
        inputTokenDetails: {
          noCacheTokens: 7,
          cacheReadTokens: 2,
          cacheWriteTokens: 1,
        },
        outputTokenDetails: { textTokens: 5, reasoningTokens: 15 },
      },
      {
        inputTokens: 4,
        outputTokens: 6,
        totalTokens: 10,
        inputTokenDetails: {
          noCacheTokens: 4,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
        outputTokenDetails: { textTokens: 6, reasoningTokens: 0 },
      }
    );

    expect(usage).toEqual({
      inputTokens: 14,
      outputTokens: 26,
      totalTokens: 40,
      inputTokenDetails: {
        noCacheTokens: 11,
        cacheReadTokens: 2,
        cacheWriteTokens: 1,
      },
      outputTokenDetails: { textTokens: 11, reasoningTokens: 15 },
    });
  });

  test("keeps Box costs through turn, batch, and project aggregation", () => {
    const opusTarget = geoBoxAgentForEngine("claude-code/claude-opus-5.5");
    const codexTarget = geoBoxAgentForEngine("codex/gpt-6-astra");
    assert.ok(opusTarget);
    assert.ok(codexTarget);
    const opus = geoBoxTokenUsage(
      {
        inputTokens: 1_000_000,
        outputTokens: 100_000,
        cachedInputTokens: 200_000,
        computeMs: 1200,
        totalUsd: 6.74,
      },
      opusTarget.model
    );
    const codex = geoBoxTokenUsage(
      {
        inputTokens: 500_000,
        outputTokens: 50_000,
        cachedInputTokens: 100_000,
        computeMs: 800,
        totalUsd: 1.25,
      },
      codexTarget.model
    );
    expect(opus.modelId).toBe("anthropic/claude-opus-5.5");
    expect(codex.modelId).toBe("openai/gpt-6-astra");
    const sequence = addAgentTokenUsage(
      addAgentTokenUsage(EMPTY_AGENT_TOKEN_USAGE, opus),
      codex
    );
    const batch = addAgentTokenUsage(EMPTY_AGENT_TOKEN_USAGE, sequence);
    const project = addAgentTokenUsage(
      EMPTY_AGENT_TOKEN_USAGE,
      structuredClone(batch)
    );
    expect(project.totalUsd).toBe(7.99);
    expect(project.inputTokens).toBe(1_200_000);
    expect(project.cacheReadTokens).toBe(300_000);
    expect(
      calculateAiCreditCostCents(project, "claude-code/claude-opus-5", false)
        .costCents
    ).toBe(799);
    expect(
      calculateAiCreditCostCents(project, "openai/gpt-5.4-mini", true).costCents
    ).toBe(879);
  });

  test("uses the mapped model when Box has no reported cost", () => {
    const opusTarget = geoBoxAgentForEngine("claude-code/claude-opus-5.5");
    assert.ok(opusTarget);
    const usage = geoBoxTokenUsage(
      {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        cachedInputTokens: 200_000,
        computeMs: 1000,
        totalUsd: 0,
      },
      opusTarget.model
    );
    const total = addAgentTokenUsage(EMPTY_AGENT_TOKEN_USAGE, usage);
    expect(total.totalUsd).toBeCloseTo(23.24);
    expect(
      calculateAiCreditCostCents(total, "openai/gpt-5.4-mini", false).costCents
    ).toBe(2324);
  });

  test("includes token-priced calls alongside reported Box costs without rounding each call", () => {
    const box = geoBoxTokenUsage(
      {
        inputTokens: 100,
        outputTokens: 10,
        cachedInputTokens: 0,
        computeMs: 100,
        totalUsd: 0.005,
      },
      "anthropic/claude-opus-5"
    );
    const batch = addAgentTokenUsage(EMPTY_AGENT_TOKEN_USAGE, box);
    const mixed = addAgentTokenUsage(batch, {
      inputTokens: 1000,
      outputTokens: 0,
      totalTokens: 1000,
      modelId: "anthropic/claude-opus-5",
    });
    expect(mixed.totalUsd).toBe(0.01);
    expect(calculateAiCreditCostCents(mixed, undefined, false).costCents).toBe(
      1
    );
  });

  test("prices untagged tokens as the judge model, not an engine", () => {
    const tokens = {
      inputTokens: 1_000_000,
      outputTokens: 0,
      totalTokens: 1_000_000,
    };
    const untagged = addAgentTokenUsage(EMPTY_AGENT_TOKEN_USAGE, tokens);
    const asJudge = addAgentTokenUsage(EMPTY_AGENT_TOKEN_USAGE, {
      ...tokens,
      modelId: "openai/gpt-5.4-nano",
    });
    const asEngine = addAgentTokenUsage(EMPTY_AGENT_TOKEN_USAGE, {
      ...tokens,
      modelId: "anthropic/claude-opus-5",
    });
    expect(untagged.totalUsd).toBe(asJudge.totalUsd);
    expect(asEngine.totalUsd).not.toBe(untagged.totalUsd);
  });

  test("uses the gateway-specific price for routed model usage", () => {
    const total = addAgentTokenUsage(EMPTY_AGENT_TOKEN_USAGE, {
      inputTokens: 100_000,
      outputTokens: 100_000,
      totalTokens: 200_000,
      modelId: "openai/gpt-5.6-sol",
      route: {
        gateway: "vercel",
        requestedModel: "openai/gpt-5.6-sol",
        model: "openai/gpt-5.6-sol",
        reason: "paid",
      },
    });
    expect(total.totalUsd).toBeCloseTo(2.4);
  });

  test("settles raw token usage using the served route", () => {
    const cost = calculateAiCreditCostCents(
      {
        inputTokens: 100_000,
        outputTokens: 100_000,
        totalTokens: 200_000,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        route: {
          gateway: "vercel",
          requestedModel: "openai/gpt-5.6-sol",
          model: "openai/gpt-5.4-mini",
          reason: "paid",
        },
      },
      "openai/gpt-5.4-mini",
      false,
      "vercel"
    );

    expect(cost.billingBasis).toBe("tokens");
    expect(cost.costCents).toBe(53);
  });

  test("uses preserved per-call cost for a mixed-route aggregate", () => {
    const cost = calculateAiCreditCostCents(
      {
        inputTokens: 200_000,
        outputTokens: 200_000,
        totalTokens: 400_000,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        tokenCostUsd: 1.725,
        route: {
          gateway: "vercel",
          requestedModel: "openai/gpt-5.6-sol",
          model: "openai/gpt-5.6-sol",
          reason: "paid",
        },
      },
      "openai/gpt-5.6-sol",
      false,
      "vercel"
    );

    expect(cost.costCents).toBe(173);
  });
});
