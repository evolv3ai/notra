import { setTimeout as delay } from "node:timers/promises";

import { createGateway } from "@ai-sdk/gateway";
import type { SharedV4ProviderMetadata } from "@ai-sdk/provider";
import type {
  GatewayAdapter,
  GatewayBalance,
  GatewayHealth,
  VercelAdapterConfig,
} from "@notra/ai/types/router";

import {
  isModelSupported,
  fromVercelServedModelId,
  toVercelModelId,
} from "../model-ids";
import { buildVercelProviderOptions } from "../provider-options";

function parseBalance(value: unknown): number | null {
  const balance = typeof value === "number" ? value : Number(value);
  return Number.isFinite(balance) ? balance : null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function createVercelAdapter(
  config: VercelAdapterConfig
): GatewayAdapter {
  let client: ReturnType<typeof createGateway> | undefined;

  const getClient = (): ReturnType<typeof createGateway> => {
    client ??= createGateway({
      apiKey: config.apiKey,
      headers: config.headers,
      baseURL: config.baseURL,
      fetch: config.fetch,
    });
    return client;
  };

  const getBalance = async (): Promise<GatewayBalance> => {
    const credits = await getClient().getCredits();
    return { balance: parseBalance(credits.balance) };
  };

  return {
    id: "vercel",
    enforcesZdr: true,
    supportsModel: (modelId) => isModelSupported("vercel", modelId),
    // Vercel forwards provider-defined tools to the model's own provider.
    supportsTools: () => true,
    mapModelId: toVercelModelId,
    createModel: (modelId) => getClient()(toVercelModelId(modelId)),
    buildProviderOptions: buildVercelProviderOptions,
    async checkHealth(): Promise<GatewayHealth> {
      try {
        await getBalance();
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          reason: error instanceof Error ? error.message : "unknown error",
        };
      }
    },
    getBalance,
    extractRouteMetadata(
      providerMetadata: SharedV4ProviderMetadata | undefined,
      servedModelId?: string
    ) {
      const gateway = providerMetadata?.gateway;
      const generationId =
        gateway && typeof gateway === "object"
          ? readString(gateway.generationId)
          : undefined;
      const model = readString(servedModelId?.trim());
      return {
        ...(generationId ? { generationId } : {}),
        ...(model ? { model: fromVercelServedModelId(model) } : {}),
      };
    },
    async lookupRouteMetadata(generationId, signal) {
      const generation = await createGateway({
        apiKey: config.apiKey,
        headers: config.headers,
        baseURL: config.baseURL,
        async fetch(input, init) {
          // Generation records are ingested asynchronously after completion.
          // Retry only a not-yet-visible record, never auth or schema errors.
          for (let attempt = 0; ; attempt += 1) {
            const response = await (config.fetch ?? fetch)(input, {
              ...init,
              signal: AbortSignal.any([
                AbortSignal.timeout(3000),
                ...(init?.signal ? [init.signal] : []),
                ...(signal ? [signal] : []),
              ]),
            });
            if (response.status !== 404 || attempt === 9) {
              return response;
            }
            await response.body?.cancel();
            await delay(2000, undefined, {
              signal: signal ?? init?.signal ?? undefined,
            });
          }
        },
      }).getGenerationInfo({ id: generationId });
      const upstreamCost = generation.isByok
        ? generation.upstreamInferenceCost
        : 0;
      const costUsd = generation.totalCost + upstreamCost;
      const gatewayCostUsd =
        Number.isFinite(generation.totalCost) && generation.totalCost >= 0
          ? generation.totalCost
          : undefined;
      const upstreamInferenceCostUsd =
        Number.isFinite(upstreamCost) && upstreamCost >= 0
          ? upstreamCost
          : undefined;
      return {
        model: fromVercelServedModelId(generation.model),
        upstreamProvider: generation.providerName,
        isByok: generation.isByok,
        ...(gatewayCostUsd === undefined ? {} : { gatewayCostUsd }),
        ...(upstreamInferenceCostUsd === undefined
          ? {}
          : {
              upstreamInferenceCostUsd,
              byokInferenceCostUsd: upstreamInferenceCostUsd,
            }),
        ...(gatewayCostUsd !== undefined &&
        upstreamInferenceCostUsd !== undefined &&
        Number.isFinite(costUsd)
          ? { costUsd, costSource: "reported" as const }
          : {}),
      };
    },
  };
}
