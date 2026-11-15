import type { QueryClient } from "@tanstack/react-query";

export interface ContentDocumentSaveOptions {
  silent?: boolean;
  resolveConflict?: boolean;
  syncGitHub?: boolean;
}

export interface SaveContentDetailParams {
  organizationId: string;
  contentId: string;
  queryClient: QueryClient;
  expectedRevision: number;
  hasTitleChanges: boolean;
  hasSlugChanges: boolean;
  title: string;
  editingSlug: string | null;
  editedMarkdown: string | null;
  autosave?: boolean;
  onPersisted?: (document: SavedContentDocument) => void;
}

export interface SavedContentDocument {
  id: string;
  title: string;
  slug: string | null;
  markdown: string | null;
  content: string;
  revision: number;
  updatedAt: string;
}

export interface CheckpointContentDetailParams {
  organizationId: string;
  contentId: string;
  queryClient: QueryClient;
  manual?: boolean;
}

export interface ContentIdleCheckpointOptions {
  checkpoint: (revision: number) => Promise<boolean>;
  onError: (error: unknown) => void;
}
