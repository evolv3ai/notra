export type MutationSuite = "unit" | "lifecycle" | "browser";

// One deliberate product bug. `find` must occur exactly once in `file`; the
// suites listed must turn red, and `caughtBy` names where (a lifecycle step
// or the browser check that fails).
export interface Mutation {
  id: string;
  bug: string;
  file: string;
  find: string;
  replace: string;
  suites: MutationSuite[];
  caughtBy: string;
}

export interface MutationOutcome {
  id: string;
  bug: string;
  suite: MutationSuite;
  caught: boolean;
  /** Lifecycle step or last passed browser check before the failure. */
  where: string | null;
  error: string | null;
  durationMs: number;
}
