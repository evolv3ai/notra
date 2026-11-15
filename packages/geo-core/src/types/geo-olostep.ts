import type { output } from "zod";

import type { geoOlostepAnswerSchema } from "../schemas/geo-olostep";
import type { GeoScanProjectPlan } from "./geo";

export interface GeoOlostepEngine {
  parser: string;
  url: (query: string) => string;
  /**
   * Chat apps also run sequences and personas. A search page has no chat, so
   * a SERP engine only answers tracked prompts.
   */
  conversational: boolean;
  /**
   * The parser marks every source `cited: false` and returns no inline
   * references, so its sources panel is the only record of what the answer
   * used. Without this flag such an engine would store no sources at all.
   */
  panelSourcesCited?: boolean;
}

export type GeoOlostepAnswerPayload = output<typeof geoOlostepAnswerSchema>;

export type GeoOlostepSource = NonNullable<
  GeoOlostepAnswerPayload["sources"]
>[number];

/** One prompt to ask a consumer app; `text` is exactly what gets submitted. */
export interface GeoOlostepQuery {
  engine: string;
  language: string;
  text: string;
}

/** Queries of one engine and country, before splitting at the item cap. */
export interface GeoOlostepBatchGroup {
  engine: string;
  country: string;
  indexes: number[];
}

/** Request body of one Olostep batch plus the query indexes it covers. */
export interface GeoOlostepBatchRequest {
  queryIndexes: number[];
  body: {
    parser: { id: string };
    country: string;
    items: { custom_id: string; url: string }[];
  };
}

/** Query index → Olostep retrieve id for every item that finished. */
export type GeoOlostepResults = Record<string, string>;

/** An Olostep engine in place of a grounded one inside a conversation. */
export interface GeoOlostepConversationEngine {
  key: string;
  retrieveIds: readonly (string | null)[];
}

/** The parts of a scan plan that can hold Olostep engines. */
export type GeoOlostepPlanItems = Pick<
  GeoScanProjectPlan,
  "tasks" | "sequences" | "personas"
>;
