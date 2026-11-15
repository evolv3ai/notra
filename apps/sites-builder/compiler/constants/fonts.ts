export const GOOGLE_FONTS_CSS_URL = "https://fonts.googleapis.com/css2";
export const GOOGLE_FONTS_LICENSE_URL =
  "https://raw.githubusercontent.com/google/fonts/main";
export const FONT_LICENSE_LOCATIONS = [
  ["ofl", "OFL.txt"],
  ["apache", "LICENSE.txt"],
  ["ufl", "UFL.txt"],
] as const;
export const FONT_FETCH_TIMEOUT_MS = 30_000;
export const FONT_CSS_MAX_BYTES = 100_000;
export const FONT_FILE_MAX_BYTES = 5_000_000;
export const FONT_DOWNLOAD_CONCURRENCY = 4;
export const FONT_URL_RE = /url\(\s*["']?([^\s"')]+)["']?\s*\)/g;
export const FONT_PATH_RE = /^\/s\/[\w/-]+\.(woff2?|ttf|otf)$/;
export const FONT_USER_AGENT =
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
// Weight ranges tried in order when a family's weight isn't pinned. Google
// rejects a range wider than the font's axis, and static fonts often stop at 700.
export const FONT_WEIGHT_RANGES = [
  [300, 800],
  [400, 700],
  [400, 400],
] as const;
// Static fonts are served one weight at a time; these cover most families.
export const FONT_COMMON_WEIGHTS = [300, 400, 500, 600, 700] as const;
export const DEFAULT_HEADING_WEIGHT = 600;
