export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_MAX_CMAP_CHARACTERS = 200_000;
export const OG_TEMPLATE_VERSION = 1;
export const OG_DESIGN_REVISION = 7;
export const OG_LOGO_PREVIEW_BOUNDS = { width: 256, height: 192 };
export const OG_ART_PREVIEW_BOUNDS = { width: 768, height: 384 };
export const OG_DESIGN_TIMEOUT_MS = 180_000;
export const OG_DESIGN_FAILURE_TTL_MS = 6 * 60 * 60 * 1000;
export const OG_DESIGN_LEASE_MS = OG_DESIGN_TIMEOUT_MS + 60_000;
export const OG_DESIGN_RECOVERY_MS = 60_000;
export const OG_COST_LOOKUP_TIMEOUT_MS = 5000;
export const OG_HASH_IGNORED_KEYS = new Set([
  "createdAt",
  "updatedAt",
  "metadata",
  "contextDevMeta",
  "status",
  "lastGeneratedAt",
  "lastGenerationError",
  "sourcePdfUploadedAt",
]);
export const OG_WIDE_TITLE_MIN_WIDTH = 900;
export const OG_TITLE_LINE_LIMITS = [
  { maxCharacters: 80, wide: 2, split: 3 },
  { maxCharacters: 160, wide: 3, split: 5 },
] as const;
export const OG_TEMPLATE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const OG_FETCH_TIMEOUT_MS = 15_000;
export const OG_RESEARCH_TIMEOUT_MS = 35_000;
export const OG_ASSET_MAX_BYTES = 2_000_000;
export const OG_DOCUMENT_MAX_BYTES = 8_000_000;
export const OG_DESIGN_ATTEMPTS = 3;
export const OG_PROBE_TITLES = [
  "From idea to production: building tools your team actually uses",
  "How Development Teams Can Turn Weekly Product Updates into Blog Posts, Changelogs and Social Content Without Losing Their Brand Voice",
] as const;
export const OG_FONT_WEIGHTS = [400, 500, 600, 700] as const;
export const OG_HEX_COLOR = /^#[0-9a-f]{6}$/i;
export const OG_WOFF2_SIGNATURE = "wOF2";
export const OG_GENERIC_FONT =
  /^(system-ui|ui-sans-serif|sans-serif|-apple-system|BlinkMacSystemFont)$/i;
