import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";
import { createRouterClient } from "@orpc/server";
import { dehydrate } from "@tanstack/react-query";

import { createORPCContext } from "@/lib/orpc/context";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { LoadedMembership } from "@/types/auth/organization";
import { getGeoServerQueryClient } from "@/utils/geo-query-client.server";
import { seedMembership } from "@/utils/seed-membership.server";

/**
 * Loads the site on the server so a navigation (or link hover) renders the
 * layout from the loader instead of fetching after it mounts. The workspace's
 * GitHub reads only need the site id, so they start too and stream in pending.
 */
export async function dehydrateSiteQueries(
  organizationId: string,
  siteId: string,
  branch: string | undefined,
  requestHeaders: Headers,
  membership: LoadedMembership | undefined
) {
  const [{ sitesRouter }] = await Promise.all([
    import("@/lib/orpc/routers/sites"),
    seedMembership(organizationId, requestHeaders, membership),
  ]);
  const client = createRouterClient(
    { sites: sitesRouter },
    { context: () => createORPCContext({ headers: requestHeaders }) }
  );
  const queryClient = getGeoServerQueryClient();
  const scope = { organizationId, siteId };
  const documentInput = { ...scope, branch, path: SITE_CONFIG_FILENAME };
  const filesInput = { ...scope, branch };

  void queryClient.prefetchQuery({
    ...dashboardOrpc.sites.editor.read.queryOptions({ input: documentInput }),
    queryFn: () => client.sites.editor.read(documentInput),
  });
  void queryClient.prefetchQuery({
    ...dashboardOrpc.sites.editor.files.queryOptions({ input: filesInput }),
    queryFn: () => client.sites.editor.files(filesInput),
  });
  const detailOptions = dashboardOrpc.sites.get.queryOptions({ input: scope });
  await queryClient.prefetchQuery({
    ...detailOptions,
    queryFn: () => client.sites.get(scope),
  });

  return {
    state: dehydrate(queryClient),
    name: queryClient.getQueryData(detailOptions.queryKey)?.site.name ?? null,
  };
}
