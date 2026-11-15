import type { GeoPersonaSnapshot } from "@notra/db/types/geo-personas";

import type {
  GeoCheckContext,
  GeoGroundedEngine,
  GeoSequenceCheckOutcome,
} from "./geo";
import type { GeoContextConversationEngine } from "./geo-context";
import type { GeoOlostepConversationEngine } from "./geo-olostep";

export interface GeoConversationReplayInput {
  context: Omit<GeoCheckContext, "scanId" | "capturedAt">;
  fallbackModelId: string;
  properties: Record<string, string>;
  logPrefix: string;
  emptyMessage: string;
  /** Charges this multiple of the run's answers and usage; defaults to 1. */
  billingMultiplier?: number;
}

export type GeoConversationResult = Pick<
  GeoConversationOutcome,
  "rows" | "usage"
>;

export interface GeoConversationSource {
  promptId: string;
  sequenceId?: string;
  personaId?: string;
  prompts: readonly string[];
  /** Defaults to English. */
  language?: string;
  snapshot?: GeoPersonaSnapshot;
  timeoutMs: number;
}

export type GeoConversationOutcome = GeoSequenceCheckOutcome;

/** A planned persona's run; `omitted` marks one paused or archived mid-scan. */
export interface GeoPlannedPersonaOutcome extends GeoConversationOutcome {
  omitted?: boolean;
}

/** What a conversation talks to: a grounded route or a consumer-app capture. */
export type GeoConversationEngine =
  | GeoGroundedEngine
  | GeoContextConversationEngine
  | GeoOlostepConversationEngine;
