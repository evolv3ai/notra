import { SITE_PREVIEW_REACHABILITY_TIMEOUT_MS } from "@/constants/sites";

export async function isSitePreviewReachable(
  url: string,
  signal: AbortSignal
): Promise<boolean> {
  const response = await fetch(url, {
    method: "HEAD",
    mode: "no-cors",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    signal: AbortSignal.any([
      signal,
      AbortSignal.timeout(SITE_PREVIEW_REACHABILITY_TIMEOUT_MS),
    ]),
  });
  // Cross-origin pages need not enable CORS for their embedded preview. An
  // opaque response hides its status, so this only catches network failures;
  // an HTTP error page still renders in the iframe.
  return response.type === "opaque" || response.ok;
}
