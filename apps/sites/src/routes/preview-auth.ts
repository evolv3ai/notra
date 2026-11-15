import { SITE_PREVIEW_AUTH_PATH } from "@notra/sites-core/constants/sites";
import { Effect, Option } from "effect";

import { handlePreviewAuth } from "../preview-auth";
import type { PreviewRouteContext } from "../types/routes";

export const previewAuthRoute = Effect.fn("Sites.route.previewAuth")(function* (
  context: PreviewRouteContext
) {
  if (context.url.pathname !== SITE_PREVIEW_AUTH_PATH) {
    return Option.none<Response>();
  }
  return Option.some(yield* Effect.promise(() => handlePreviewAuth(context)));
});
