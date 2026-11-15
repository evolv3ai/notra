import { Effect, Option } from "effect";

import { previewAccessDenied } from "../preview-auth";
import type { PreviewRouteContext } from "../types/routes";

export const previewAccessGateRoute = Effect.fn(
  "Sites.route.previewAccessGate"
)(function* (context: PreviewRouteContext) {
  if (context.pointer.visibility !== "protected") {
    return Option.none<Response>();
  }
  const denied = yield* Effect.promise(() => previewAccessDenied(context));
  return Option.fromNullishOr(denied);
});
