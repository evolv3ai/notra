import type { QueryClient } from "@tanstack/react-query";

import { dashboardOrpc } from "@/lib/orpc/query";
import type { SiteScope } from "@/types/sites";

/**
 * Marks every branch query stale. Only mounted queries refetch; the rest
 * refetch when they mount again. Pass `"none"` before switching branches so
 * the queries of the branch being left are not fetched one last time.
 */
export async function invalidateSiteBranch(
  client: QueryClient,
  scope: SiteScope,
  refetchType: "active" | "none" = "active"
) {
  const input = { organizationId: scope.organizationId, siteId: scope.siteId };
  await Promise.all([
    client.invalidateQueries({
      queryKey: dashboardOrpc.sites.get.key({ input }),
    }),
    client.invalidateQueries({
      queryKey: dashboardOrpc.sites.branches.list.key({ input }),
    }),
    ...[
      dashboardOrpc.sites.editor.files.key({ input }),
      dashboardOrpc.sites.editor.read.key({ input }),
      dashboardOrpc.sites.editor.validate.key({ input }),
      dashboardOrpc.sites.branches.status.key({ input }),
    ].map((queryKey) => client.invalidateQueries({ queryKey, refetchType })),
  ]);
}
