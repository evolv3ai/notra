import { Effect, Option } from "effect";

import { robotsTxt } from "../responses/robots-txt";
import type { ManifestRouteContext } from "../types/routes";

export const robotsTxtRoute = ({
  path,
  host,
  origin,
  loaded: { manifest },
}: ManifestRouteContext): Effect.Effect<Option.Option<Response>> =>
  Effect.sync(() => {
    if (path !== "/robots.txt") {
      return Option.none();
    }
    const { publicOrigin, noindex } = manifest.target;
    const crawlable = new URL(publicOrigin).hostname === host && !noindex;
    return Option.some(robotsTxt(origin, crawlable ? manifest : null));
  });
