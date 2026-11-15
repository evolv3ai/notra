import { parseSiteHost } from "@notra/sites-core/utils/hosts";
import { Effect, Option } from "effect";

import { REQUEST_ROUTES } from "./constants/routes";
import { notFoundPage, serviceErrorPage } from "./pages";
import { resolveDeployment } from "./pipeline/resolve-deployment";
import { serveDeployment } from "./pipeline/serve-deployment";
import type { SitesDeps } from "./types/worker";
import { isStateUnavailable } from "./utils/errors";
import { requestHost } from "./utils/request-host";
import { html } from "./utils/responses";
import { runRoutes } from "./utils/run-routes";

const siteRequest = Effect.fn("Sites.handleRequest")(function* (
  request: Request,
  deps: SitesDeps
) {
  const url = new URL(request.url);
  const host = requestHost(deps, request, url);
  const answered = yield* runRoutes(REQUEST_ROUTES, {
    deps,
    request,
    url,
    host,
  });
  if (Option.isSome(answered)) {
    return answered.value;
  }
  const parsedHost = parseSiteHost(host, deps.hostingDomain);
  if (!parsedHost) {
    return html(notFoundPage(), 404);
  }
  const origin = `${url.protocol}//${host}${url.port ? `:${url.port}` : ""}`;
  const context = { deps, request, url, host, origin };
  return yield* resolveDeployment(context, parsedHost).pipe(
    Effect.flatMap((resolved) =>
      resolved instanceof Response
        ? Effect.succeed(resolved)
        : serveDeployment(context, resolved)
    ),
    Effect.map((response) =>
      request.method === "HEAD" ? new Response(null, response) : response
    ),
    Effect.catchDefect((error) => {
      if (!isStateUnavailable(error)) {
        return Effect.die(error);
      }
      console.error("sites.state_unavailable", { host, error: String(error) });
      return Effect.succeed(
        html(serviceErrorPage(), 503, { "Retry-After": "5" })
      );
    })
  );
});

export function handleSiteRequest(
  request: Request,
  deps: SitesDeps
): Promise<Response> {
  return Effect.runPromise(siteRequest(request, deps));
}
