import { Effect, Option } from "effect";

import { manifestRedirect } from "../responses/redirects";
import type { ManifestRouteContext } from "../types/routes";
import { wellKnownLlmsTxtTarget } from "../utils/routing";

export const wellKnownLlmsTxtRoute = ({
  path,
  loaded,
}: ManifestRouteContext): Effect.Effect<Option.Option<Response>> =>
  Effect.sync(() =>
    Option.map(
      Option.fromNullishOr(wellKnownLlmsTxtTarget(loaded.files, path)),
      (location) => manifestRedirect({ location, status: 301 })
    )
  );
