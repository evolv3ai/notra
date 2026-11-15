/** Every workspace's memory is one repository on code.storage. */
export const MEMORY_REPO_PREFIX = "notra-memory-";
export const MEMORY_BRANCH = "main";

export const MEMORY_AUTHOR = {
  name: "Notra",
  email: "memory@usenotra.com",
} as const;

/** The first commit of every memory repo, so later writes have a parent to check. */
export const MEMORY_SEED = {
  path: "README.md",
  message: "Create workspace memory",
  content:
    "# Notra workspace memory\n\nrules.md and feedback.md are written by people, planner.md by Autopilot, knowledge/ by onboarding.\n",
} as const;

/**
 * Concurrent writers re-read and re-apply their change this many times,
 * waiting a random share of a growing delay so they stop colliding.
 */
export const MEMORY_COMMIT_ATTEMPTS = 8;
export const MEMORY_CONFLICT_BACKOFF_MS = 100;

/**
 * Files every Autopilot run loads into its prompt. Past the soft limit the
 * writer is told to compact; past the hard limit the write is refused.
 */
export const MEMORY_PRELOADED_SOFT_LIMIT_BYTES = 8 * 1024;
export const MEMORY_PRELOADED_HARD_LIMIT_BYTES = 16 * 1024;
/** Files only read on demand (knowledge). */
export const MEMORY_ON_DEMAND_LIMIT_BYTES = 64 * 1024;

export const MEMORY_PATHS = {
  rules: "rules.md",
  feedback: "feedback.md",
  planner: "planner.md",
  knowledge: (slug: string) => `knowledge/${slug}.md`,
} as const;

export const MEMORY_PRELOADED_PATTERN = /^(?:rules|feedback|planner)\.md$/;
export const MEMORY_SAFE_PATH =
  /^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9_.-]*)*\.md$/;
/** Organization ids become repo names, so anything outside this set is replaced. */
export const MEMORY_REPO_UNSAFE_CHARS = /[^a-zA-Z0-9_-]/g;
export const MEMORY_REPO_HASH_LENGTH = 12;
export const MEMORY_REPO_NOT_FOUND = /^Repository not found$/i;
export const MEMORY_RECORD_META_LINE = /^<!--\s*notra\s+(\{.*\})\s*-->$/;
export const MEMORY_RECORD_SECTION = /^## (.+)$/;
