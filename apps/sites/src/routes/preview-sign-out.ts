import { SITE_PREVIEW_SIGN_OUT_PATH } from "@notra/sites-core/constants/sites";
import { Effect, Option } from "effect";

import { handlePreviewSignOut } from "../preview-auth";
import type { PreviewRouteContext } from "../types/routes";

export const previewSignOutRoute = (
  context: PreviewRouteContext
): Effect.Effect<Option.Option<Response>> =>
  Effect.sync(() =>
    context.url.pathname === SITE_PREVIEW_SIGN_OUT_PATH
      ? Option.some(handlePreviewSignOut(context))
      : Option.none()
  );
