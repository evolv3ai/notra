import type { ContentHistoryEntry } from "@notra/schemas/types/dashboard/content-history";
import type { MutableRefObject } from "react";

import type { useContentHistory } from "@/lib/hooks/use-content-history";
import type { ContentDetailToolbarProps } from "@/types/components/content-detail-toolbar";

type ContentDocumentProps = Pick<
  ContentDetailToolbarProps,
  "content" | "contentId" | "document" | "organizationId"
>;

export type ContentCollaborationProps = ContentDocumentProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Restore recovery state; owned by the dialog so closing History keeps the retry. */
interface ContentHistoryRecovery {
  restoredRevision: MutableRefObject<number | null>;
  needsRefresh: boolean;
  setNeedsRefresh: (needsRefresh: boolean) => void;
}

export type ContentHistoryProps = ContentDocumentProps & {
  recovery: ContentHistoryRecovery;
  onRestoreBusyChange: (busy: boolean) => void;
  active?: boolean;
};

export type ContentHistoryListProps = Pick<
  ReturnType<typeof useContentHistory>,
  "history" | "versionId" | "setVersionId" | "restore" | "needsRefresh"
> & {
  currentRevision: number;
  currentTitle: string;
};

export type ContentSaveConflictProps = Pick<ContentDocumentProps, "document">;

export type ContentHistoryComparisonProps = Pick<
  ReturnType<typeof useContentHistory>,
  "restore" | "canRestore"
> & {
  version: NonNullable<
    ReturnType<typeof useContentHistory>["selected"]["data"]
  >["version"];
  versionNumber: number | undefined;
  fetching: boolean;
  highlighterReady: boolean;
  currentRevision: number;
  currentMarkdown: string;
  hasUnsavedWork: boolean;
  onConfirmRestore: () => void;
};

export type ContentSaveConflictResolution = "saveMine" | "loadLatest";

export interface ContentHistoryDay {
  key: string;
  date: Date;
  daysAgo: number;
  items: ContentHistoryEntry[];
}
