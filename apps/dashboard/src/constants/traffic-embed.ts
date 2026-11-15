import type { TrafficEmbedRange } from "../types/traffic-embed";

/** About 143 bits from nanoid's 64-symbol alphabet, like chat share links. */
export const TRAFFIC_EMBED_ID_LENGTH = 24;

export const TRAFFIC_EMBED_PATH_PREFIX = "/embed/ai-traffic/";

export const TRAFFIC_EMBED_RANGES = [
  "7d",
  "14d",
  "30d",
  "90d",
] as const satisfies readonly TrafficEmbedRange[];

export const TRAFFIC_EMBED_DEFAULT_RANGE: TrafficEmbedRange = "30d";

export const TRAFFIC_EMBED_MAX_PER_ORGANIZATION = 50;

/**
 * Embeds sit on customer pages, so every view would otherwise be a Tinybird
 * query. Ten minutes keeps the chart fresh enough for a day-granular series.
 */
export const TRAFFIC_EMBED_DATA_TTL_SECONDS = 600;

/**
 * How long a revoked or edited embed can keep its old config when dropping
 * the cached entry fails. A CDN miss at the end of that window caches the
 * page again, so this and the CDN TTL add up to the minute the delete dialog
 * promises.
 */
export const TRAFFIC_EMBED_CONFIG_TTL_SECONDS = 30;

/**
 * Vercel's CDN serves an embed page this long without running it. Nothing
 * purges it, so this is how long a deleted embed or removed domain still
 * shows.
 */
export const TRAFFIC_EMBED_CDN_TTL_SECONDS = 30;

export const TRAFFIC_EMBED_CACHE_PREFIX = "cache:geo-traffic-embed:v1";

export const TRAFFIC_EMBED_REDIS_READ_TIMEOUT_MS = 300;

export const TRAFFIC_EMBED_REDIS_WRITE_TIMEOUT_MS = 1000;

export const TRAFFIC_EMBED_RESIZE_MESSAGE = "notra:embed:resize";

export const TRAFFIC_EMBED_DEFAULT_HEIGHT = 420;

/**
 * The page needs its own origin to hydrate; popups let the attribution link
 * open and downloads let the chart's PNG export save. Top navigation stays
 * blocked, so the frame can't redirect its host.
 */
export const TRAFFIC_EMBED_SANDBOX =
  "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads";

/** Cached in place of a config for ids with no active embed. */
export const TRAFFIC_EMBED_CONFIG_MISS = "missing";

/** Never written, so embeds don't share the dashboard's saved theme. */
export const TRAFFIC_EMBED_THEME_STORAGE_KEY = "notra-embed-theme";
