import type { LanguageModelUsage } from "ai";

export type GeoBoxHarness = "claude-code" | "codex" | "opencode" | "fx";

export interface GeoBoxRunTarget {
  harness: GeoBoxHarness;
  model: string;
}

export interface GeoOpenCodeBoxRetryOptions {
  attempts?: number;
  retryNotFound?: boolean;
  retryDelayMs?: number;
  signal?: AbortSignal;
}

export interface GeoOpenCodeStaleBoxCandidate {
  created_at: number;
  name?: string;
}

export interface GeoBoxTokenUsage extends LanguageModelUsage {
  modelId: string;
  totalUsd?: number;
  computeMs: number;
}

export interface GeoBoxAnswer {
  text: string;
  sources: { url: string; title: null }[];
  groundingSources: { url: string; title: null }[];
  toolCalls: unknown[];
  usage: GeoBoxTokenUsage;
}
