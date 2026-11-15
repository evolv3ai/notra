import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { SimpleCsrfProtectionLinkPlugin } from "@orpc/client/plugins";

import type { DashboardORPCClient } from "@/lib/orpc/client";
import type { SiteScope } from "@/types/sites";

/** Keep committing persisted drafts when the browser tears down the page. */
export async function flushSiteBranchOnLeave(scope: SiteScope): Promise<void> {
  if (!scope.branch) {
    return;
  }
  const client: DashboardORPCClient = createORPCClient(
    new RPCLink({
      url: `${window.location.origin}/rpc`,
      fetch: (request, init) =>
        globalThis.fetch(request, { ...init, keepalive: true }),
      plugins: [new SimpleCsrfProtectionLinkPlugin()],
    })
  );
  await client.sites.branches.flush({
    ...scope,
    branch: scope.branch,
    skipIfBusy: true,
  });
}
