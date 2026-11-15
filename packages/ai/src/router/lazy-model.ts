import type {
  JSONObject,
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4GenerateResult,
  LanguageModelV4StreamPart,
  LanguageModelV4StreamResult,
  SharedV4ProviderMetadata,
} from "@ai-sdk/provider";
import {
  DAILY_LIMIT_ERROR_PATTERN,
  HTTP_TOO_MANY_REQUESTS,
  NO_TRAINING_PROVIDER_ERROR_PATTERN,
  ROUTED_MODEL_PROVIDER,
  ROUTER_METADATA_KEY,
} from "@notra/ai/constants/router";
import type { ModelCallTelemetry } from "@notra/ai/types/model-call-telemetry";
import type {
  FallbackReason,
  GatewayAdapter,
  GatewayId,
  ResolvedRoute,
  RouteDecision,
  RoutedModelContext,
  RouteMetadata,
} from "@notra/ai/types/router";
import { readGatewayLimitDetails } from "@notra/ai/utils/gateway-limit-details";
import { createModelCallTelemetry } from "@notra/ai/utils/model-call-telemetry";
import { observeModelStream } from "@notra/ai/utils/observe-model-stream";
import { withUsageAttribution } from "@notra/ai/utils/usage-attribution";

import { GatewayUnavailableError } from "./errors";
import { fallbackGateways } from "./policy";
import { splitRouterOptions } from "./provider-options";
import { getUsableAdapter } from "./resolve";
import {
  classifyUpstreamFailure,
  readMessage,
  readStatusCode,
} from "./upstream-failure";

/** Copy only the fields that are set, so metadata stays JSON without undefined. */
function definedFields<T extends object>(fields: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

function providerToolIds(options: LanguageModelV4CallOptions): string[] {
  return (options.tools ?? [])
    .flatMap((tool) => (tool.type === "provider" ? [tool.id] : []))
    .sort();
}

function buildRouteMetadata(
  decision: RouteDecision,
  adapter: GatewayAdapter,
  providerMetadata: SharedV4ProviderMetadata | undefined,
  servedModelId?: string
): RouteMetadata {
  // Without a served id (e.g. Gemini) map the id we sent back to the neutral one.
  const extracted = adapter.extractRouteMetadata(
    providerMetadata,
    servedModelId ?? decision.modelId
  );
  return {
    gateway: decision.gateway,
    requestedModel: decision.requestedModelId,
    model: extracted.model ?? decision.modelId,
    reason: decision.reason,
    ...definedFields({
      organizationId: decision.organizationId || undefined,
      plan: decision.plan,
      generationId: extracted.generationId || undefined,
      upstreamProvider: extracted.upstreamProvider || undefined,
      costUsd: extracted.costUsd,
      gatewayCostUsd: extracted.gatewayCostUsd,
      upstreamInferenceCostUsd: extracted.upstreamInferenceCostUsd,
      isByok: extracted.isByok,
      costSource: extracted.costSource,
      byokInferenceCostUsd: extracted.byokInferenceCostUsd,
      fallbackFrom: decision.fallbackFrom,
      fallbackReason: decision.fallbackReason,
    }),
    zdrEnforced: decision.zdrEnforced,
  };
}

function annotateProviderMetadata(
  providerMetadata: SharedV4ProviderMetadata | undefined,
  route: ResolvedRoute,
  servedModelId?: string
): SharedV4ProviderMetadata {
  const metadata = buildRouteMetadata(
    route.decision,
    route.adapter,
    providerMetadata,
    servedModelId
  );
  return {
    ...providerMetadata,
    [ROUTER_METADATA_KEY]: metadata as unknown as JSONObject,
  };
}

function annotateStream(
  stream: ReadableStream<LanguageModelV4StreamPart>,
  route: ResolvedRoute
): ReadableStream<LanguageModelV4StreamPart> {
  let observedProviderMetadata: SharedV4ProviderMetadata | undefined;
  let servedModelId: string | undefined;
  return stream.pipeThrough(
    new TransformStream<LanguageModelV4StreamPart, LanguageModelV4StreamPart>({
      transform(part, controller) {
        if (part.type === "response-metadata" && part.modelId) {
          servedModelId = part.modelId;
        }
        if ("providerMetadata" in part && part.providerMetadata) {
          observedProviderMetadata = {
            ...observedProviderMetadata,
            ...part.providerMetadata,
          };
        }
        if (part.type === "finish") {
          controller.enqueue({
            ...part,
            providerMetadata: annotateProviderMetadata(
              observedProviderMetadata,
              route,
              servedModelId
            ),
          });
          return;
        }
        controller.enqueue(part);
      },
    })
  );
}

function decisionLogFields(decision: RouteDecision) {
  return {
    organizationId: decision.organizationId,
    plan: decision.plan,
    planSource: decision.planSource,
    gateway: decision.gateway,
    requestedModel: decision.requestedModelId,
    model: decision.modelId,
    reason: decision.reason,
    fallbackFrom: decision.fallbackFrom,
    fallbackReason: decision.fallbackReason,
    zdr: decision.zdr,
    zdrEnforced: decision.zdrEnforced,
    zdrRelaxed: decision.zdrRelaxed,
  };
}

/**
 * LanguageModelV4 that resolves its route (plan lookup, gateway choice,
 * privacy options) lazily on first use and delegates to the concrete gateway
 * model. Compatible with wrapLanguageModel/middleware wrappers because it
 * only exposes the V4 surface.
 */
export class RoutedLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = "v4" as const;
  readonly provider = ROUTED_MODEL_PROVIDER;
  readonly modelId: string;
  readonly supportedUrls: PromiseLike<Record<string, RegExp[]>>;

  private readonly context: RoutedModelContext;
  private routePromise: Promise<ResolvedRoute> | undefined;
  /** Provider tools the cached route was resolved for. */
  private routeToolIds: readonly string[] = [];
  private zdrRelaxed = false;

  constructor(context: RoutedModelContext) {
    this.context = context;
    this.modelId = context.request.modelId;
    // Lazy thenable: wrappers read `supportedUrls` eagerly, and we must not
    // start route resolution (or leak rejections) before the first call.
    this.supportedUrls = {
      // biome-ignore lint/suspicious/noThenProperty: intentional lazy thenable so wrappers can read supportedUrls without triggering resolution
      then: (onFulfilled, onRejected) =>
        this.getRoute(this.routeToolIds)
          .then((route) => route.model.supportedUrls)
          .then(onFulfilled, onRejected),
    };
  }

  async doGenerate(
    inputOptions: LanguageModelV4CallOptions
  ): Promise<LanguageModelV4GenerateResult> {
    const options = this.withAttribution(inputOptions);
    const telemetry = createModelCallTelemetry({
      logger: this.context.logger,
      request: this.context.request,
      operation: "generate",
      signal: options.abortSignal,
      providerOptions: options.providerOptions,
      prompt: options.prompt,
      tools: options.tools,
    });
    try {
      const result = await this.execute(
        options,
        telemetry,
        async (route, params) => {
          telemetry.attempt(route);
          const generated = await route.model.doGenerate(params);
          return {
            ...generated,
            providerMetadata: annotateProviderMetadata(
              generated.providerMetadata,
              route,
              generated.response?.modelId
            ),
          };
        }
      );
      telemetry.complete({ ...result, responseId: result.response?.id });
      return result;
    } catch (error) {
      telemetry.fail(error);
      throw error;
    }
  }

  async doStream(
    inputOptions: LanguageModelV4CallOptions
  ): Promise<LanguageModelV4StreamResult> {
    const options = this.withAttribution(inputOptions);
    const telemetry = createModelCallTelemetry({
      logger: this.context.logger,
      request: this.context.request,
      operation: "stream",
      signal: options.abortSignal,
      providerOptions: options.providerOptions,
      prompt: options.prompt,
      tools: options.tools,
    });
    try {
      return await this.execute(options, telemetry, async (route, params) => {
        telemetry.attempt(route);
        const result = await route.model.doStream(params);
        return {
          ...result,
          stream: observeModelStream(
            annotateStream(result.stream, route),
            telemetry
          ),
        };
      });
    } catch (error) {
      telemetry.fail(error);
      throw error;
    }
  }

  private getRoute(toolIds: readonly string[]): Promise<ResolvedRoute> {
    if (toolIds.join() !== this.routeToolIds.join()) {
      this.routeToolIds = toolIds;
      this.routePromise = undefined;
    }
    if (!this.routePromise) {
      const promise = this.resolvePrimary(toolIds);
      this.routePromise = promise;
      promise.catch(() => {
        if (this.routePromise === promise) {
          this.routePromise = undefined;
        }
      });
    }
    return this.routePromise;
  }

  private async resolvePrimary(
    toolIds: readonly string[]
  ): Promise<ResolvedRoute> {
    const decision = await this.context.resolve({
      ...this.context.request,
      toolIds,
    });
    const route = this.materialize(decision);
    this.context.logger.info("ai.router.route", decisionLogFields(decision));
    return route;
  }

  private materialize(decision: RouteDecision): ResolvedRoute {
    const adapter = this.context.adapters[decision.gateway];
    if (!adapter) {
      throw new Error(
        `Router resolved gateway "${decision.gateway}" but no adapter is registered.`
      );
    }
    return {
      decision,
      adapter,
      model: adapter.createModel(decision.requestedModelId),
    };
  }

  private withAttribution(options: LanguageModelV4CallOptions) {
    return {
      ...options,
      providerOptions: withUsageAttribution(options.providerOptions, {
        ...this.context.request.logContext,
        ...(this.context.request.organizationId
          ? { organizationId: this.context.request.organizationId }
          : {}),
      }),
    };
  }

  private buildParams(
    route: ResolvedRoute,
    options: LanguageModelV4CallOptions
  ): LanguageModelV4CallOptions {
    const { router, rest } = splitRouterOptions(options.providerOptions);
    const providerOptions = route.adapter.buildProviderOptions({
      organizationId: this.context.request.organizationId,
      // Adapters translate explicit privacy constraints before stripping foreign blocks.
      providerOptions: rest,
      router,
      allowNonZdr: this.context.policy.allowNonZdr,
      relaxZdr: this.zdrRelaxed || route.decision.zdrRelaxed === true,
    });
    return { ...options, providerOptions };
  }

  private async execute<T>(
    options: LanguageModelV4CallOptions,
    telemetry: ModelCallTelemetry,
    run: (
      route: ResolvedRoute,
      params: LanguageModelV4CallOptions
    ) => Promise<T>
  ): Promise<T> {
    const toolIds = providerToolIds(options);
    let route = await this.getRoute(toolIds);
    const attempted = new Set<GatewayId>();
    for (;;) {
      attempted.add(route.decision.gateway);
      try {
        return await run(route, this.buildParams(route, options));
      } catch (error) {
        telemetry.attemptFailed(error);
        const fallback = await this.tryFallbackRoute(
          route,
          error,
          attempted,
          toolIds
        );
        if (!fallback) {
          throw error;
        }
        route = fallback;
      }
    }
  }

  private canRelaxZdr(route: ResolvedRoute): boolean {
    return (
      route.decision.zdr === "preferred" &&
      !this.zdrRelaxed &&
      route.decision.zdrRelaxed !== true
    );
  }

  private relaxZdr(
    route: ResolvedRoute,
    error: unknown,
    toolIds: readonly string[]
  ): ResolvedRoute {
    this.zdrRelaxed = true;
    const decision: RouteDecision = {
      ...route.decision,
      zdrEnforced: false,
      zdrRelaxed: true,
    };
    this.context.logger.warn("ai.router.zdr_bypassed", {
      ...decisionLogFields(decision),
      bypassReason: "caller-preferred",
      message: readMessage(error),
    });
    const relaxedRoute: ResolvedRoute = { ...route, decision };
    if (toolIds.join() === this.routeToolIds.join()) {
      this.routePromise = Promise.resolve(relaxedRoute);
    }
    return relaxedRoute;
  }

  private verifyExhaustion(gateway: GatewayId): void {
    const adapter = this.context.adapters[gateway];
    if (!adapter) {
      return;
    }
    adapter
      .getBalance()
      .then(({ balance }) => {
        if (balance !== null) {
          this.context.credits.record(gateway, balance);
        }
        this.context.logger.info("ai.router.credits_verified", {
          gateway,
          balance,
        });
      })
      .catch(() => {
        // Verification is best effort; keep the pessimistic mark.
      });
  }

  private recordUpstreamFailure(
    route: ResolvedRoute,
    reason: FallbackReason,
    error: unknown
  ): boolean {
    if (reason === "no-credits") {
      this.context.credits.markExhausted(route.decision.gateway);
      this.verifyExhaustion(route.decision.gateway);
      return true;
    }
    if (
      reason === "upstream-error" &&
      readStatusCode(error) === HTTP_TOO_MANY_REQUESTS &&
      DAILY_LIMIT_ERROR_PATTERN.test(readMessage(error))
    ) {
      // A daily cap holds until the day resets: skip the gateway for the
      // unavailable TTL instead of paying a rejected request per call.
      this.context.credits.markUnavailable(
        route.decision.gateway,
        "no-credits"
      );
      this.context.logger.warn("ai.router.daily_limit", {
        gateway: route.decision.gateway,
        requestedModel: route.decision.requestedModelId,
        organizationId: route.decision.organizationId,
        ...readGatewayLimitDetails(error),
      });
      return true;
    }
    if (reason === "auth-failure") {
      this.context.credits.markUnavailable(route.decision.gateway, reason);
      this.context.logger.error("ai.router.auth_rejected", {
        gateway: route.decision.gateway,
        requestedModel: route.decision.requestedModelId,
        organizationId: route.decision.organizationId,
        message: readMessage(error),
      });
      return true;
    }
    if (reason === "non-compliant") {
      this.context.credits.markUnavailable(
        route.decision.gateway,
        reason,
        route.decision.requestedModelId
      );
      this.context.logger.error("ai.router.zdr_rejected", {
        gateway: route.decision.gateway,
        requestedModel: route.decision.requestedModelId,
        organizationId: route.decision.organizationId,
        zdr: route.decision.zdr,
        message: readMessage(error),
      });
      return true;
    }
    return false;
  }

  private async tryFallbackRoute(
    route: ResolvedRoute,
    error: unknown,
    attempted: Set<GatewayId>,
    toolIds: readonly string[]
  ): Promise<ResolvedRoute | undefined> {
    const reason = classifyUpstreamFailure(error);
    if (!reason) {
      return undefined;
    }
    const marked = this.recordUpstreamFailure(route, reason, error);

    const crossGateway = this.crossGatewayRoute(
      route,
      reason,
      error,
      attempted,
      toolIds
    );
    if (crossGateway) {
      return crossGateway;
    }
    if (
      reason === "non-compliant" &&
      this.canRelaxZdr(route) &&
      !NO_TRAINING_PROVIDER_ERROR_PATTERN.test(readMessage(error))
    ) {
      return this.relaxZdr(route, error, toolIds);
    }
    if (marked) {
      this.routePromise = undefined;
    }
    if (reason === "auth-failure") {
      throw new GatewayUnavailableError(
        route.decision.gateway,
        "authentication failed"
      );
    }
    return undefined;
  }

  private crossGatewayRoute(
    route: ResolvedRoute,
    reason: FallbackReason,
    error: unknown,
    attempted: Set<GatewayId>,
    toolIds: readonly string[]
  ): ResolvedRoute | undefined {
    if (
      !this.context.policy.crossGatewayFallback ||
      this.context.request.gateway
    ) {
      return undefined;
    }
    const status = readStatusCode(error);
    const errorName = error instanceof Error ? error.name : typeof error;

    for (const target of fallbackGateways(route.decision.gateway)) {
      if (attempted.has(target)) {
        continue;
      }
      const candidate = getUsableAdapter(
        this.context,
        target,
        {
          modelId: route.decision.requestedModelId,
          organizationId: route.decision.organizationId,
          toolIds,
        },
        route.decision.zdr
      );
      if ("unavailable" in candidate) {
        const fields = {
          from: route.decision.gateway,
          to: target,
          fallbackReason: reason,
          targetReason: candidate.unavailable,
          errorName,
          status,
        };
        if (candidate.unavailable === "non-compliant") {
          this.context.logger.error("ai.router.no_compliant_route", fields);
        } else {
          this.context.logger.warn("ai.router.fallback_unavailable", fields);
        }
        continue;
      }

      const decision: RouteDecision = {
        ...route.decision,
        gateway: target,
        modelId: candidate.adapter.mapModelId(route.decision.requestedModelId),
        reason: "fallback",
        fallbackFrom: route.decision.gateway,
        fallbackReason: reason,
        zdrEnforced: candidate.zdrEnforced && !this.zdrRelaxed,
        zdrRelaxed: this.zdrRelaxed || candidate.zdrRelaxed === true,
      };
      this.context.logger.warn("ai.router.fallback", {
        ...decisionLogFields(decision),
        errorName,
        status,
      });
      const fallbackRoute = this.materialize(decision);
      if (toolIds.join() === this.routeToolIds.join()) {
        this.routePromise = Promise.resolve(fallbackRoute);
      }
      return fallbackRoute;
    }
    return undefined;
  }
}
