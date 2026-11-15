import type { SharedV4ProviderMetadata } from "@ai-sdk/provider";
import { ROUTER_METADATA_KEY } from "@notra/ai/constants/router";
import type {
  ModelCallUsage,
  RequestAIUsage,
  RequestLogger,
  RequestRouteCost,
} from "@notra/ai/types/request-ai-usage";
import { getOpenRequestLogger } from "@notra/ai/utils/evlog-request";
import { isRecord, nonNegativeNumber } from "@notra/utils/unknown-record";

const MICRO_USD = 1_000_000;

const usageByRequest = new WeakMap<RequestLogger, RequestAIUsage>();

function routeInfo(
  providerMetadata: SharedV4ProviderMetadata | undefined
): RequestRouteCost {
  const route = providerMetadata?.[ROUTER_METADATA_KEY];
  const record =
    route && typeof route === "object" && !Array.isArray(route) ? route : {};
  const { costUsd, model } = record;
  const generationId =
    record.generationId ?? providerMetadata?.gateway?.generationId;
  let gateway = typeof record.gateway === "string" ? record.gateway : undefined;
  if (!gateway && typeof providerMetadata?.gateway?.generationId === "string") {
    gateway = "vercel";
  }
  const completeCost =
    record.gateway !== "openrouter" ||
    nonNegativeNumber(record.byokInferenceCostUsd) !== undefined;
  return {
    costUsd: completeCost ? nonNegativeNumber(costUsd) : undefined,
    ...(gateway ? { gateway } : {}),
    ...(typeof generationId === "string" ? { generationId } : {}),
    ...(typeof model === "string" ? { model } : {}),
  };
}

function usageFor(logger: RequestLogger): RequestAIUsage {
  const existing = usageByRequest.get(logger);
  if (existing) {
    return existing;
  }
  const usage: RequestAIUsage = {
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
    costUsd: 0,
    unmeasuredCalls: 0,
    models: new Set<string>(),
    costedGenerations: new Set<string>(),
    pendingGenerations: new Set<string>(),
  };
  usageByRequest.set(logger, usage);
  const emit = logger.emit.bind(logger);
  // set() cannot clear an earlier subtotal. The final emit replaces ai with
  // its current rich fields and the complete total (or an explicit omission).
  logger.emit = (overrides) => {
    const ai = logger.getContext().ai;
    return emit({
      ...overrides,
      ai: {
        ...(isRecord(ai) ? ai : {}),
        ...(isRecord(overrides?.ai) ? overrides.ai : {}),
        ...roundedCost(usage),
      },
    });
  };
  return usage;
}

function roundedCost(usage: RequestAIUsage) {
  return {
    costUsd:
      usage.calls > 0 &&
      usage.unmeasuredCalls === 0 &&
      usage.pendingGenerations.size === 0
        ? Math.round(usage.costUsd * MICRO_USD) / MICRO_USD
        : undefined,
  };
}

/**
 * Roll a finished model call up into the current request's wide event as the
 * `ai` field (same shape evlog/ai writes), so tokens and cost sit next to the
 * route, feature and organization that spent them. The per-call
 * `ai.call.completed` event stays the detailed record.
 */
export function recordRequestAIUsage(call: ModelCallUsage): void {
  const logger = getOpenRequestLogger();
  if (!logger) {
    return;
  }
  const usage = usageFor(logger);
  const route = routeInfo(call.providerMetadata);
  const model = route.model ?? call.model;
  const inputTokens = call.inputTokens ?? 0;
  const outputTokens = call.outputTokens ?? 0;
  usage.calls += 1;
  usage.inputTokens += inputTokens;
  usage.outputTokens += outputTokens;
  usage.totalTokens += inputTokens + outputTokens;
  usage.cacheReadTokens += call.cacheReadTokens ?? 0;
  usage.cacheWriteTokens += call.cacheWriteTokens ?? 0;
  usage.reasoningTokens += call.reasoningTokens ?? 0;
  if (route.costUsd !== undefined) {
    if (
      !route.generationId ||
      !usage.costedGenerations.has(route.generationId)
    ) {
      usage.costUsd += route.costUsd;
    }
    if (route.generationId) {
      usage.costedGenerations.add(route.generationId);
      usage.pendingGenerations.delete(route.generationId);
    }
  } else if (route.gateway === "vercel" && route.generationId) {
    if (!usage.costedGenerations.has(route.generationId)) {
      usage.pendingGenerations.add(route.generationId);
    }
  } else {
    usage.unmeasuredCalls += 1;
  }
  // evlog concatenates arrays on set(), so only hand it models it hasn't seen.
  const newModel = !usage.models.has(model);
  usage.models.add(model);

  try {
    logger.set({
      ai: {
        calls: usage.calls,
        model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        cacheReadTokens: usage.cacheReadTokens,
        cacheWriteTokens: usage.cacheWriteTokens,
        reasoningTokens: usage.reasoningTokens,
        ...roundedCost(usage),
        ...(newModel ? { models: [model] } : {}),
      },
    });
  } catch {
    // A logging sink failure must never retry an already completed model call.
  }
}

/**
 * Vercel reports cost only through the generation lookup that billing already
 * runs after a call. Add that cost when it lands while the request event is
 * still open; no extra lookup is made for observability.
 */
export function recordRequestAICost(
  generationId: string,
  costUsd: number
): void {
  const logger = getOpenRequestLogger();
  if (!logger || !Number.isFinite(costUsd) || costUsd < 0) {
    return;
  }
  const usage = usageByRequest.get(logger);
  if (!usage || !usage.pendingGenerations.delete(generationId)) {
    return;
  }
  usage.costedGenerations.add(generationId);
  usage.costUsd += costUsd;
  try {
    logger.set({ ai: roundedCost(usage) });
  } catch {
    // Cost enrichment remains authoritative even when request logging fails.
  }
}
