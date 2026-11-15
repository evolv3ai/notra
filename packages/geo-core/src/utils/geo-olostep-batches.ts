import { geoAiOverviewLocale } from "../constants/geo-ai-overview";
import {
  GEO_OLOSTEP_ENGINES,
  GEO_OLOSTEP_MAX_BATCH_ITEMS,
} from "../constants/geo-olostep";
import type {
  GeoOlostepBatchGroup,
  GeoOlostepBatchRequest,
  GeoOlostepQuery,
} from "../types/geo-olostep";

/**
 * Groups the given queries into one batch per engine and country, split at
 * Olostep's item cap. Item ids are the query indexes so results map straight
 * back onto the plan. Google country codes double as Olostep's ISO country.
 */
export function buildGeoOlostepBatchRequests(
  queries: readonly GeoOlostepQuery[],
  indexes: readonly number[]
): GeoOlostepBatchRequest[] {
  const groups = new Map<string, GeoOlostepBatchGroup>();
  for (const index of indexes) {
    const query = queries[index];
    if (!query || !GEO_OLOSTEP_ENGINES[query.engine]) {
      continue;
    }
    const country = geoAiOverviewLocale(query.language).gl.toUpperCase();
    const key = `${query.engine}:${country}`;
    const group = groups.get(key) ?? {
      engine: query.engine,
      country,
      indexes: [],
    };
    group.indexes.push(index);
    groups.set(key, group);
  }
  const requests: GeoOlostepBatchRequest[] = [];
  for (const { engine, country, indexes: groupIndexes } of groups.values()) {
    const config = GEO_OLOSTEP_ENGINES[engine];
    if (!config) {
      continue;
    }
    for (
      let start = 0;
      start < groupIndexes.length;
      start += GEO_OLOSTEP_MAX_BATCH_ITEMS
    ) {
      const queryIndexes = groupIndexes.slice(
        start,
        start + GEO_OLOSTEP_MAX_BATCH_ITEMS
      );
      requests.push({
        queryIndexes,
        body: {
          parser: { id: config.parser },
          country,
          items: queryIndexes.map((index) => ({
            custom_id: String(index),
            url: config.url(queries[index]?.text ?? ""),
          })),
        },
      });
    }
  }
  return requests;
}

/** Query indexes still without a result, for the single retry round. */
export function missingGeoOlostepQueryIndexes(
  queries: readonly GeoOlostepQuery[],
  results: Readonly<Record<string, string>>
): number[] {
  return queries.flatMap((_, index) => (results[String(index)] ? [] : [index]));
}
