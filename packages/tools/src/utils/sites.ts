import { fetchPublicUrl } from "@notra/ai/utils/public-fetch";
import { assertPublicHttpUrl } from "@notra/utils/url";
import { Effect } from "effect";

import {
  SITE_CONTENT_MAX_BYTES,
  SITE_CONTENT_TIMEOUT_MS,
  SITE_CONTENT_TYPES,
} from "../constants/sites";
import { SiteContentReadError } from "../schemas/sites";
import type { PublicSite } from "../types/sites";

function publicSiteOrigin(origin: string): URL | null {
  const url = URL.parse(origin);
  if (
    !url ||
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    return null;
  }
  try {
    assertPublicHttpUrl(url.href);
  } catch {
    return null;
  }
  return url;
}

export function serializePublicSite(site: PublicSite) {
  const origin = publicSiteOrigin(site.publicOrigin);
  if (!origin) {
    return null;
  }
  const areas = Object.entries(site.mounts).map(([area, mount]) => ({
    area,
    url: new URL(mount, origin).href,
    markdownUrl: new URL(`${mount === "/" ? "" : mount}/index.md`, origin).href,
  }));
  return {
    id: site.id,
    projectId: site.projectId,
    name: site.name,
    url: origin.href,
    areas,
  };
}

export function siteContentUrl(
  site: PublicSite,
  area: "blog" | "changelog" | undefined,
  path: string | undefined
): URL {
  const origin = publicSiteOrigin(site.publicOrigin);
  const mount = site.mounts[area ?? (site.mounts.blog ? "blog" : "changelog")];
  if (!origin || !mount) {
    throw new Error("This site has no public content in the requested area");
  }
  const prefix = mount === "/" ? "" : mount;
  const requestedPath = path ?? `${prefix}/index.md`;
  if (
    !requestedPath.startsWith("/") ||
    requestedPath.startsWith("//") ||
    /[\\%?#\s]/.test(requestedPath) ||
    requestedPath
      .split("/")
      .some((segment) => segment.startsWith(".") || segment === "_notra")
  ) {
    throw new Error("Use a public page path from this site's content index");
  }
  const url = new URL(requestedPath, origin);
  if (
    url.origin !== origin.origin ||
    (prefix &&
      url.pathname !== prefix &&
      !url.pathname.startsWith(`${prefix}/`))
  ) {
    throw new Error(
      "The page must be within the requested site's content area"
    );
  }
  if (
    url.pathname === `${prefix}/llms.txt` ||
    url.pathname === `${prefix}/llms-full.txt` ||
    url.pathname.endsWith(".md")
  ) {
    return url;
  }
  url.pathname = `${url.pathname.replace(/\/$/, "")}/index.md`;
  return url;
}

export function readPublicSiteContent(url: URL) {
  return Effect.runPromise(
    Effect.tryPromise({
      try: async (signal) => {
        const response = await fetchPublicUrl(
          url,
          {
            credentials: "omit",
            headers: { Accept: "text/markdown, text/plain" },
            signal,
          },
          { timeoutMs: SITE_CONTENT_TIMEOUT_MS }
        );
        const contentType = response.headers
          .get("content-type")
          ?.split(";")[0]
          ?.trim()
          .toLowerCase();
        if (
          !response.ok ||
          !contentType ||
          !SITE_CONTENT_TYPES.has(contentType)
        ) {
          await response.body?.cancel();
          throw new SiteContentReadError();
        }
        if (!response.body) {
          throw new SiteContentReadError();
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let content = "";
        let bytes = 0;
        let truncated = false;
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            const remaining = SITE_CONTENT_MAX_BYTES - bytes;
            content += decoder.decode(value.subarray(0, remaining), {
              stream: true,
            });
            bytes += value.byteLength;
            if (bytes > SITE_CONTENT_MAX_BYTES) {
              truncated = true;
              break;
            }
          }
          content += decoder.decode();
          return { content, truncated };
        } finally {
          await reader.cancel();
          reader.releaseLock();
        }
      },
      catch: () => new SiteContentReadError(),
    }).pipe(Effect.timeout(SITE_CONTENT_TIMEOUT_MS))
  );
}
