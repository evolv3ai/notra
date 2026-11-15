import { Effect, Option } from "effect";

import { DEPLOYMENT_ROUTES } from "../constants/routes";
import { loadManifest } from "../loaders";
import { isReportablePageView, reportTraffic } from "../traffic";
import type { ResolvedDeployment, SiteRequestContext } from "../types/serving";
import { StateUnavailableError } from "../utils/errors";
import { runRoutes } from "../utils/run-routes";
import { visitorConsent } from "../utils/visitor-consent";
import { serveManifest } from "./serve-manifest";

export const serveDeployment = Effect.fn("Sites.serveDeployment")(function* (
  context: SiteRequestContext,
  resolved: ResolvedDeployment
) {
  const { deps, request, url, host } = context;
  const { siteId, deploymentId, trafficToken } = resolved;
  const loaded = yield* Effect.promise(() =>
    loadManifest(deps, siteId, deploymentId)
  );
  if (!loaded) {
    return yield* Effect.die(
      new StateUnavailableError(
        `Manifest missing for active deployment ${deploymentId}`
      )
    );
  }
  const consent = visitorConsent(
    loaded.manifest,
    request.headers,
    host,
    deps.hostingDomain
  );
  const deploymentContext = {
    ...context,
    resolved,
    loaded,
    visitorConsent: consent,
  };
  const answered = yield* runRoutes(DEPLOYMENT_ROUTES, deploymentContext);
  if (Option.isSome(answered)) {
    return answered.value;
  }
  const response = yield* serveManifest(deploymentContext);
  if (
    trafficToken &&
    deps.trafficIngestUrl &&
    isReportablePageView(request, response, deps.dashboardUrl)
  ) {
    const { publicOrigin } = loaded.manifest.target;
    deps.waitUntil(
      reportTraffic({
        fetch: deps.fetch,
        ingestUrl: deps.trafficIngestUrl,
        token: trafficToken,
        request,
        method: request.method,
        referer: request.headers.get("referer"),
        publicUrl: new URL(`${url.pathname}${url.search}`, publicOrigin).href,
        proxied: new URL(publicOrigin).hostname !== host,
        status: response.status,
        visitorConsent: consent,
      })
    );
  }
  return response;
});
