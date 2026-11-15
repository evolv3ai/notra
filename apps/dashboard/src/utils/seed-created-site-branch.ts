import type { QueryClient } from "@tanstack/react-query";

import { dashboardOrpc } from "@/lib/orpc/query";
import type { SiteBranchStatus } from "@/types/site-branches";
import type { SiteScope } from "@/types/sites";

/**
 * A branch Notra just created has no pull request yet and accepts commits, so
 * the editor can show it at once while the real status loads in the background.
 */
export function seedCreatedSiteBranch(
  client: QueryClient,
  scope: SiteScope,
  branch: string,
  hasDraft: boolean
) {
  const input = { organizationId: scope.organizationId, siteId: scope.siteId };
  const source = client.getQueryData<SiteBranchStatus>(
    dashboardOrpc.sites.branches.status.queryKey({
      input: { ...input, branch: scope.branch },
    })
  );
  client.setQueryData<SiteBranchStatus>(
    dashboardOrpc.sites.branches.status.queryKey({
      input: { ...input, branch },
    }),
    {
      branch,
      canPublishDirect: source?.canPublishDirect ?? false,
      canEdit: true,
      protected: false,
      pullRequest: null,
      canMerge: false,
      hasFeatureBranches: true,
      changedFiles: source?.changedFiles ?? 0,
    }
  );
  client.setQueryData(
    dashboardOrpc.sites.branches.list.queryKey({ input }),
    (entries) =>
      entries && !entries.some((entry) => entry.name === branch)
        ? [...entries, { name: branch, status: null, exists: true, hasDraft }]
        : entries
  );
}
