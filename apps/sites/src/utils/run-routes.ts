import { Effect, Option } from "effect";

import type { SiteRoute } from "../types/routes";

export function runRoutes<Context>(
  routes: readonly SiteRoute<Context>[],
  context: Context
): Effect.Effect<Option.Option<Response>> {
  return Effect.gen(function* () {
    for (const route of routes) {
      const response = yield* route(context);
      if (Option.isSome(response)) {
        return response;
      }
    }
    return Option.none<Response>();
  });
}
