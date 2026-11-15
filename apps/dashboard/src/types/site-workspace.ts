import type { ReactNode } from "react";

import type { useSiteWorkspaceState } from "@/lib/hooks/use-site-workspace-state";
import type { SiteEditorDocument, SiteEditorFiles } from "@/types/sites";

export type SiteWorkspaceValue = ReturnType<typeof useSiteWorkspaceState>;
export interface SiteWorkspaceLoadState {
  failed: boolean;
  retrying: boolean;
  retry: () => void;
}
export interface SiteWorkspaceProps {
  children: ReactNode;
}
export interface SiteWorkspaceReadyProps extends SiteWorkspaceProps {
  comparisonContent?: string;
  document: SiteEditorDocument;
  files: SiteEditorFiles;
  refreshing?: boolean;
  branch?: string;
  onSwitch: (branch: string | null) => Promise<void>;
  onRefresh: () => Promise<{
    document: SiteEditorDocument;
    files: SiteEditorFiles;
  }>;
  onDraftChange: Parameters<
    typeof import("@/lib/hooks/use-site-draft-saves").useSiteDraftSaves
  >[1];
}
