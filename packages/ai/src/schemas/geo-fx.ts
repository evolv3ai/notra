import { z } from "zod";

export const geoFxUsageSchema = z.object({
  kind: z.literal("notra_fx_usage"),
  verified: z.boolean(),
  timedOut: z.boolean().optional(),
  costBasis: z.literal("gateway.marketCost"),
  usage: z.object({
    modelId: z.string(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    cacheReadTokens: z.number().int().nonnegative(),
    cacheWriteTokens: z.number().int().nonnegative(),
    reasoningTokens: z.number().int().nonnegative(),
    totalUsd: z.number().nonnegative(),
  }),
});
