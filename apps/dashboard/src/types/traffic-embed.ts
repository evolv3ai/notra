import type { AiTrafficResponse } from "@notra/geo-core/types/geo";

export type TrafficEmbedRange = "7d" | "14d" | "30d" | "90d";

export type TrafficEmbedTheme = "light" | "dark" | "auto";

export type TrafficEmbedPart = "metrics" | "chart";

export interface TrafficEmbedSummary {
  id: string;
  name: string;
  projectId: string | null;
  host: string | null;
  allowedOrigins: string[];
  createdAt: string;
}

/** What the public page needs to decide who may frame it and what to load. */
export interface TrafficEmbedConfig {
  id: string;
  organizationId: string;
  projectId: string | null;
  host: string | null;
  allowedOrigins: string[];
}

export interface PublicTrafficEmbed {
  range: TrafficEmbedRange;
  from: string;
  to: string;
  traffic: AiTrafficResponse;
}

export type TrafficEmbedOriginResult =
  | { ok: true; origin: string }
  | { ok: false; value: string };
