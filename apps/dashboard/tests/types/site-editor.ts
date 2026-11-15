import type { useSiteDraftSaves } from "../../src/lib/hooks/use-site-draft-saves";

export interface SiteEditorQueueHarnessProps {
  onReady: (saves: ReturnType<typeof useSiteDraftSaves>) => void;
}

export interface DefaultEditorDraft {
  path: string;
  content: string;
  deleted: boolean;
  baseBlobSha: string | null;
  baseCommitSha: string | null;
  updatedAt: Date;
}

export interface DefaultEditorSaveDraftInput {
  content: string;
  baseBlobSha: string | null;
  baseCommitSha: string | null;
}
