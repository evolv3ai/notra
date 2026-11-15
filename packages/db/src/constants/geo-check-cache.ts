const GEO_CHECK_AGGREGATE_TTL_SECONDS = 300;

export const GEO_CHECK_AGGREGATE_CACHE = {
  autoInvalidate: false,
  config: { ex: GEO_CHECK_AGGREGATE_TTL_SECONDS },
} as const;

export const GEO_CHECK_GENERATION_KEY_PREFIX = "geo:checkgen";
export const GEO_CHECK_AGGREGATE_TAG_PREFIX = "geo:checkagg";
export const GEO_CHECK_GENERATION_TTL_SECONDS = 60 * 60 * 24 * 7;
export const INITIAL_GEO_CHECK_GENERATION = 0;
