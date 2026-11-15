import type { ModelRoute, NeonEndpoint } from "@notra/ai/types/router";

/**
 * Per-gateway facts for each neutral model id, the single place to touch when
 * a model is added. Vercel serves every id as-is unless `vercel: false`;
 * OpenRouter uses the neutral id unless `openrouter` overrides it; only ids
 * with a `neon` entry route to Neon. Pricing stays in `MODEL_PRICING`.
 */
export const MODEL_ROUTES: Readonly<Record<string, ModelRoute>> = {
  "anthropic/claude-sonnet-5": {
    neon: "claude-sonnet-5",
    vercelServed: ["claude-sonnet-5"],
  },
  "anthropic/claude-sonnet-5.5": { neon: "claude-sonnet-5-5" },
  "anthropic/claude-opus-5.5": {
    neon: "claude-opus-5-5",
    vercelServed: ["claude-opus-5-5", "claude-opus-5.5"],
  },
  "anthropic/claude-sonnet-4.6": {
    neon: "claude-sonnet-4-6",
    vercelServed: ["claude-sonnet-4-6"],
  },
  "anthropic/claude-opus-4.6": {
    neon: "claude-opus-4-6",
    vercelServed: ["claude-opus-4-6"],
  },
  "anthropic/claude-haiku-4.5": {
    neon: "claude-haiku-4-5",
    vercelServed: ["claude-haiku-4-5"],
  },
  "anthropic/claude-haiku-5.5": { neon: "claude-haiku-5-5" },
  "anthropic/claude-opus-5": { neon: "claude-opus-5" },
  "anthropic/claude-fable-5": { neon: "claude-fable-5" },
  "anthropic/claude-fable-5.1": { neon: "claude-fable-5-1" },
  "openai/gpt-6-luna": { neon: "gpt-6-luna", vercelServed: ["gpt-6-luna"] },
  "openai/gpt-6-sol": { neon: "gpt-6-sol" },
  "openai/gpt-6.1-sol": { neon: "gpt-6-1-sol" },
  "openai/gpt-6-astra": { neon: "gpt-6-astra" },
  "openai/gpt-5.6-luna": { neon: "gpt-5-6-luna" },
  "openai/gpt-5.6-sol": { neon: "gpt-5-6-sol", vercelServed: ["gpt-5.6-sol"] },
  "openai/gpt-5.6-terra": { neon: "gpt-5-6-terra" },
  "openai/gpt-5.5": { neon: "gpt-5-5" },
  "openai/gpt-5.4": { neon: "gpt-5-4", vercelServed: ["gpt-5.4"] },
  "openai/gpt-5.4-mini": {
    neon: "gpt-5-4-mini",
    vercelServed: ["gpt-5.4-mini"],
  },
  "openai/gpt-5.4-nano": {
    neon: "gpt-5-4-nano",
    vercelServed: ["gpt-5.4-nano"],
  },
  "openai/gpt-5-mini": { neon: "gpt-5-mini" },
  // gpt-oss is only served on Neon's chat-completions endpoint.
  "openai/gpt-oss-120b": { neon: { id: "gpt-oss-120b", endpoint: "chat" } },
  "openai/gpt-oss-20b": { neon: { id: "gpt-oss-20b", endpoint: "chat" } },
  "google/gemini-3-flash": {
    neon: "gemini-3-flash",
    openrouter: "google/gemini-3-flash-preview",
  },
  "google/gemini-3.5-flash": { neon: "gemini-3-5-flash" },
  "google/gemini-3.8-flash": { neon: "gemini-3-8-flash" },
  "google/gemini-3.1-pro-preview": { neon: "gemini-3-1-pro" },
  "spacexai/grok-4.7": { neon: "grok-4-7", openrouter: "x-ai/grok-4.7" },
  "spacexai/grok-4.6": { openrouter: "x-ai/grok-4.6" },
  "spacexai/grok-4.5": { openrouter: "x-ai/grok-4.5" },
  "spacexai/grok-build-0.1": { openrouter: "x-ai/grok-build-0.1" },
  "spacexai/grok-4.3": { openrouter: "x-ai/grok-4.3" },
  "spacexai/grok-4.20-multi-agent": {
    openrouter: "x-ai/grok-4.20-multi-agent",
  },
  "spacexai/grok-4.20-non-reasoning": { openrouter: false },
  "spacexai/grok-4.20-reasoning": { openrouter: false },
  "spacexai/grok-4.1-fast-non-reasoning": { openrouter: false },
  "spacexai/grok-4.1-fast-reasoning": { openrouter: false },
  "moonshotai/kimi-k3": { neon: "kimi-k3" },
  "moonshotai/kimi-k2.7-code-highspeed": { openrouter: false },
  "zai/glm-5.3": { neon: "glm-5-3", openrouter: "z-ai/glm-5.3" },
  "zai/glm-5.3-flash": { openrouter: "z-ai/glm-5.3-flash" },
  "zai/glm-5.3-promo-50": { openrouter: false },
  "zai/glm-5.2": { openrouter: "z-ai/glm-5.2" },
  "zai/glm-5.1": { openrouter: "z-ai/glm-5.1" },
  "zai/glm-5v-turbo": { openrouter: "z-ai/glm-5v-turbo" },
  "zai/glm-5-turbo": { openrouter: "z-ai/glm-5-turbo" },
  "zai/glm-5": { openrouter: "z-ai/glm-5" },
  "zai/glm-4.7-flash": { openrouter: "z-ai/glm-4.7-flash" },
  "zai/glm-4.7-flashx": { openrouter: false },
  "meta/llama-4-maverick": {
    neon: "llama-4-maverick",
    openrouter: "meta-llama/llama-4-maverick",
  },
  "meta/llama-4-scout": { openrouter: "meta-llama/llama-4-scout" },
  "meta/llama-3.3-70b": { openrouter: "meta-llama/llama-3.3-70b-instruct" },
  "meta/llama-3.1-70b": { openrouter: "meta-llama/llama-3.1-70b-instruct" },
  "meta/llama-3.1-8b": { openrouter: "meta-llama/llama-3.1-8b-instruct" },
  "mistral/mistral-medium-3.5": { openrouter: "mistralai/mistral-medium-3-5" },
  "mistral/mistral-large-3": { openrouter: "mistralai/mistral-large-2512" },
  "mistral/mistral-medium": { openrouter: false },
  "mistral/mistral-small": { openrouter: false },
  "mistral/magistral-medium": { vercel: false, openrouter: false },
  "deepseek/deepseek-v3.2-thinking": { openrouter: false },
  "deepseek/deepseek-v3.1": { openrouter: false },
};

/** Neon's native endpoint per model family; everything else uses chat completions. */
export const NEON_FAMILY_ENDPOINTS: Readonly<Record<string, NeonEndpoint>> = {
  openai: "responses",
  anthropic: "messages",
  google: "gemini",
};

/**
 * Provider-defined tools each Neon endpoint serves. Claude and Grok web search
 * are rejected, so calls that use them route to a gateway that serves them.
 */
export const NEON_ENDPOINT_TOOLS: Readonly<
  Record<NeonEndpoint, ReadonlySet<string>>
> = {
  responses: new Set(["openai.web_search"]),
  gemini: new Set(["google.google_search"]),
  messages: new Set(),
  chat: new Set(),
};
