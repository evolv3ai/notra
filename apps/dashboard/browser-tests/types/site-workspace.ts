import type {
  SiteEditorDocument,
  SiteEditorFiles,
} from "../../src/types/sites";

export interface WorkspaceFixtureRecord {
  document: SiteEditorDocument;
  files: SiteEditorFiles;
}

export interface WorkspaceFixtureBlocker {
  disabled: boolean;
  shouldBlockFn: (args: {
    next: { pathname: string; search: Record<string, unknown> };
  }) => Promise<boolean>;
}
