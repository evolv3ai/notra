import { joinMountPath } from "@notra/sites-core/utils/mounts";
import { Effect, Option } from "effect";

import { robotsTxt } from "../responses/robots-txt";
import type { ManifestRouteContext } from "../types/routes";

export const mountRobotsTxtRoute = ({
  path,
  area,
  resolved,
  loaded: { manifest },
}: ManifestRouteContext): Effect.Effect<Option.Option<Response>> =>
  Effect.sync(() => {
    if (
      !area ||
      area.mount === "/" ||
      path !== joinMountPath(area.mount, "robots.txt")
    ) {
      return Option.none();
    }
    const { publicOrigin, noindex } = manifest.target;
    const crawlable = !(noindex || resolved.isPreview);
    return Option.some(
      robotsTxt(publicOrigin, crawlable ? manifest : null, area.mount)
    );
  });
