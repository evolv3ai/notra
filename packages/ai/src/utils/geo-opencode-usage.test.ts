import { describe, expect, test } from "bun:test";

import { geoBoxTokenUsage } from "./geo-opencode-usage";
import { toAgentTokenUsage } from "./token-usage";

describe("GEO Box usage normalization", () => {
  test("keeps uncached and cached tokens separate for OpenCode and Codex", () => {
    const cost = {
      inputTokens: 100,
      cachedInputTokens: 60,
      outputTokens: 10,
      totalUsd: 0.04,
      computeMs: 90,
    };
    for (const harness of ["opencode", "codex"] as const) {
      const usage = geoBoxTokenUsage(cost, "test-model", harness);
      expect(usage).toMatchObject({
        modelId: "test-model",
        totalUsd: 0.04,
        computeMs: 90,
        inputTokens: 100,
        outputTokens: 10,
        totalTokens: 110,
        inputTokenDetails: { noCacheTokens: 40, cacheReadTokens: 60 },
      });
      expect(toAgentTokenUsage(usage).inputTokens).toBe(40);
      expect(usage.inputTokenDetails.cacheWriteTokens).toBeUndefined();
      expect(usage.outputTokenDetails.reasoningTokens).toBeUndefined();
    }
  });

  test("includes Claude native cache reads in the total without removing uncached input", () => {
    const usage = geoBoxTokenUsage(
      {
        inputTokens: 35,
        cachedInputTokens: 68_596,
        outputTokens: 650,
        totalUsd: 1.09965325,
        computeMs: 28_348,
      },
      "anthropic/claude-fable-5-1",
      "claude-code"
    );
    expect(usage).toMatchObject({
      inputTokens: 68_631,
      totalTokens: 69_281,
      inputTokenDetails: { noCacheTokens: 35, cacheReadTokens: 68_596 },
      totalUsd: 1.09965325,
    });
    expect(toAgentTokenUsage(usage)).toEqual({
      inputTokens: 35,
      outputTokens: 650,
      cacheReadTokens: 68_596,
      cacheWriteTokens: 0,
      totalTokens: 69_281,
    });
  });

  test("omits unavailable USD costs so token pricing remains possible", () => {
    for (const totalUsd of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const usage = geoBoxTokenUsage(
        {
          inputTokens: 1,
          outputTokens: 1,
          cachedInputTokens: 0,
          computeMs: 90,
          totalUsd,
        },
        "test-model"
      );
      expect(Object.hasOwn(usage, "totalUsd")).toBe(false);
    }
  });

  test("retains authoritative zero usage and cost", () => {
    expect(
      geoBoxTokenUsage(
        {
          inputTokens: 0,
          outputTokens: 0,
          cachedInputTokens: 0,
          computeMs: 0,
          totalUsd: 0,
        },
        "test-model"
      ).totalUsd
    ).toBe(0);
  });
});
