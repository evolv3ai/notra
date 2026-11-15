import { getAppUrl } from "@notra/ai/utils/url";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";

import { createDashboardLinkPlugins } from "./link-plugins";
import type { DashboardRouter } from "./router";

function getBaseUrl() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return getAppUrl() ?? "http://localhost:3000";
}

const link = new RPCLink({
  fetch: (request, init) => globalThis.fetch(request, init),
  plugins: createDashboardLinkPlugins(),
  url: `${getBaseUrl()}/rpc`,
});

export const dashboardOrpcClient: RouterClient<DashboardRouter> =
  createORPCClient(link);

export type DashboardORPCClient = RouterClient<DashboardRouter>;
