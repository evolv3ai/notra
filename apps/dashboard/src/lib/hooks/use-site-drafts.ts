import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";
import { isSiteImageDraftPath } from "@notra/sites-core/utils/image-drafts";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { dashboardOrpc } from "@/lib/orpc/query";
import type { SiteDraftResult } from "@/types/site-drafts";
import type { SiteScope } from "@/types/sites";

export function useSiteDrafts(scope: SiteScope) {
  const client = useQueryClient();
  const options = dashboardOrpc.sites.editor.files.queryOptions({
    input: scope,
    refetchOnWindowFocus: false,
  });
  const query = useQuery(options);
  const applyDraftChange = (
    path: string,
    updatedAt: Date | null,
    draft: SiteDraftResult | null
  ) => {
    client.setQueryData(options.queryKey, (current) => {
      if (!current) {
        return current;
      }
      const others = current.drafts.filter((item) => item.path !== path);
      if (!updatedAt || !draft) {
        return { ...current, drafts: others };
      }
      const existing = current.drafts.find((item) => item.path === path);
      const source = current.files.find((item) => item.path === path);
      return {
        ...current,
        drafts: [
          ...others,
          {
            path,
            id: draft.draftId,
            revision: draft.draftRevision,
            deleted: false,
            baseBlobSha: existing?.baseBlobSha ?? source?.sha ?? null,
            updatedAt,
          },
        ],
      };
    });
    // The server stops listing uploads a saved config no longer references.
    const uploadsPending =
      path === SITE_CONFIG_FILENAME &&
      client
        .getQueryData(options.queryKey)
        ?.drafts.some((item) => isSiteImageDraftPath(item.path));
    void Promise.all([
      client.invalidateQueries({
        queryKey: dashboardOrpc.sites.editor.validate.key(),
      }),
      client.invalidateQueries({ queryKey: dashboardOrpc.sites.get.key() }),
      uploadsPending &&
        client.invalidateQueries({ queryKey: options.queryKey }),
    ]);
  };
  return { query, applyDraftChange };
}
