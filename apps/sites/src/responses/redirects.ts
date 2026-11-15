import { REDIRECT_CACHE_CONTROL } from "../constants/responses";
import type { RedirectMatch } from "../types/serving";

export function noStoreRedirect(
  location: string,
  status: number,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(null, {
    status,
    headers: {
      Location: location,
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

export function manifestRedirect(redirect: RedirectMatch): Response {
  return new Response(null, {
    status: redirect.status,
    headers: {
      Location: redirect.location,
      "Cache-Control": REDIRECT_CACHE_CONTROL,
    },
  });
}
