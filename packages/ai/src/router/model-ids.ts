import { MODEL_PRICING } from "@notra/ai/billing/token-pricing";
import {
  MODEL_ROUTES,
  NEON_ENDPOINT_TOOLS,
  NEON_FAMILY_ENDPOINTS,
} from "@notra/ai/constants/model-routes";
import {
  NEON_SERVED_MODEL_PREFIX_PATTERN,
  NEON_SERVED_MODEL_SUFFIX_PATTERN,
  VERCEL_NAMESPACE_PREFIX,
} from "@notra/ai/constants/router";
import type { GatewayId, NeonEndpoint } from "@notra/ai/types/router";

const routes = Object.entries(MODEL_ROUTES);

const neonRoutes = new Map(
  routes.flatMap(([neutral, { neon }]) => {
    if (!neon) {
      return [];
    }
    const id = typeof neon === "string" ? neon : neon.id;
    const family = neutral.split("/")[0] ?? "";
    const endpoint =
      typeof neon === "string"
        ? (NEON_FAMILY_ENDPOINTS[family] ?? "chat")
        : neon.endpoint;
    return [[neutral, { id, endpoint }] as const];
  })
);

const openRouterIds = new Map(
  routes.flatMap(([neutral, { openrouter }]) =>
    typeof openrouter === "string" ? [[neutral, openrouter] as const] : []
  )
);
const neutralByOpenRouterId = new Map(
  [...openRouterIds].map(([neutral, id]) => [id, neutral])
);

/** Short ids Vercel reports as the served model → neutral id. */
export const VERCEL_SERVED_MODEL_ALIASES: ReadonlyMap<string, string> = new Map(
  routes.flatMap(([neutral, { vercelServed = [] }]) =>
    vercelServed.map((served) => [served, neutral] as const)
  )
);

function stripVercelNamespace(modelId: string): string {
  return modelId.startsWith(VERCEL_NAMESPACE_PREFIX)
    ? modelId.slice(VERCEL_NAMESPACE_PREFIX.length)
    : modelId;
}

export function toOpenRouterModelId(modelId: string): string {
  const neutral = stripVercelNamespace(modelId);
  return openRouterIds.get(neutral) ?? neutral;
}

const SNAPSHOT_SUFFIX_REGEX = /-\d{4}-?\d{2}-?\d{2}$/;

/**
 * Inverse of {@link toOpenRouterModelId}, for model ids OpenRouter reports
 * back. Drops a dated snapshot suffix so the id matches our pricing table.
 */
export function fromOpenRouterModelId(modelId: string): string {
  const base = modelId.replace(SNAPSHOT_SUFFIX_REGEX, "");
  return neutralByOpenRouterId.get(base) ?? base;
}

export function toVercelModelId(modelId: string): string {
  return modelId;
}

export function fromVercelServedModelId(modelId: string): string {
  const neutral = stripVercelNamespace(modelId);
  const model = fromOpenRouterModelId(neutral);
  const served = VERCEL_SERVED_MODEL_ALIASES.get(model);
  if (served) {
    return served;
  }
  return openRouterIds.has(model) ||
    Object.hasOwn(MODEL_PRICING, model) ||
    Object.hasOwn(MODEL_PRICING, `vercel/${model}`)
    ? model
    : neutral;
}

export function isModelSupported(gateway: GatewayId, modelId: string): boolean {
  const neutral = stripVercelNamespace(modelId);
  if (gateway === "neon") {
    return neonRoutes.has(neutral);
  }
  const route = Object.hasOwn(MODEL_ROUTES, neutral)
    ? MODEL_ROUTES[neutral]
    : undefined;
  return route?.[gateway] !== false;
}

export function toNeonModelId(modelId: string): string {
  const neutral = stripVercelNamespace(modelId);
  return neonRoutes.get(neutral)?.id ?? neutral;
}

/** Neon endpoint serving the model; chat completions when unlisted. */
export function neonEndpointOf(modelId: string): NeonEndpoint {
  return neonRoutes.get(stripVercelNamespace(modelId))?.endpoint ?? "chat";
}

export function neonSupportsTools(
  modelId: string,
  toolIds: readonly string[]
): boolean {
  const tools = NEON_ENDPOINT_TOOLS[neonEndpointOf(modelId)];
  return toolIds.every((id) => tools.has(id));
}

export function fromNeonModelId(modelId: string): string {
  if (neonRoutes.has(modelId)) {
    return modelId;
  }
  const short = modelId
    .replace(NEON_SERVED_MODEL_PREFIX_PATTERN, "")
    .replace(NEON_SERVED_MODEL_SUFFIX_PATTERN, "")
    .replaceAll(".", "-");
  for (const [neutral, { id }] of neonRoutes) {
    if (id === short || `${id}-preview` === short) {
      return neutral;
    }
  }
  return modelId;
}
