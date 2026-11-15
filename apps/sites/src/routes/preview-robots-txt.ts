import { Effect, Option } from "effect";

import { robotsTxt } from "../responses/robots-txt";
import type { PreviewRouteContext } from "../types/routes";

export const previewRobotsTxtRoute = ({
  url,
  origin,
}: PreviewRouteContext): Effect.Effect<Option.Option<Response>> =>
  Effect.sync(() =>
    url.pathname === "/robots.txt"
      ? Option.some(robotsTxt(origin, null))
      : Option.none()
  );
