/**
 * Who writes. Autonomous runs may only touch their own notes; rules and
 * feedback change only when a person explicitly asks.
 */
export type MemoryActor = "autopilot-run" | "user" | "knowledge";

export interface MemoryCommitInput {
  expectedHeadSha: string | null;
  message: string;
  /** null deletes the path. */
  files: Record<string, string | null>;
  author?: { name: string; email: string };
}

export interface MemoryCommitInfo {
  sha: string;
  message: string;
  authorName: string;
  date: string;
}

/** The storage seam: code.storage in production, a map in tests and evals. */
export interface MemoryStore {
  /** null when the workspace has no memory yet. */
  head(organizationId: string): Promise<string | null>;
  read(
    organizationId: string,
    path: string,
    ref: string
  ): Promise<string | null>;
  list(organizationId: string, ref: string): Promise<string[]>;
  /** Throws MemoryConflictError when the head moved since expectedHeadSha. */
  commit(organizationId: string, input: MemoryCommitInput): Promise<string>;
  /** Idempotent; rejects with the signal's reason once it aborts. */
  deleteRepo(organizationId: string, signal?: AbortSignal): Promise<void>;
}

/** Reads pinned to one commit, so a run never mixes two versions. */
export interface MemorySnapshot {
  readonly sha: string | null;
  read(path: string): Promise<string | null>;
  list(): Promise<string[]>;
}

export type MemoryChanges = Record<string, string | null>;

export interface MemoryUpdateResult {
  sha: string | null;
  changed: boolean;
  /** Preloaded files over the soft limit; the next writer should compact them. */
  overSoftLimit: string[];
}

export interface InMemoryCommit extends MemoryCommitInfo {
  files: Map<string, string>;
}
