import { SITE_PREVIEW_AUTH_PATH } from "@notra/sites-core/constants/sites";
import { Effect, Option } from "effect";

import { isAnalyticsEventPath } from "../analytics";
import { methodNotAllowed } from "../responses/method-not-allowed";
import type { RequestRouteContext } from "../types/routes";

export const methodNotAllowedRoute = ({
  request,
  url,
}: RequestRouteContext): Effect.Effect<Option.Option<Response>> =>
  Effect.sync(() => {
    const allowsPost =
      url.pathname === SITE_PREVIEW_AUTH_PATH ||
      isAnalyticsEventPath(url.pathname);
    const allowed = allowsPost ? ["GET", "HEAD", "POST"] : ["GET", "HEAD"];
    return allowed.includes(request.method)
      ? Option.none()
      : Option.some(methodNotAllowed(allowed.join(", ")));
  });
