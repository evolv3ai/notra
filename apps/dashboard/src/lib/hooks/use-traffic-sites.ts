"use client";

import {
  GEO_TRAFFIC_SITES_MODES,
  GEO_TRAFFIC_SITES_PARAM,
} from "@notra/geo-core/constants/geo";
import type { GeoTrafficSitesMode } from "@notra/geo-core/types/geo";
import { parseAsStringLiteral, useQueryState } from "nuqs";

/** The Notra Sites filter from the URL; null keeps sites and SDK hosts together. */
export function useTrafficSitesQuery() {
  return useQueryState(
    GEO_TRAFFIC_SITES_PARAM,
    parseAsStringLiteral(GEO_TRAFFIC_SITES_MODES)
  );
}

/** Sites mode sent to the API. */
export function useTrafficSitesMode(): GeoTrafficSitesMode | undefined {
  const [query] = useTrafficSitesQuery();
  return query ?? undefined;
}
