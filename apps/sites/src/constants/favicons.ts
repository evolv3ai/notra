export const FAVICON_MAX_BYTES = 256 * 1024;
export const FAVICON_CACHE_CONTROL =
  "public, max-age=86400, stale-while-revalidate=604800";
/** A failed lookup is retried soon instead of pinning the globe for a day. */
export const FAVICON_RETRY_CACHE_CONTROL = "public, max-age=300";
/** Shown when the host has no favicon, so the footer never shows a broken image. */
export const FAVICON_FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#71717a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`;
