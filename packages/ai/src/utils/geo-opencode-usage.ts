import type {
  GeoBoxHarness,
  GeoBoxTokenUsage,
} from "@notra/ai/types/geo-opencode";
import type { RunCost } from "@upstash/box";

export function geoBoxTokenUsage(
  cost: RunCost,
  model: string,
  harness: GeoBoxHarness = "opencode"
): GeoBoxTokenUsage {
  const inputTokens =
    harness === "claude-code"
      ? cost.inputTokens + cost.cachedInputTokens
      : cost.inputTokens;
  return {
    modelId: model,
    ...(Number.isFinite(cost.totalUsd) &&
    (cost.totalUsd > 0 ||
      (cost.totalUsd === 0 &&
        cost.inputTokens === 0 &&
        cost.outputTokens === 0 &&
        cost.cachedInputTokens === 0))
      ? { totalUsd: cost.totalUsd }
      : {}),
    computeMs: cost.computeMs,
    inputTokens,
    inputTokenDetails: {
      noCacheTokens: Math.max(0, inputTokens - cost.cachedInputTokens),
      cacheReadTokens: cost.cachedInputTokens,
      cacheWriteTokens: undefined,
    },
    outputTokens: cost.outputTokens,
    outputTokenDetails: {
      textTokens: cost.outputTokens,
      reasoningTokens: undefined,
    },
    totalTokens: inputTokens + cost.outputTokens,
  };
}
