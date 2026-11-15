import { Effect, Option } from "effect";

import { sitemapIndex } from "../responses/sitemap-index";
import type { ManifestRouteContext } from "../types/routes";

export const sitemapIndexRoute = ({
  path,
  host,
  origin,
  area,
  loaded: { manifest },
}: ManifestRouteContext): Effect.Effect<Option.Option<Response>> =>
  Effect.sync(() => {
    if (path !== "/sitemap.xml" || area) {
      return Option.none();
    }
    const { publicOrigin, noindex } = manifest.target;
    const crawlable = new URL(publicOrigin).hostname === host && !noindex;
    if (!crawlable) {
      return Option.none();
    }
    return Option.some(sitemapIndex(origin, manifest));
  });
