import { Effect, Option } from "effect";

import { noStoreRedirect } from "../responses/redirects";
import type { ManifestRouteContext } from "../types/routes";

export const rootRedirectRoute = ({
  path,
  area,
  url,
  loaded,
}: ManifestRouteContext): Effect.Effect<Option.Option<Response>> =>
  Effect.sync(() => {
    if (path !== "/" || area) {
      return Option.none();
    }
    const { mounts } = loaded.manifest.target;
    const home = mounts.blog ?? mounts.changelog;
    return home
      ? Option.some(noStoreRedirect(`${home}${url.search}`, 302))
      : Option.none();
  });
