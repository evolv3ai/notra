import type { GeoFxUsage } from "@notra/ai/types/geo-fx";
import type { GeoBoxTokenUsage } from "@notra/ai/types/geo-opencode";

export function geoFxTokenUsage(
  { usage }: GeoFxUsage,
  computeMs = 0
): GeoBoxTokenUsage {
  return {
    modelId: usage.modelId,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.inputTokens + usage.outputTokens,
    totalUsd: usage.totalUsd,
    inputTokenDetails: {
      noCacheTokens: Math.max(
        0,
        usage.inputTokens - usage.cacheReadTokens - usage.cacheWriteTokens
      ),
      cacheReadTokens: usage.cacheReadTokens,
      cacheWriteTokens: usage.cacheWriteTokens,
    },
    outputTokenDetails: {
      textTokens: Math.max(0, usage.outputTokens - usage.reasoningTokens),
      reasoningTokens: usage.reasoningTokens,
    },
    computeMs,
  };
}
