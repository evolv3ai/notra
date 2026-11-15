import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";
import { useQueries } from "@tanstack/react-query";
import { parseAsString, useQueryState } from "nuqs";

import { useProjectBrandDefaults } from "@/lib/hooks/use-site-brand-defaults";
import { dashboardOrpc } from "@/lib/orpc/query";

/**
 * Starts the workspace reads alongside the site itself instead of after it,
 * so the changes strip and the Design forms arrive with the page. Warms the
 * brand identity too, so Branding opens complete.
 */
export function usePrefetchSiteWorkspace(
  organizationId: string,
  siteId: string,
  projectId: string
) {
  const [branch] = useQueryState("branch", parseAsString);
  const enabled = organizationId.length > 0;
  const scope = { organizationId, siteId, branch: branch ?? undefined };
  useQueries({
    queries: [
      dashboardOrpc.sites.editor.read.queryOptions({
        input: { ...scope, path: SITE_CONFIG_FILENAME },
        refetchOnWindowFocus: false,
        enabled,
      }),
      dashboardOrpc.sites.editor.files.queryOptions({
        input: scope,
        refetchOnWindowFocus: false,
        enabled,
      }),
    ],
  });
  useProjectBrandDefaults(organizationId, projectId);
}
