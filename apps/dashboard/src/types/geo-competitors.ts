import type {
  GeoCompetitor,
  GeoCompetitorKind,
  GeoCompetitorSharePoint,
  GeoCompetitorShareTimeseriesPoint,
} from "@notra/geo-core/types/geo";

import type { ChartColorPair } from "./charts";

export interface GeoCompetitorRowEntry {
  id: string;
  name: string;
  domain: string | null;
  synonyms: string[];
  kind: GeoCompetitorKind;
  isOwnBrand: boolean;
  color: ChartColorPair;
}

export interface GeoCompetitorSuggestion {
  brand: string;
  mentions: number;
}

export interface GeoCompetitorShareScopeInput {
  points: readonly GeoCompetitorSharePoint[];
  timeseries: readonly GeoCompetitorShareTimeseriesPoint[];
  competitors: readonly GeoCompetitor[];
  companyName?: string | null;
  aliases?: readonly string[];
  /** Tracked engines; the assistants being asked never count as rivals. */
  engines?: readonly string[];
  /** Brand keys dismissed from the suggestions. */
  ignoredCompetitors?: readonly string[];
}

export interface GeoCompetitorShareScope {
  points: GeoCompetitorSharePoint[];
  timeseries: GeoCompetitorShareTimeseriesPoint[];
  suggestions: GeoCompetitorSuggestion[];
  /** True when the ranking is limited to your tracked competitors. */
  trackedOnly: boolean;
}
