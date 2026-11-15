import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";
import { useQuery } from "@tanstack/react-query";
import { parseAsString, useQueryState } from "nuqs";

import { useSite } from "@/components/sites/site-context";
import { dashboardOrpc } from "@/lib/orpc/query";

export function useSiteConfigDocument(branchOverride?: string, enabled = true) {
  const { organizationId, siteId } = useSite();
  const [selectedBranch] = useQueryState("branch", parseAsString);
  const branch = branchOverride ?? selectedBranch ?? undefined;
  return useQuery(
    dashboardOrpc.sites.editor.read.queryOptions({
      input: { organizationId, siteId, branch, path: SITE_CONFIG_FILENAME },
      refetchOnWindowFocus: false,
      enabled,
    })
  );
}
