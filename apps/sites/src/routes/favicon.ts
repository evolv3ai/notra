import {
  SITE_FAVICON_DIR,
  SITE_FAVICON_HOST,
} from "@notra/sites-core/constants/sites";
import { googleFaviconUrl } from "@notra/utils/google-favicon";
import { Effect, Option } from "effect";

import {
  FAVICON_CACHE_CONTROL,
  FAVICON_FALLBACK_SVG,
  FAVICON_MAX_BYTES,
  FAVICON_RETRY_CACHE_CONTROL,
} from "../constants/favicons";
import { EDGE_CACHE_ORIGIN } from "../constants/responses";
import { methodNotAllowed } from "../responses/method-not-allowed";
import type { DeploymentRouteContext } from "../types/routes";
import type { SitesDeps } from "../types/worker";

const FAVICON_SEGMENT = `/${SITE_FAVICON_DIR}/`;

function faviconResponse(
  body: BodyInit,
  contentType: string,
  cacheControl = FAVICON_CACHE_CONTROL
): Response {
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** The image to serve, or null when the lookup failed and should be retried. */
async function lookupFavicon(host: string, deps: SitesDeps) {
  const upstream = googleFaviconUrl(host);
  if (!upstream) {
    return faviconResponse(FAVICON_FALLBACK_SVG, "image/svg+xml");
  }
  const response = await deps
    .fetch(upstream, { redirect: "follow" })
    .catch(() => null);
  // Google answers hosts without a favicon with 404; that is a real answer.
  if (response?.status === 404) {
    return faviconResponse(FAVICON_FALLBACK_SVG, "image/svg+xml");
  }
  const contentType = response?.headers.get("Content-Type") ?? "";
  if (!(response?.ok && contentType.startsWith("image/"))) {
    return null;
  }
  const bytes = await response.arrayBuffer().catch(() => null);
  if (
    !bytes ||
    bytes.byteLength === 0 ||
    bytes.byteLength > FAVICON_MAX_BYTES
  ) {
    return null;
  }
  return faviconResponse(bytes, contentType);
}

/** Fetched server-side so readers' browsers never contact a third party. */
async function fetchFavicon(deps: SitesDeps, host: string): Promise<Response> {
  const cacheKey = `${EDGE_CACHE_ORIGIN}/favicons/${host}`;
  const cached = await deps.cache?.match(cacheKey);
  if (cached) {
    return cached;
  }
  const favicon = await lookupFavicon(host, deps);
  if (!favicon) {
    return faviconResponse(
      FAVICON_FALLBACK_SVG,
      "image/svg+xml",
      FAVICON_RETRY_CACHE_CONTROL
    );
  }
  if (deps.cache) {
    deps.waitUntil(deps.cache.put(cacheKey, favicon.clone()));
  }
  return favicon;
}

export const faviconRoute = Effect.fn("Sites.route.favicon")(function* ({
  deps,
  request,
  url,
  loaded,
}: DeploymentRouteContext) {
  const index = url.pathname.lastIndexOf(FAVICON_SEGMENT);
  if (index === -1) {
    return Option.none<Response>();
  }
  const host = url.pathname.slice(index + FAVICON_SEGMENT.length);
  if (!SITE_FAVICON_HOST.test(host)) {
    return Option.none<Response>();
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return Option.some(methodNotAllowed("GET, HEAD"));
  }
  // Only the host the deployment links to, so the route can't proxy arbitrary sites.
  if (loaded.manifest.faviconHost !== host) {
    return Option.none<Response>();
  }
  return Option.some(yield* Effect.promise(() => fetchFavicon(deps, host)));
});
