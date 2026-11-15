import type { dashboardOrpc } from "@/lib/orpc/query";

export interface SiteDraftSaveState {
  status: "idle" | "dirty" | "saving" | "saved" | "error" | "discarding";
  error?: string;
}

export type SiteDraftInput = Parameters<
  typeof dashboardOrpc.sites.editor.saveDraft.call
>[0];
export type SiteDraftResult = Awaited<
  ReturnType<typeof dashboardOrpc.sites.editor.saveDraft.call>
>;

export type SiteDraftReference = Pick<
  SiteDraftInput,
  "draftId" | "draftRevision" | "sourceContext"
>;

export interface SiteDraftSaveSnapshot {
  content: string | null;
  state: SiteDraftSaveState;
  revision: number;
}

export interface SiteDraftSaveQueueOptions {
  save: (input: SiteDraftInput) => Promise<SiteDraftResult>;
  discard: (input: SiteDraftReference) => Promise<void>;
  onSaved: (input: SiteDraftInput, result: SiteDraftResult) => void;
  onDiscarded: () => Promise<void>;
  onStateChange: (state: SiteDraftSaveState) => void;
  errorMessage: (error: unknown) => string;
}

export interface SiteDraftSaveQueue {
  replaceClean: () => boolean;
  getSnapshot: () => SiteDraftSaveSnapshot;
  subscribe: (listener: () => void) => () => void;
  edit: (input: SiteDraftInput) => void;
  flush: () => Promise<void>;
  discard: (input: SiteDraftReference) => Promise<void>;
}
export type SiteDraftChange = "added" | "modified" | "deleted";
export interface SiteDiffLineCounts {
  additions: number;
  deletions: number;
}
