import { Effect, Option } from "effect";

import { manifestRedirect } from "../responses/redirects";
import type { ManifestRouteContext } from "../types/routes";
import { trailingSlashPagePath } from "../utils/routing";

export const trailingSlashRedirectRoute = ({
  path,
  url,
  loaded,
}: ManifestRouteContext): Effect.Effect<Option.Option<Response>> =>
  Effect.sync(() =>
    Option.map(
      Option.fromNullishOr(trailingSlashPagePath(loaded.files, path)),
      (pagePath) =>
        manifestRedirect({ status: 308, location: `${pagePath}${url.search}` })
    )
  );
