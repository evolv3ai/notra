export const AUTOMATION_RUN_STATUSES = [
  "running",
  "success",
  "failed",
  "skipped",
] as const;

/** A run still `running` after this long stopped without reporting back. */
export const AUTOMATION_RUN_STALE_AFTER_MS = 6 * 60 * 60 * 1000;
export const AUTOMATION_RUN_STALE_MESSAGE =
  "The run stopped without reporting a result";
