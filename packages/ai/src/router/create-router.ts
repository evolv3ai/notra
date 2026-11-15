import { GatewayError } from "@ai-sdk/gateway";
import type { SharedV4ProviderMetadata } from "@ai-sdk/provider";
import {
  DEFAULT_CREDIT_CHECK_TTL_MS,
  DEFAULT_PLAN_CACHE_TTL_MS,
  GATEWAY_FALLBACK_ORDER,
  ORGANIZATION_LOOKUP_CACHE_CAPACITY,
  ORGANIZATION_LOOKUP_FAILURE_TTL_MS,
  ROUTER_METADATA_KEY,
} from "@notra/ai/constants/router";
import type {
  GatewayId,
  ModelRouter,
  ModelRouterConfig,
  ResolverContext,
  RouteDecision,
  RouteMetadata,
  RouteRequest,
  RouterLogger,
} from "@notra/ai/types/router";
import { getOperationalContext } from "@notra/ai/utils/operational-context";
import { recordRequestAICost } from "@notra/ai/utils/request-ai-usage";
import { Cache, Effect } from "effect";

import { createCreditTracker } from "./credits";
import { GatewayCreditBalanceError } from "./errors";
import { RoutedLanguageModel } from "./lazy-model";
import { createOrganizationLookup } from "./organization-cache";
import { resolveRoute } from "./resolve";

const noopLogger: RouterLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRouteMetadata(value: unknown): value is RouteMetadata {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.gateway === "string" &&
    typeof record.requestedModel === "string" &&
    typeof record.model === "string" &&
    typeof record.reason === "string"
  );
}

export function createModelRouter(config: ModelRouterConfig): ModelRouter {
  const logger = config.logger ?? noopLogger;
  const now = config.now ?? (() => Date.now());
  const credits = createCreditTracker(
    config.creditCheckTtlMs ?? DEFAULT_CREDIT_CHECK_TTL_MS,
    now
  );

  const planCacheTtlMs = config.planCacheTtlMs ?? DEFAULT_PLAN_CACHE_TTL_MS;
  const resolveZdr =
    config.resolveZdr ?? (() => Promise.resolve("required" as const));

  const context: ResolverContext = {
    adapters: config.adapters,
    policy: config.policy,
    lookupPlan: createOrganizationLookup({
      resolve: config.resolvePlan,
      store: config.planCache,
      ttlMs: planCacheTtlMs,
      failureTtlMs: ORGANIZATION_LOOKUP_FAILURE_TTL_MS,
      capacity: ORGANIZATION_LOOKUP_CACHE_CAPACITY,
      now,
      onFailure: (organizationId, error) =>
        logger.warn("ai.router.plan_lookup_failed", {
          organizationId,
          error: errorMessage(error),
        }),
    }),
    lookupZdr: createOrganizationLookup({
      resolve: resolveZdr,
      store: config.zdrCache,
      ttlMs: planCacheTtlMs,
      failureTtlMs: ORGANIZATION_LOOKUP_FAILURE_TTL_MS,
      capacity: ORGANIZATION_LOOKUP_CACHE_CAPACITY,
      now,
      onFailure: (organizationId, error) =>
        logger.warn("ai.router.zdr_lookup_failed", {
          organizationId,
          error: errorMessage(error),
        }),
    }),
    logger,
    credits,
  };

  const resolve = (request: RouteRequest) => resolveRoute(context, request);

  const fetchBalance = Effect.fn("ai.router.fetchBalance")(function* (
    gateway: GatewayId
  ) {
    const adapter = config.adapters[gateway];
    if (!adapter) {
      return;
    }
    yield* Effect.tryPromise(() => adapter.getBalance()).pipe(
      Effect.match({
        onSuccess: ({ balance }) => {
          credits.record(gateway, balance);
          logger.info("ai.router.credits", { gateway, balance });
        },
        onFailure: (error) => {
          logger.warn("ai.router.credits_check_failed", {
            gateway,
            error: errorMessage(error.cause),
          });
          credits.record(gateway, null);
        },
      })
    );
  });

  // Shares one in-flight balance check per gateway between concurrent
  // requests. Freshness stays with the credit tracker, so nothing is kept
  // once the check settles.
  const balanceChecks = Effect.runSync(
    Cache.makeWith(fetchBalance, {
      capacity: GATEWAY_FALLBACK_ORDER.length,
      timeToLive: () => 0,
    })
  );

  const refreshBalance = async (decision: RouteDecision): Promise<void> => {
    if (
      !config.adapters[decision.gateway] ||
      !credits.isStale(decision.gateway)
    ) {
      return;
    }
    await Effect.runPromise(Cache.get(balanceChecks, decision.gateway));
  };

  const assertRouteHasCredits = async (
    request: RouteRequest
  ): Promise<RouteDecision> => {
    for (let attempt = 0; ; attempt += 1) {
      const decision = await resolve(request);
      await refreshBalance(decision);
      if (!credits.isExhausted(decision.gateway)) {
        return decision;
      }
      if (
        !config.policy.crossGatewayFallback ||
        request.gateway ||
        attempt === GATEWAY_FALLBACK_ORDER.length - 1
      ) {
        throw new GatewayCreditBalanceError(
          credits.snapshot(decision.gateway)?.balance ?? 0,
          decision.gateway
        );
      }
    }
  };

  return {
    adapters: config.adapters,
    policy: config.policy,
    model(modelId, options) {
      return new RoutedLanguageModel({
        request: {
          modelId,
          organizationId: options?.organizationId,
          gateway: options?.gateway,
          zdr: options?.zdr,
          logContext: options?.logContext,
        },
        policy: config.policy,
        adapters: config.adapters,
        logger,
        credits,
        resolve,
      });
    },
    resolveRoute: resolve,
    assertRouteHasCredits,
    getRouteMetadata(providerMetadata: SharedV4ProviderMetadata | undefined) {
      const value = providerMetadata?.[ROUTER_METADATA_KEY];
      return isRouteMetadata(value) ? value : undefined;
    },
    async enrichRouteMetadata(metadata, signal) {
      const adapter = config.adapters[metadata.gateway];
      if (!metadata.generationId || !adapter?.lookupRouteMetadata) {
        return metadata;
      }
      try {
        const enriched = await adapter.lookupRouteMetadata(
          metadata.generationId,
          signal
        );
        try {
          if (enriched.costUsd !== undefined) {
            recordRequestAICost(metadata.generationId, enriched.costUsd);
          }
          logger.info("ai.cost.reported", {
            costId: `${metadata.gateway}:${metadata.generationId}`,
            ...(metadata.organizationId
              ? { organizationId: metadata.organizationId }
              : {}),
            generationId: metadata.generationId,
            gateway: metadata.gateway,
            model: enriched.model ?? metadata.model,
            upstreamProvider: enriched.upstreamProvider,
            gatewayCostUsd: enriched.gatewayCostUsd,
            byokInferenceCostUsd: enriched.byokInferenceCostUsd,
            isByok: enriched.isByok,
            costUsd: enriched.costUsd,
          });
        } catch {
          // Logging must not discard successfully fetched billing metadata.
        }
        try {
          logger.info("ai.call.cost_enriched", {
            ...getOperationalContext(),
            generationId: metadata.generationId,
            gateway: metadata.gateway,
            model: enriched.model ?? metadata.model,
            upstreamProvider: enriched.upstreamProvider,
            costUsd: enriched.costUsd,
            gatewayCostUsd: enriched.gatewayCostUsd,
            upstreamInferenceCostUsd: enriched.upstreamInferenceCostUsd,
            isByok: enriched.isByok,
            costSource: enriched.costSource,
          });
        } catch {
          // Enrichment can outlive its request; logging is still best-effort.
        }
        return { ...metadata, ...enriched };
      } catch (error) {
        try {
          logger.warn("ai.router.generation_lookup_failed", {
            organizationId: metadata.organizationId,
            gateway: metadata.gateway,
            generationId: metadata.generationId,
            status: GatewayError.isInstance(error)
              ? error.statusCode
              : undefined,
            error: error instanceof Error ? error.message : String(error),
          });
        } catch {
          // A logging failure must not turn a best-effort lookup into a failure.
        }
        return metadata;
      }
    },
  };
}
