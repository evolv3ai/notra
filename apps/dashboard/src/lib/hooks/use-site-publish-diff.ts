import {
  isSiteImageDraftPath,
  siteImageMimeType,
  sitePublicAssetPath,
} from "@notra/sites-core/utils/image-drafts";
import { parseDiffFromFile } from "@pierre/diffs";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useSite } from "@/components/sites/site-context";
import { useSiteCodeHighlighter } from "@/lib/hooks/use-site-code-highlighter";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { SitePublishChangeProps } from "@/types/components/site-publish";
import { siteAssetUrl } from "@/utils/site-design";
import { diffLineCounts } from "@/utils/site-drafts";
export function useSitePublishDiff({
  organizationId,
  siteId,
  branch,
  path,
  change,
}: SitePublishChangeProps) {
  const readQuery = useQuery(
    dashboardOrpc.sites.editor.read.queryOptions({
      input: { organizationId, siteId, branch, path },
      refetchOnWindowFocus: false,
    })
  );
  const highlighterReady = useSiteCodeHighlighter();
  const document = readQuery.data ?? null;
  const before = change === "added" ? null : (document?.published ?? null);
  const after = change === "deleted" ? null : (document?.content ?? null);
  const binary = isSiteImageDraftPath(path);
  const { detail } = useSite();
  let image: string | null = null;
  if (binary && after) {
    image = `data:${siteImageMimeType(path)};base64,${after}`;
  } else if (binary && change === "deleted") {
    // Published images aren't downloaded; show what the live site serves.
    image = siteAssetUrl(detail.site.liveUrl, sitePublicAssetPath(path));
  }
  const fileDiff = useMemo(() => {
    if (!document || binary) {
      return null;
    }
    return parseDiffFromFile(
      before === null ? null : { name: path, contents: before },
      after === null ? null : { name: path, contents: after }
    );
  }, [document, binary, before, after, path]);
  const counts = fileDiff ? diffLineCounts(fileDiff) : null;

  return { readQuery, highlighterReady, fileDiff, counts, binary, image };
}
