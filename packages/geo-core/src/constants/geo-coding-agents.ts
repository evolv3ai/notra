import type { GeoBoxRunTarget } from "@notra/ai/types/geo-opencode";
import { Duration } from "effect";

export const GEO_CODING_AGENT_ACCESS_CACHE_TTL = Duration.seconds(30);
export const GEO_CODING_AGENT_ACCESS_CACHE_CAPACITY = 500;

export const GEO_BOX_CODING_AGENT_TARGETS: Readonly<
  Record<string, GeoBoxRunTarget>
> = {
  "opencode/gpt-6-astra": {
    harness: "opencode",
    model: "openai/gpt-6-astra",
  },
  "opencode/gpt-6-luna": {
    harness: "opencode",
    model: "openai/gpt-6-luna",
  },
  "opencode/gpt-6.1-sol-medium": {
    harness: "opencode",
    model: "openai/gpt-6.1-sol",
  },
  "opencode/claude-sonnet-5.5": {
    harness: "opencode",
    model: "anthropic/claude-sonnet-5.5",
  },
  "opencode/claude-opus-5.5": {
    harness: "opencode",
    model: "anthropic/claude-opus-5.5",
  },
  "claude-code/claude-sonnet-5.5": {
    harness: "claude-code",
    model: "anthropic/claude-sonnet-5.5",
  },
  "claude-code/claude-opus-5.5": {
    harness: "claude-code",
    model: "anthropic/claude-opus-5.5",
  },
  "claude-code/claude-fable-5.1": {
    harness: "claude-code",
    model: "anthropic/claude-fable-5.1",
  },
  "codex/gpt-6.1-sol": {
    harness: "codex",
    model: "openai/gpt-6.1-sol",
  },
  "codex/gpt-6-luna": {
    harness: "codex",
    model: "openai/gpt-6-luna",
  },
  "codex/gpt-6-astra": {
    harness: "codex",
    model: "openai/gpt-6-astra",
  },
  "fx/gpt-6.1-sol": {
    harness: "fx",
    model: "openai/gpt-6.1-sol",
  },
  "fx/gpt-5.4-mini": {
    harness: "fx",
    model: "openai/gpt-5.4-mini",
  },
  "fx/claude-opus-5.5": {
    harness: "fx",
    model: "anthropic/claude-opus-5.5",
  },
  "fx/claude-sonnet-5.5": {
    harness: "fx",
    model: "anthropic/claude-sonnet-5.5",
  },
  "fx/kimi-k3": {
    harness: "fx",
    model: "moonshotai/kimi-k3",
  },
  "fx/grok-4.7": {
    harness: "fx",
    model: "spacexai/grok-4.7",
  },
};
