import { matchRedirect } from "@notra/sites-core/utils/redirects";
import { Effect, Option } from "effect";

import { manifestRedirect } from "../responses/redirects";
import type { ManifestRouteContext } from "../types/routes";

export const manifestRedirectsRoute = ({
  path,
  loaded,
}: ManifestRouteContext): Effect.Effect<Option.Option<Response>> =>
  Effect.sync(() =>
    Option.map(
      Option.fromNullishOr(matchRedirect(loaded.manifest.redirects, path)),
      manifestRedirect
    )
  );
