import type { ModelPrice } from "../models/pricing";
import type {
  CostSource,
  EvalCost,
  EvalCostStep,
  UsageLike,
} from "../types/eval";

export function readGatewayCost(metadata: unknown): number | undefined {
  const route = (
    metadata as
      | Record<string, { costUsd?: unknown; costSource?: unknown }>
      | undefined
  )?.[ROUTER_METADATA_KEY];
  if (route?.costSource !== "reported" || typeof route.costUsd !== "number") {
    return undefined;
  }
  const value = route.costUsd;
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function estimateCost(
  usage: UsageLike | undefined,
  price: ModelPrice | undefined
): number | undefined {
  if (!usage || !price) {
    return undefined;
  }
  const { inputTokens, outputTokens } = usage;
  const cached =
    usage.cachedInputTokens ?? usage.inputTokenDetails?.cacheReadTokens ?? 0;
  if (
    inputTokens === undefined ||
    outputTokens === undefined ||
    ![inputTokens, outputTokens, cached, price.input, price.output].every(
      (value) => Number.isFinite(value) && value >= 0
    ) ||
    cached > inputTokens
  ) {
    return undefined;
  }
  const cost =
    (inputTokens - cached) * price.input +
    cached * price.input * 0.1 +
    outputTokens * price.output;
  return Number.isFinite(cost) ? cost : undefined;
}

export function summarizeCosts(
  steps: readonly EvalCostStep[],
  price?: ModelPrice
): EvalCost {
  let reportedCostUsd = 0;
  let estimatedCostUsd = 0;
  let reported = false;
  let estimated = false;
  let unknown = steps.length === 0;
  for (const step of steps) {
    const cost = readGatewayCost(step.providerMetadata);
    if (cost !== undefined) {
      reportedCostUsd += cost;
      reported = true;
      continue;
    }
    const fallback = estimateCost(step.usage, price);
    if (fallback === undefined) {
      unknown = true;
    } else {
      estimatedCostUsd += fallback;
      estimated = true;
    }
  }
  const total = reportedCostUsd + estimatedCostUsd;
  unknown ||= !Number.isFinite(total);
  let costSource: CostSource = reported ? "reported" : "estimated";
  if (reported && estimated) {
    costSource = "mixed";
  }
  if (unknown) {
    costSource = "unknown";
  }
  return {
    costUsd: unknown ? undefined : total,
    costSource,
    reportedCostUsd,
    estimatedCostUsd,
  };
}

export function hasKnownCost(
  task: Partial<EvalCost>
): task is Partial<EvalCost> & { costUsd: number } {
  return (
    task.costSource !== "unknown" &&
    typeof task.costUsd === "number" &&
    Number.isFinite(task.costUsd) &&
    task.costUsd >= 0
  );
}

export function aggregateCosts(costs: readonly Partial<EvalCost>[]): EvalCost {
  let reportedCostUsd = 0;
  let estimatedCostUsd = 0;
  let reported = false;
  let estimated = false;
  let unknown = costs.length === 0;
  for (const cost of costs) {
    if (!hasKnownCost(cost)) {
      unknown = true;
      reportedCostUsd += cost.reportedCostUsd ?? 0;
      estimatedCostUsd += cost.estimatedCostUsd ?? 0;
      continue;
    }
    const source = cost.costSource ?? "estimated";
    reported ||= source === "reported" || source === "mixed";
    estimated ||= source === "estimated" || source === "mixed";
    if (source === "mixed") {
      reportedCostUsd += cost.reportedCostUsd ?? 0;
      estimatedCostUsd +=
        cost.estimatedCostUsd ?? cost.costUsd - (cost.reportedCostUsd ?? 0);
    } else if (source === "reported") {
      reportedCostUsd += cost.costUsd;
    } else {
      estimatedCostUsd += cost.costUsd;
    }
  }
  const total = reportedCostUsd + estimatedCostUsd;
  unknown ||= !Number.isFinite(total);
  let costSource: CostSource = reported ? "reported" : "estimated";
  if (reported && estimated) {
    costSource = "mixed";
  }
  if (unknown) {
    costSource = "unknown";
  }
  return {
    costUsd: unknown ? undefined : total,
    costSource,
    reportedCostUsd,
    estimatedCostUsd,
  };
}

export function sumKnownCosts(
  costs: readonly (number | undefined)[]
): number | undefined {
  let total = 0;
  for (const cost of costs) {
    if (cost === undefined || !Number.isFinite(cost) || cost < 0) {
      return undefined;
    }
    total += cost;
  }
  return Number.isFinite(total) ? total : undefined;
}
import { ROUTER_METADATA_KEY } from "@notra/ai/constants/router";
