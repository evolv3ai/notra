"use client";

import { useState } from "react";

import type { ContentDetailDocument } from "@/lib/hooks/use-content-detail-document";
import type { ContentDocumentTab } from "@/types/content/detail";

/**
 * Post / Outline tab for GEO writer posts. The outline only exists once the
 * article is written; an agent edit switches back to Post so its diff shows.
 */
export function useContentDocumentTab(document: ContentDetailDocument) {
  const outline =
    document.geoWriterDraft &&
    !document.isGeoWriterPlanMode &&
    !document.isGeoArticleLoading
      ? document.geoWriterBriefQuery.data?.brief
      : undefined;
  const [tab, setTab] = useState<ContentDocumentTab>("post");
  const [seenWriteNonce, setSeenWriteNonce] = useState(
    document.writeFocusNonce
  );
  if (document.writeFocusNonce !== seenWriteNonce) {
    setSeenWriteNonce(document.writeFocusNonce);
    setTab("post");
  }
  return {
    outline,
    tab,
    setTab,
    visibleOutline: tab === "outline" ? outline : undefined,
  };
}
