import type { JSONObject, SharedV4ProviderOptions } from "@ai-sdk/provider";
import {
  OPENROUTER_EFFORTS,
  OPENROUTER_OPTIONS_KEY,
  ROUTER_PROVIDER_OPTIONS_KEY,
  VERCEL_OPTIONS_KEY,
} from "@notra/ai/constants/router";
import { routerProviderOptionsSchema } from "@notra/ai/schemas/router";
import type {
  BuildProviderOptionsInput,
  GatewayId,
  RouterProviderOptions,
} from "@notra/ai/types/router";
import { isRecord } from "@notra/utils/unknown-record";

import { NoCompliantRouteError } from "./errors";
import { toOpenRouterModelId, toVercelModelId } from "./model-ids";

function asObject(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === "string")
  );
}

function resolveFallbackModels(
  router: RouterProviderOptions,
  existingModels: unknown,
  mapModel: (modelId: string) => string
): string[] | undefined {
  if (router.fallbackModels && router.fallbackModels.length > 0) {
    return router.fallbackModels.map(mapModel);
  }
  return isStringArray(existingModels) ? existingModels : undefined;
}

function resolveZdrFlag(
  relaxZdr: boolean,
  allowNonZdr: boolean,
  requested: unknown
): boolean {
  return requested === true || !(relaxZdr || allowNonZdr);
}

function explicitPrivacyRequirements(providerOptions: SharedV4ProviderOptions) {
  const gateway = asObject(providerOptions[VERCEL_OPTIONS_KEY]);
  const provider = asObject(
    asObject(providerOptions[OPENROUTER_OPTIONS_KEY]).provider
  );
  const zdr = gateway.zeroDataRetention === true || provider.zdr === true;
  return {
    zdr,
    noTraining:
      zdr ||
      gateway.disallowPromptTraining === true ||
      provider.data_collection === "deny",
  };
}

export function splitRouterOptions(providerOptions?: SharedV4ProviderOptions): {
  router: RouterProviderOptions;
  rest: SharedV4ProviderOptions;
} {
  if (!providerOptions) {
    return { router: {}, rest: {} };
  }

  const { [ROUTER_PROVIDER_OPTIONS_KEY]: rawRouter, ...rest } = providerOptions;
  const router = routerProviderOptionsSchema.parse(rawRouter);

  return { router, rest };
}

/**
 * Remove the other gateway's block so provider-specific options never leak
 * across gateways.
 */
export function stripForeignGatewayOptions(
  gateway: GatewayId,
  providerOptions: SharedV4ProviderOptions
): SharedV4ProviderOptions {
  return Object.fromEntries(
    Object.entries(providerOptions).filter(
      ([key]) =>
        (key !== VERCEL_OPTIONS_KEY || gateway === "vercel") &&
        (key !== OPENROUTER_OPTIONS_KEY || gateway === "openrouter") &&
        (key !== "neon" || gateway === "neon")
    )
  );
}

export function buildNeonProviderOptions(
  input: BuildProviderOptionsInput
): SharedV4ProviderOptions {
  const privacy = explicitPrivacyRequirements(input.providerOptions);
  if (privacy.zdr || privacy.noTraining) {
    throw new NoCompliantRouteError(
      "neon",
      "Neon cannot enforce explicit privacy restrictions"
    );
  }
  const options = stripForeignGatewayOptions("neon", input.providerOptions);
  const existing = asObject(options.neon);
  const openai = asObject(options.openai);
  const anthropic = asObject(options.anthropic);
  const effort =
    input.router.reasoning?.effort ??
    existing.reasoningEffort ??
    openai.reasoningEffort ??
    anthropic.effort;
  return {
    ...options,
    // Claude runs on Neon's native Messages endpoint; top-level cache_control
    // mirrors Vercel's `caching: "auto"` so agent loops read the prefix.
    anthropic: {
      cacheControl: { type: "ephemeral" },
      ...anthropic,
    } as JSONObject,
    // OpenAI runs on Neon's Responses endpoint, which stores generations by
    // default; nothing here chains on previous response ids.
    openai: { store: false, ...openai } as JSONObject,
    neon: {
      ...existing,
      ...(typeof effort === "string" ? { reasoningEffort: effort } : {}),
    } as JSONObject,
  };
}

export function buildVercelProviderOptions(
  input: BuildProviderOptionsInput
): SharedV4ProviderOptions {
  const { providerOptions, router, allowNonZdr, relaxZdr = false } = input;
  const existing = asObject(providerOptions[VERCEL_OPTIONS_KEY]);
  const privacy = explicitPrivacyRequirements(providerOptions);
  const fallbackModels = resolveFallbackModels(
    router,
    existing.models,
    toVercelModelId
  );

  const zeroDataRetention = resolveZdrFlag(relaxZdr, allowNonZdr, privacy.zdr);
  const disallowPromptTraining =
    privacy.noTraining ||
    !(allowNonZdr && existing.disallowPromptTraining === false);

  const { zeroDataRetention: _ignoredZdr, ...existingWithoutZdr } = existing;
  const gatewayOptions: Record<string, unknown> = {
    ...existingWithoutZdr,
    tags: existing.tags ?? ["other"],
    ...(existing.user === undefined && input.organizationId
      ? { user: input.organizationId }
      : {}),
    caching: router.caching ?? existing.caching ?? "auto",
    ...(fallbackModels ? { models: fallbackModels } : {}),
    ...(zeroDataRetention ? { zeroDataRetention: true } : {}),
    disallowPromptTraining,
  };

  return {
    ...stripForeignGatewayOptions("vercel", providerOptions),
    [VERCEL_OPTIONS_KEY]: gatewayOptions as JSONObject,
  };
}

function deriveOpenRouterReasoning(
  router: RouterProviderOptions,
  providerOptions: SharedV4ProviderOptions
): Record<string, unknown> | undefined {
  if (router.reasoning?.budgetTokens) {
    return { max_tokens: router.reasoning.budgetTokens };
  }
  if (router.reasoning?.effort) {
    return { effort: router.reasoning.effort };
  }

  const anthropic = asObject(providerOptions.anthropic);
  const thinking = asObject(anthropic.thinking);
  if (
    thinking.type === "enabled" &&
    typeof thinking.budgetTokens === "number"
  ) {
    return { max_tokens: thinking.budgetTokens };
  }
  if (thinking.type === "adaptive") {
    const effort = anthropic.effort;
    if (typeof effort === "string" && OPENROUTER_EFFORTS.has(effort)) {
      return { effort };
    }
    return { enabled: true, effort: "medium" };
  }

  const openai = asObject(providerOptions.openai);
  const reasoningEffort = openai.reasoningEffort;
  if (
    typeof reasoningEffort === "string" &&
    OPENROUTER_EFFORTS.has(reasoningEffort)
  ) {
    return { effort: reasoningEffort };
  }

  return undefined;
}

export function buildOpenRouterProviderOptions(
  input: BuildProviderOptionsInput
): SharedV4ProviderOptions {
  const { providerOptions, router, allowNonZdr, relaxZdr = false } = input;
  const existing = asObject(providerOptions[OPENROUTER_OPTIONS_KEY]);
  const existingProvider = asObject(existing.provider);
  const privacy = explicitPrivacyRequirements(providerOptions);

  const zdr = resolveZdrFlag(relaxZdr, allowNonZdr, privacy.zdr);
  const dataCollection =
    !privacy.noTraining &&
    allowNonZdr &&
    existingProvider.data_collection === "allow"
      ? "allow"
      : "deny";

  const { zdr: _ignoredZdr, ...existingProviderWithoutZdr } = existingProvider;
  const provider: Record<string, unknown> = {
    ...existingProviderWithoutZdr,
    ...(relaxZdr || zdr ? { zdr } : {}),
    data_collection: dataCollection,
  };

  const fallbackModels = resolveFallbackModels(
    router,
    existing.models,
    toOpenRouterModelId
  );

  const reasoning = isRecord(existing.reasoning)
    ? existing.reasoning
    : deriveOpenRouterReasoning(router, providerOptions);

  const openrouterOptions: Record<string, unknown> = {
    ...existing,
    ...(existing.user === undefined && input.organizationId
      ? { user: input.organizationId }
      : {}),
    provider,
    ...(fallbackModels ? { models: fallbackModels } : {}),
    ...(reasoning ? { reasoning } : {}),
  };

  return {
    ...stripForeignGatewayOptions("openrouter", providerOptions),
    [OPENROUTER_OPTIONS_KEY]: openrouterOptions as JSONObject,
  };
}

export function withRouterProviderOptions(
  providerOptions: SharedV4ProviderOptions | undefined,
  router: RouterProviderOptions
): SharedV4ProviderOptions {
  const existing = asObject(providerOptions?.[ROUTER_PROVIDER_OPTIONS_KEY]);
  return {
    ...providerOptions,
    [ROUTER_PROVIDER_OPTIONS_KEY]: { ...existing, ...router } as JSONObject,
  };
}
