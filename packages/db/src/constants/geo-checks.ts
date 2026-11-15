import type { GeoCheckGrounding } from "../types/geo-checks";

export const EMPTY_GEO_CHECK_GROUNDING: GeoCheckGrounding = {
  queries: [],
  sources: [],
};

export const GEO_CHECK_ENGLISH_LANGUAGES = ["", "English"] as const;
export const GEO_CHECK_GROUNDING_MAX_QUERIES = 8;
export const GEO_CHECK_GROUNDING_MAX_SOURCES = 20;
export const GEO_PERSONA_SCAN_HISTORY_LIMIT = 50;
export const GEO_CHECK_SURFACE_MAX_ADS = 10;
export const GEO_CHECK_SURFACE_MAX_PRODUCTS = 20;
export const GEO_CHECK_SURFACE_MAX_VENDORS = 5;
export const GEO_CHECK_SURFACE_MAX_RELATED_QUERIES = 10;
