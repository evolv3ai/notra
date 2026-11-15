import { GatewayError } from "@ai-sdk/gateway";
import type { LanguageModelV4CallOptions } from "@ai-sdk/provider";
import {
  HTTP_PAYMENT_REQUIRED,
  HTTP_TOO_MANY_REQUESTS,
  ROUTER_METADATA_KEY,
} from "@notra/ai/constants/router";
import { log } from "@notra/ai/evlog";
import { createVercelAdapter } from "@notra/ai/router/adapters/vercel";
import { readStatusCode } from "@notra/ai/router/upstream-failure";
import type {
  ModelCallTelemetry,
  ModelCallTelemetryOptions,
} from "@notra/ai/types/model-call-telemetry";
import type {
  ResolvedRoute,
  RouterLogFields,
  VercelAdapterConfig,
} from "@notra/ai/types/router";
import { getEvlogRuntime } from "@notra/ai/utils/evlog-runtime";
import { readGatewayLimitDetails } from "@notra/ai/utils/gateway-limit-details";
import { getOperationalContext } from "@notra/ai/utils/operational-context";
import { promptCacheTelemetry } from "@notra/ai/utils/prompt-cache-telemetry";
import {
  recordRequestAICost,
  recordRequestAIUsage,
} from "@notra/ai/utils/request-ai-usage";
import { getUsageAttribution } from "@notra/ai/utils/usage-attribution";
import { nonNegativeNumber } from "@notra/utils/unknown-record";

/** One lifecycle per SDK model invocation, including any router fallback. */
export function createModelCallTelemetry({
  logger,
  request,
  operation,
  signal,
  providerOptions,
  prompt,
  tools,
  lookupRouteMetadata,
}: ModelCallTelemetryOptions): ModelCallTelemetry {
  const callId = crypto.randomUUID();
  const attribution = getUsageAttribution(providerOptions);
  const context = {
    ...attribution,
    ...getOperationalContext(),
    ...request.logContext,
  };
  const tags = providerOptions?.gateway?.tags;
  const startedAt = performance.now();
  let route: ResolvedRoute | undefined;
  let servedModelId: string | undefined;
  let attemptCount = 0;
  let msToFirstChunk: number | undefined;
  let finished = false;
  let completionRecorded = false;
  let limitRecorded = false;

  const currentModel = () =>
    servedModelId ?? route?.decision.modelId ?? request.modelId;

  function emit(
    level: "info" | "warn" | "error",
    event: string,
    fields: RouterLogFields = {}
  ) {
    try {
      logger[level](event, {
        ...context,
        requestId: context.requestId ?? callId,
        ...(Array.isArray(tags)
          ? { tags: tags.filter((tag) => typeof tag === "string") }
          : {}),
        callId,
        operation,
        organizationId: request.organizationId ?? context.organizationId,
        attribution:
          Array.isArray(tags) && tags.includes("attribution:complete")
            ? "complete"
            : "partial",
        requestedModel: request.modelId,
        model: currentModel(),
        gateway: route?.decision.gateway ?? request.gateway,
        attemptCount,
        fallbackFrom: route?.decision.fallbackFrom,
        fallbackReason: route?.decision.fallbackReason,
        zdrEnforced: route?.decision.zdrEnforced,
        zdrRelaxed: route?.decision.zdrRelaxed,
        ...fields,
      });
    } catch {
      // Observability must not turn a provider success into a retry or failure.
    }
  }

  function finish(
    level: "info" | "warn" | "error",
    event: string,
    ai: Record<string, string | number | undefined> = {},
    fields: RouterLogFields = {}
  ) {
    if (finished) {
      return;
    }
    finished = true;
    signal?.removeEventListener("abort", abort);
    const durationMs = Math.round(performance.now() - startedAt);
    emit(level, event, {
      durationMs,
      ai: {
        model: currentModel(),
        msToFinish: durationMs,
        msToFirstChunk,
        ...ai,
      },
      ...fields,
    });
  }

  function abort() {
    finish("warn", "ai.call.aborted");
  }

  function recordLimit(error: unknown) {
    if (finished || limitRecorded || signal?.aborted) {
      return;
    }
    try {
      const status = readStatusCode(error);
      if (
        status === HTTP_PAYMENT_REQUIRED ||
        status === HTTP_TOO_MANY_REQUESTS
      ) {
        limitRecorded = true;
        emit("warn", "ai.call.limit_hit", {
          status,
          ...readGatewayLimitDetails(error),
        });
      }
    } catch {
      // Diagnostic extraction must not change fallback or error propagation.
    }
  }

  async function enrichCost(generationId: string) {
    try {
      const lookup = lookupRouteMetadata ?? route?.adapter.lookupRouteMetadata;
      const enriched = await lookup?.(generationId);
      if (!enriched) {
        return;
      }
      if (enriched.costUsd !== undefined) {
        recordRequestAICost(generationId, enriched.costUsd);
      }
      emit("info", "ai.cost.reported", {
        ...enriched,
        costId: `${route?.decision.gateway ?? request.gateway}:${generationId}`,
        generationId,
      });
      emit("info", "ai.call.cost_enriched", {
        ...enriched,
        generationId,
        costSource: enriched.costSource ?? "unknown",
      });
    } catch (error) {
      emit("warn", "ai.call.cost_lookup_failed", {
        generationId,
        costSource: "unknown",
        status: GatewayError.isInstance(error) ? error.statusCode : undefined,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    emit(
      "info",
      "ai.call.started",
      prompt ? promptCacheTelemetry({ prompt, tools }) : {}
    );
  } catch {
    // Hashing is diagnostic only and must not prevent a provider call.
    emit("info", "ai.call.started");
  }
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) {
    abort();
  }

  return {
    attempt(nextRoute) {
      if (nextRoute) {
        route = nextRoute;
      }
      attemptCount += 1;
      limitRecorded = false;
    },
    attemptFailed: recordLimit,
    firstChunk() {
      msToFirstChunk ??= Math.round(performance.now() - startedAt);
    },
    complete(result) {
      if (completionRecorded) {
        return;
      }
      completionRecorded = true;
      const inputTokens = result.usage.inputTokens.total;
      const outputTokens = result.usage.outputTokens.total;
      const serviceTier =
        result.providerMetadata?.gateway?.serviceTier ??
        result.providerMetadata?.openai?.serviceTier;
      const failed = result.finishReason.unified === "error";
      const generationId =
        result.providerMetadata?.[ROUTER_METADATA_KEY]?.generationId ??
        result.providerMetadata?.gateway?.generationId;
      const routeMetadata = result.providerMetadata?.[ROUTER_METADATA_KEY];
      servedModelId =
        typeof routeMetadata?.model === "string" &&
        routeMetadata.model.trim().length > 0
          ? routeMetadata.model
          : undefined;
      const gatewayCostUsd = nonNegativeNumber(routeMetadata?.gatewayCostUsd);
      if (
        route?.decision.gateway === "openrouter" &&
        routeMetadata &&
        gatewayCostUsd !== undefined
      ) {
        const byokInferenceCostUsd = nonNegativeNumber(
          routeMetadata.byokInferenceCostUsd
        );
        emit("info", "ai.cost.reported", {
          costId: `openrouter:${result.responseId ?? callId}`,
          gatewayCostUsd,
          byokInferenceCostUsd,
          costUsd:
            byokInferenceCostUsd === undefined
              ? undefined
              : nonNegativeNumber(routeMetadata.costUsd),
          upstreamProvider:
            typeof routeMetadata.upstreamProvider === "string"
              ? routeMetadata.upstreamProvider
              : undefined,
        });
      }
      recordRequestAIUsage({
        model: currentModel(),
        inputTokens,
        outputTokens,
        cacheReadTokens: result.usage.inputTokens.cacheRead,
        cacheWriteTokens: result.usage.inputTokens.cacheWrite,
        reasoningTokens: result.usage.outputTokens.reasoning,
        providerMetadata: result.providerMetadata,
      });
      finish(
        failed ? "error" : "info",
        failed ? "ai.call.failed" : "ai.call.completed",
        {
          inputTokens,
          outputTokens,
          totalTokens:
            inputTokens !== undefined && outputTokens !== undefined
              ? inputTokens + outputTokens
              : undefined,
          cacheReadTokens: result.usage.inputTokens.cacheRead,
          cacheWriteTokens: result.usage.inputTokens.cacheWrite,
          serviceTier:
            typeof serviceTier === "string" ? serviceTier : undefined,
          reasoningTokens: result.usage.outputTokens.reasoning,
          finishReason: result.finishReason.unified,
          ...(typeof routeMetadata?.costUsd === "number"
            ? { costUsd: routeMetadata.costUsd }
            : {}),
          responseId:
            result.responseId ??
            (typeof generationId === "string" ? generationId : undefined),
        },
        {
          ...(typeof generationId === "string" ? { generationId } : {}),
          upstreamProvider:
            typeof routeMetadata?.upstreamProvider === "string"
              ? routeMetadata.upstreamProvider
              : undefined,
          gatewayCostUsd:
            typeof routeMetadata?.gatewayCostUsd === "number"
              ? routeMetadata.gatewayCostUsd
              : undefined,
          upstreamInferenceCostUsd:
            typeof routeMetadata?.upstreamInferenceCostUsd === "number"
              ? routeMetadata.upstreamInferenceCostUsd
              : undefined,
          isByok:
            typeof routeMetadata?.isByok === "boolean"
              ? routeMetadata.isByok
              : undefined,
          costSource:
            typeof routeMetadata?.costSource === "string"
              ? routeMetadata.costSource
              : "unknown",
          ...(failed
            ? { error: "Provider returned an error finish reason" }
            : {}),
        }
      );
      if (
        (lookupRouteMetadata ?? route?.adapter.lookupRouteMetadata) &&
        typeof generationId === "string" &&
        generationId.length > 0 &&
        routeMetadata?.costSource !== "reported"
      ) {
        const runtime = getEvlogRuntime();
        runtime.pendingAIUsage ??= new Set();
        const pending = runtime.pendingAIUsage;
        const enrichment = enrichCost(generationId);
        pending.add(enrichment);
        void enrichment.finally(() => pending.delete(enrichment));
      }
    },
    fail(error) {
      if (
        signal?.aborted ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        abort();
        return;
      }
      recordLimit(error);
      finish(
        "error",
        "ai.call.failed",
        {},
        {
          errorName: error instanceof Error ? error.name : typeof error,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    },
    abort,
    incomplete() {
      finish(
        "warn",
        "ai.call.incomplete",
        {},
        {
          error: "Stream closed without a finish event",
        }
      );
    },
  };
}

/** Direct Eve models share the router's lifecycle logs without changing routes. */
export function createGatewayCallTelemetry(
  modelId: string,
  params: Pick<LanguageModelV4CallOptions, "providerOptions" | "abortSignal">,
  operation: "generate" | "stream" | "evaluate",
  gatewayConfig: VercelAdapterConfig = {
    apiKey: process.env.AI_GATEWAY_API_KEY,
  }
) {
  return createModelCallTelemetry({
    logger: {
      info: (event, fields) => log.info({ event, ...fields }),
      warn: (event, fields) => log.warn({ event, ...fields }),
      error: (event, fields) => log.error({ event, ...fields }),
    },
    request: { modelId, gateway: "vercel" },
    providerOptions: params.providerOptions,
    signal: params.abortSignal,
    operation,
    lookupRouteMetadata: createVercelAdapter(gatewayConfig).lookupRouteMetadata,
  });
}
