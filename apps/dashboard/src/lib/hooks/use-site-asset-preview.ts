import {
  isSiteImageDraftPath,
  siteImageMimeType,
} from "@notra/sites-core/utils/image-drafts";
import { useQuery } from "@tanstack/react-query";

import { useSite } from "@/components/sites/site-context";
import { useSiteWorkspace } from "@/components/sites/site-workspace-context";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { SiteImageUploadPreview } from "@/types/site-design";
import { siteAssetUrl } from "@/utils/site-design";

/**
 * Image URL for a config path. A file this field just uploaded shows from
 * memory, other unpublished uploads from their draft, the rest from the site.
 */
export function useSiteAssetPreview(
  value: string,
  uploaded: SiteImageUploadPreview | null
): string | null {
  const { organizationId, siteId, detail } = useSite();
  const workspace = useSiteWorkspace();
  const local = uploaded?.path === value.trim() ? uploaded.url : null;
  const path = `public/${value.trim().replace(/^\//, "")}`;
  const pending =
    !local &&
    isSiteImageDraftPath(path) &&
    Boolean(
      workspace?.files.drafts.some(
        (item) => item.path === path && !item.deleted
      )
    );
  const read = useQuery(
    dashboardOrpc.sites.editor.read.queryOptions({
      input: { organizationId, siteId, branch: workspace?.scope.branch, path },
      enabled: pending,
      staleTime: Number.POSITIVE_INFINITY,
    })
  );
  if (local) {
    return local;
  }
  if (pending) {
    return read.data?.content
      ? `data:${siteImageMimeType(path)};base64,${read.data.content}`
      : null;
  }
  return siteAssetUrl(detail.site.liveUrl, value);
}
