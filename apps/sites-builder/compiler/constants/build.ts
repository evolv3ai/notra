export const AREA_PAGES_FILE = "notra-pages.json";

export const ASTRO_LOG_NOISE: readonly RegExp[] = [
  /\[glob-loader\] No files found matching/,
  /\[glob-loader\] The base directory .* does not exist/,
  /\[content\] The collection "(?:blog|changelog)" does not exist or is empty/,
  // Dev areas listen on internal ports behind the proxy; only its URL is public.
  /┃ (?:Local|Network)\s+http:\/\/127\.0\.0\.1:\d+/,
  /astro\s+v[\d.]+\s+ready in/,
  /watching for file changes\.\.\./,
  /\[types\] Generated/,
  /\[content\] Sync(?:ing|ed) content/,
];

export const SHIKI_UNKNOWN_LANGUAGE =
  /\[Shiki\] The language "([^"]+)" doesn't exist/;
