import type {
  FallbackReason,
  GatewayCheckContext,
  GatewayId,
  PlanLookup,
  ResolverContext,
  RouteDecision,
  RouteRequest,
  UsableAdapter,
  ZdrMode,
} from "@notra/ai/types/router";

import {
  GatewayCreditBalanceError,
  GatewayNotConfiguredError,
  GatewayUnavailableError,
  NoCompliantRouteError,
  UnsupportedModelError,
} from "./errors";
import { decideGateway, fallbackGateways } from "./policy";

async function lookupPlan(
  context: ResolverContext,
  organizationId: string
): Promise<PlanLookup> {
  const result = await context.lookupPlan(organizationId);
  if (!result) {
    return { plan: "free", source: "default" };
  }
  return { plan: result.value, source: result.source };
}

/**
 * Resolve how strictly the request wants zero data retention. An explicit
 * caller choice wins; otherwise the organization's entitlement decides.
 * Requests without an organization and lookup failures fail closed.
 */
async function lookupZdrMode(
  context: ResolverContext,
  request: RouteRequest
): Promise<ZdrMode> {
  if (request.zdr) {
    return request.zdr;
  }
  const { organizationId } = request;
  if (!organizationId) {
    return "required";
  }
  const result = await context.lookupZdr(organizationId);
  return result?.value ?? "required";
}

/**
 * Whether `gateway` can serve the request: configured, serves the model and
 * its provider-defined tools, not marked unavailable, and privacy compliant.
 * Shared by route resolution and the runtime fallback after a failed call.
 */
export function getUsableAdapter(
  context: GatewayCheckContext,
  gateway: GatewayId,
  request: Pick<RouteRequest, "modelId" | "organizationId" | "toolIds">,
  zdr: ZdrMode
): UsableAdapter | { unavailable: FallbackReason } {
  const { modelId, organizationId } = request;
  const adapter = context.adapters[gateway];
  if (!adapter) {
    return { unavailable: "not-configured" };
  }
  if (!adapter.supportsModel(modelId)) {
    return { unavailable: "unsupported-model" };
  }
  if (!adapter.supportsTools(modelId, request.toolIds ?? [])) {
    return { unavailable: "unsupported-tool" };
  }
  const unavailableReason = context.credits.unavailableReason(gateway, modelId);
  if (unavailableReason) {
    if (unavailableReason === "non-compliant" && zdr === "none") {
      return { adapter, zdrEnforced: false, zdrRelaxed: true };
    }
    return { unavailable: unavailableReason };
  }
  if (zdr === "none") {
    return { adapter, zdrEnforced: false, zdrRelaxed: true };
  }
  if (adapter.enforcesZdr) {
    return { adapter, zdrEnforced: true };
  }
  if (context.policy.allowNonZdr) {
    context.logger.warn("ai.router.zdr_bypassed", {
      gateway: adapter.id,
      modelId,
      organizationId,
    });
    return { adapter, zdrEnforced: false };
  }
  return { unavailable: "non-compliant" };
}

function getRelaxedAdapter(
  context: ResolverContext,
  gateway: GatewayId,
  request: RouteRequest,
  unavailable: FallbackReason
): UsableAdapter | undefined {
  const adapter = context.adapters[gateway];
  if (unavailable !== "non-compliant" || !adapter) {
    return undefined;
  }
  if (
    !adapter.supportsModel(request.modelId) ||
    !adapter.supportsTools(request.modelId, request.toolIds ?? [])
  ) {
    return undefined;
  }
  const reason = context.credits.unavailableReason(gateway);
  if (reason) {
    return undefined;
  }
  return { adapter, zdrEnforced: false, zdrRelaxed: true };
}

function toDecision(
  candidate: UsableAdapter,
  request: RouteRequest,
  planLookup: PlanLookup | undefined,
  zdr: ZdrMode,
  reason: RouteDecision["reason"],
  fallback?: { from: GatewayId; reason: FallbackReason }
): RouteDecision {
  const usable: UsableAdapter =
    zdr === "none"
      ? { adapter: candidate.adapter, zdrEnforced: false, zdrRelaxed: true }
      : candidate;
  return {
    gateway: usable.adapter.id,
    requestedModelId: request.modelId,
    modelId: usable.adapter.mapModelId(request.modelId),
    organizationId: request.organizationId,
    plan: planLookup?.plan,
    planSource: planLookup?.source,
    reason,
    ...(fallback
      ? { fallbackFrom: fallback.from, fallbackReason: fallback.reason }
      : {}),
    zdr,
    zdrEnforced: usable.zdrEnforced,
    ...(usable.zdrRelaxed ? { zdrRelaxed: true } : {}),
  };
}

function throwUnavailable(
  gateway: GatewayId,
  modelId: string,
  reason: FallbackReason
): never {
  if (reason === "not-configured") {
    throw new GatewayNotConfiguredError(gateway);
  }
  if (reason === "unsupported-model" || reason === "unsupported-tool") {
    throw new UnsupportedModelError(gateway, modelId);
  }
  if (reason === "no-credits") {
    throw new GatewayCreditBalanceError(0, gateway);
  }
  if (reason === "auth-failure") {
    throw new GatewayUnavailableError(gateway, "authentication failed");
  }
  throw new NoCompliantRouteError(modelId, `${gateway}: ${reason}`);
}

/**
 * Pick the gateway for a request, verify the adapter can serve it and that
 * the route is privacy compliant. Tries the remaining gateways when the
 * preferred one is unavailable for the model. A `preferred` request that
 * finds no ZDR-capable route anywhere runs relaxed on a gateway that only
 * lacks a ZDR host for the model.
 */
export async function resolveRoute(
  context: ResolverContext,
  request: RouteRequest
): Promise<RouteDecision> {
  const { modelId, organizationId } = request;

  const [planLookup, zdr] = await Promise.all([
    organizationId && !request.gateway
      ? lookupPlan(context, organizationId)
      : Promise.resolve(undefined),
    lookupZdrMode(context, request),
  ]);

  const decision = decideGateway({
    policy: context.policy,
    organizationId,
    plan: planLookup?.plan,
    pinned: request.gateway,
  });

  const primary = getUsableAdapter(context, decision.gateway, request, zdr);
  if ("adapter" in primary) {
    return toDecision(primary, request, planLookup, zdr, decision.reason);
  }

  const acceptsNonZdr = zdr !== "required";
  const canCrossGateway =
    context.policy.crossGatewayFallback && !request.gateway;
  if (!canCrossGateway) {
    const relaxed = acceptsNonZdr
      ? getRelaxedAdapter(
          context,
          decision.gateway,
          request,
          primary.unavailable
        )
      : undefined;
    if (relaxed) {
      logRelaxedRoute(context, decision.gateway, modelId, organizationId);
      return toDecision(relaxed, request, planLookup, zdr, decision.reason);
    }
    throwUnavailable(decision.gateway, modelId, primary.unavailable);
  }

  const alternatives = fallbackGateways(decision.gateway).map((gateway) => ({
    gateway,
    candidate: getUsableAdapter(context, gateway, request, zdr),
  }));
  for (const { candidate } of alternatives) {
    if ("adapter" in candidate) {
      context.logger.info("ai.router.fallback", {
        from: decision.gateway,
        to: candidate.adapter.id,
        fallbackReason: primary.unavailable,
        modelId,
        organizationId,
      });
      return toDecision(candidate, request, planLookup, zdr, "fallback", {
        from: decision.gateway,
        reason: primary.unavailable,
      });
    }
  }

  if (acceptsNonZdr) {
    for (const { gateway, candidate } of [
      { gateway: decision.gateway, candidate: primary },
      ...alternatives,
    ]) {
      if ("adapter" in candidate) {
        continue;
      }
      const relaxed = getRelaxedAdapter(
        context,
        gateway,
        request,
        candidate.unavailable
      );
      if (relaxed) {
        logRelaxedRoute(context, gateway, modelId, organizationId);
        return toDecision(
          relaxed,
          request,
          planLookup,
          zdr,
          gateway === decision.gateway ? decision.reason : "fallback",
          gateway === decision.gateway
            ? undefined
            : { from: decision.gateway, reason: primary.unavailable }
        );
      }
    }
  }

  const unavailable = [
    { gateway: decision.gateway, reason: primary.unavailable },
    ...alternatives.map(({ gateway, candidate }) => ({
      gateway,
      reason:
        "unavailable" in candidate
          ? candidate.unavailable
          : ("not-configured" as const),
    })),
  ];
  if (unavailable.some(({ reason }) => reason === "non-compliant")) {
    context.logger.error("ai.router.no_compliant_route", {
      modelId,
      organizationId,
    });
    throw new NoCompliantRouteError(
      modelId,
      unavailable
        .map(({ gateway, reason }) => `${gateway}: ${reason}`)
        .join(", ")
    );
  }
  const failure = unavailable.find(({ reason }) => reason !== "not-configured");
  if (!failure) {
    throw new GatewayNotConfiguredError("any");
  }
  throwUnavailable(failure.gateway, modelId, failure.reason);
}

function logRelaxedRoute(
  context: ResolverContext,
  gateway: GatewayId,
  modelId: string,
  organizationId: string | undefined
): void {
  context.logger.warn("ai.router.zdr_bypassed", {
    gateway,
    modelId,
    organizationId,
    bypassReason: "caller-accepts-non-zdr",
  });
}
