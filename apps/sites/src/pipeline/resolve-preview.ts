import type { SiteServingState } from "@notra/sites-core/types/deployment";
import { isPreviewExpired } from "@notra/sites-core/utils/serving-state";
import { Effect, Option } from "effect";

import { PREVIEW_ROUTES } from "../constants/routes";
import { notFoundPage, previewClosedPage } from "../pages";
import type { ResolvedDeployment, SiteRequestContext } from "../types/serving";
import { html } from "../utils/responses";
import { runRoutes } from "../utils/run-routes";

export const resolvePreview = Effect.fn("Sites.resolvePreview")(function* (
  context: SiteRequestContext,
  state: SiteServingState,
  siteId: string,
  previewKey: string
) {
  const pointer = state.previews[previewKey];
  if (!pointer) {
    return previewKey in state.removedPreviews
      ? html(previewClosedPage(), 410)
      : html(notFoundPage(), 404);
  }
  if (isPreviewExpired(pointer, context.deps.now())) {
    return html(previewClosedPage(), 410);
  }
  const answered = yield* runRoutes(PREVIEW_ROUTES, {
    ...context,
    state,
    siteId,
    previewKey,
    pointer,
  });
  if (Option.isSome(answered)) {
    return answered.value;
  }
  const resolved: ResolvedDeployment = {
    siteId,
    deploymentId: pointer.deploymentId,
    isPreview: true,
    trafficToken: null,
  };
  return resolved;
});
