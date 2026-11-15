import { SITE_R2_KEYS } from "@notra/sites-core/constants/sites";
import type { SiteManifestFile } from "@notra/sites-core/types/deployment";

import { injectAnalyticsScript } from "./analytics";
import {
  ASSET_SEGMENT,
  EDGE_CACHE_MAX_FILE_BYTES,
  EDGE_CACHE_ORIGIN,
  IMMUTABLE_CACHE_CONTROL,
  PREVIEW_CACHE_CONTROL,
  REVALIDATE_CACHE_CONTROL,
} from "./constants/responses";
import { serviceErrorPage } from "./pages";
import type { ServeFileParams } from "./types/serving";
import type { SitesDeps } from "./types/worker";
import { html } from "./utils/responses";
import { readVerifiedBody } from "./utils/verified-body";

function fileCacheControl(file: SiteManifestFile, isPreview: boolean): string {
  if (isPreview) {
    return PREVIEW_CACHE_CONTROL;
  }
  return file.immutable || file.path.includes(ASSET_SEGMENT)
    ? IMMUTABLE_CACHE_CONTROL
    : REVALIDATE_CACHE_CONTROL;
}

async function readFileBody(
  deps: SitesDeps,
  siteId: string,
  deploymentId: string,
  file: SiteManifestFile
): Promise<ReadableStream | null> {
  // Keyed by content, so files a redeploy or another area didn't change stay
  // warm. The site ID keeps tenants from probing each other's cache.
  const cacheKey = `${EDGE_CACHE_ORIGIN}/${siteId}/${file.sha256}`;
  const cached = await deps.cache?.match(cacheKey);
  if (cached?.body) {
    return cached.body;
  }
  const object = await deps.bucket.get(
    SITE_R2_KEYS.file(siteId, deploymentId, file.path)
  );
  if (!(object?.body && deps.cache) || file.size > EDGE_CACHE_MAX_FILE_BYTES) {
    return object?.body ?? null;
  }
  const { cache } = deps;
  const [forClient, forCache] = object.body.tee();
  deps.waitUntil(
    readVerifiedBody(forCache, file).then(async (verified) => {
      if (!verified) {
        return;
      }
      await cache.put(
        cacheKey,
        new Response(verified, {
          headers: {
            "Content-Type": file.contentType,
            "Cache-Control": IMMUTABLE_CACHE_CONTROL,
          },
        })
      );
    })
  );
  return forClient;
}

export async function serveFile(params: ServeFileParams): Promise<Response> {
  const { deps, request, siteId, deploymentId, file, status, isPreview } =
    params;
  const analytics =
    status === 200 && file.contentType.startsWith("text/html")
      ? (params.analytics ?? null)
      : null;
  const etag = analytics
    ? `"${file.sha256}-a${analytics.reportsView ? "v" : ""}"`
    : `"${file.sha256}"`;
  const headers = new Headers({
    "Content-Type": file.contentType,
    "Cache-Control": fileCacheControl(file, isPreview),
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });
  if (
    params.contentSecurityPolicy &&
    file.contentType.startsWith("text/html")
  ) {
    headers.set("Content-Security-Policy", params.contentSecurityPolicy);
  }
  for (const [name, value] of Object.entries(params.extraHeaders ?? {})) {
    headers.set(name, value);
  }
  if (isPreview) {
    headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  if (status === 200 && request.headers.get("If-None-Match") === etag) {
    return new Response(null, { status: 304, headers });
  }
  const body = await readFileBody(deps, siteId, deploymentId, file);
  if (!body) {
    return html(serviceErrorPage(), 503);
  }
  const response = new Response(request.method === "HEAD" ? null : body, {
    status,
    headers,
  });
  return analytics && request.method !== "HEAD"
    ? injectAnalyticsScript(response, analytics)
    : response;
}
