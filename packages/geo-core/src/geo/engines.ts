import { createAnthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { createOpenAI, openai } from "@ai-sdk/openai";
import { createPerplexity } from "@ai-sdk/perplexity";
import { xai } from "@ai-sdk/xai";
import { gateway } from "@notra/ai/gateway";
import { requireApiKey } from "@notra/utils/require-api-key";

import {
  GEO_ANTHROPIC_API_KEY_ENV,
  GEO_OPENAI_API_KEY_ENV,
  GEO_PERPLEXITY_API_KEY_ENV,
} from "../constants/geo";
import type {
  GeoGroundedEngine,
  GeoGroundedInvocation,
  GeoGroundedInvocationOptions,
} from "../types/geo";
import { geoAnthropicWebSearch } from "../utils/geo-anthropic-web-search";

export function buildGroundedInvocation(
  engine: GeoGroundedEngine,
  options: GeoGroundedInvocationOptions = {}
): GeoGroundedInvocation {
  // The router sends provider-defined search tools only to a gateway that
  // serves them for the model (Neon: OpenAI and Gemini search, else Vercel).
  const routed = {
    organizationId: options.organizationId,
    zdr: options.zdr,
    logContext: options.logContext,
  } as const;
  switch (engine.provider) {
    case "gateway-openai":
      return {
        model: gateway(engine.model, routed),
        tools: { web_search: openai.tools.webSearch({}) },
      };
    case "gateway-anthropic":
      return {
        model: gateway(engine.model, routed),
        tools: {
          web_search: geoAnthropicWebSearch(
            engine.model,
            options.zdr === "none"
          ),
        },
      };
    case "gateway-google":
      return {
        model: gateway(engine.model, routed),
        tools: { google_search: google.tools.googleSearch({}) },
      };
    case "gateway-perplexity":
      // Sonar searches on its own and has no tool to route by.
      return {
        model: gateway(engine.model, { ...routed, gateway: "vercel" }),
        tools: {},
      };
    case "gateway-meta":
      // Meta accepts the OpenAI-compatible search tool, but rejects it under ZDR.
      if (options.zdr === "required") {
        throw new Error("Meta web search does not support zero data retention");
      }
      return {
        model: gateway(engine.model, { ...routed, zdr: "none" }),
        tools: { web_search: openai.tools.webSearch({}) },
      };
    case "gateway-spacexai":
      return {
        model: gateway(engine.model, routed),
        tools: { web_search: xai.tools.webSearch({}) },
      };
    case "direct-openai": {
      const provider = createOpenAI({
        apiKey: requireApiKey(GEO_OPENAI_API_KEY_ENV),
      });
      return {
        model: provider.responses(engine.model),
        tools: { web_search: provider.tools.webSearch({}) },
      };
    }
    case "direct-anthropic": {
      const provider = createAnthropic({
        apiKey: requireApiKey(GEO_ANTHROPIC_API_KEY_ENV),
      });
      return {
        model: provider(engine.model),
        tools: {
          web_search: geoAnthropicWebSearch(
            engine.model,
            options.zdr === "none"
          ),
        },
      };
    }
    default: {
      const provider = createPerplexity({
        apiKey: requireApiKey(GEO_PERPLEXITY_API_KEY_ENV),
      });
      return { model: provider(engine.model), tools: {} };
    }
  }
}
