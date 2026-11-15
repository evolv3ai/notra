export const GEO_CONTEXT_API_URL = "https://api.context.dev/v1/web/scrape";
export const GEO_CONTEXT_API_KEY_ENV = "CONTEXT_DEV_API_KEY";
export const GEO_CONTEXT_ENGINES = [
  "google/gemini",
  "google/ai-overview",
] as const;
export const GEO_CONTEXT_TIMEOUT_MS = 110_000;
export const GEO_CONTEXT_PROVIDER_TIMEOUT_MS = 90_000;
export const GEO_CONTEXT_MAX_HTML_BYTES = 8_000_000;
export const GEO_CONTEXT_MAX_RESPONSE_BYTES = 16_000_000;
export const GEO_CONTEXT_MAX_PROMPT_LENGTH = 12_000;
export const GEO_CONTEXT_PARSER_VERSION = 1;
export const GEO_CONTEXT_GOOGLE_ORIGIN = "https://www.google.com";
export const GEO_CONTEXT_SOURCE_TIMEOUT_MS = 10_000;
export const GEO_CONTEXT_SOURCE_CONCURRENCY = 4;
export const GEO_CONTEXT_BLOCK_TAGS = new Set([
  "p",
  "div",
  "section",
  "h1",
  "h2",
  "h3",
  "h4",
  "li",
  "ul",
  "ol",
  "table",
  "tr",
  "br",
]);
export const GEO_CONTEXT_IGNORED_TAGS = new Set([
  "script",
  "style",
  "template",
  "svg",
  "button",
  "nav",
  "sources-carousel-inline",
  "source-footnote",
]);
