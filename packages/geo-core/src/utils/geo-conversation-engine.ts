import { GEO_OLOSTEP_ENGINES } from "../constants/geo-olostep";
import type { GeoConversationEngine } from "../types/geo-conversations";
import { isGeoContextEngine } from "./geo-context";
import { resolveGroundedEngineByKey } from "./geo-grounded-engines";
import { isGeoOlostepEngine } from "./geo-olostep";

/** Both hosted capture backends share scan-based sequence/persona scheduling. */
export function isGeoConsumerConversationEngine(engine: string): boolean {
  return (
    engine === "google/gemini" ||
    GEO_OLOSTEP_ENGINES[engine]?.conversational === true
  );
}

/**
 * Planned sequences/personas use Context, stored Olostep results, or a
 * search-grounded model route.
 */
export function resolveGeoConversationEngine(planned: {
  engine: string;
  groundedKey: string | null;
  olostepRetrieveIds?: (string | null)[];
}): GeoConversationEngine | null {
  if (isGeoContextEngine(planned.engine)) {
    return { key: planned.engine, context: true };
  }
  if (isGeoOlostepEngine(planned.engine)) {
    return {
      key: planned.engine,
      retrieveIds: planned.olostepRetrieveIds ?? [],
    };
  }
  return planned.groundedKey
    ? resolveGroundedEngineByKey(planned.groundedKey)
    : null;
}
