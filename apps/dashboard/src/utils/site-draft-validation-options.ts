import { dashboardOrpc } from "@/lib/orpc/query";
import type { SiteScope } from "@/types/sites";

export function siteDraftValidationOptions(
  scope: SiteScope,
  version: string,
  enabled: boolean
) {
  return dashboardOrpc.sites.editor.validate.queryOptions({
    input: scope,
    queryKey: [
      ...dashboardOrpc.sites.editor.validate.queryKey({ input: scope }),
      version,
    ],
    enabled,
    staleTime: 0,
  });
}
