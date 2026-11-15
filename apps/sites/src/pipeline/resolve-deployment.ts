import type { ParsedSiteHost } from "@notra/sites-core/types/hosts";
import { Effect } from "effect";

import { isAnalyticsEventPath } from "../analytics";
import { loadHost, loadState } from "../loaders";
import { notDeployedPage, notFoundPage, unavailablePage } from "../pages";
import { methodNotAllowed } from "../responses/method-not-allowed";
import type { ResolvedDeployment, SiteRequestContext } from "../types/serving";
import { html } from "../utils/responses";
import { resolvePreview } from "./resolve-preview";

export const resolveDeployment = Effect.fn("Sites.resolveDeployment")(
  function* (context: SiteRequestContext, parsedHost: ParsedSiteHost) {
    const { deps, request } = context;
    const isCustom = parsedHost.kind === "custom";
    const hostRecord = yield* Effect.promise(() =>
      loadHost(
        deps,
        isCustom
          ? parsedHost.hostname
          : `${parsedHost.slug}.${deps.hostingDomain}`
      )
    );
    if (hostRecord?.kind !== (isCustom ? "custom" : "alias")) {
      return html(notFoundPage(), 404);
    }
    const { siteId } = hostRecord;
    const state = yield* Effect.promise(() => loadState(deps, siteId));
    if (!state || (!isCustom && parsedHost.slug !== state.slug)) {
      return html(notFoundPage(), 404);
    }
    if (state.status !== "active") {
      return html(unavailablePage(context.url, state.suspension), 410);
    }
    if (parsedHost.kind === "preview") {
      return yield* resolvePreview(
        context,
        state,
        siteId,
        parsedHost.previewKey
      );
    }
    if (
      request.method === "POST" &&
      !isAnalyticsEventPath(context.url.pathname)
    ) {
      return methodNotAllowed("GET, HEAD");
    }
    if (!state.production) {
      return html(notDeployedPage(), 404);
    }
    const resolved: ResolvedDeployment = {
      siteId,
      deploymentId: state.production.deploymentId,
      isPreview: false,
      trafficToken: state.trafficToken,
    };
    return resolved;
  }
);
