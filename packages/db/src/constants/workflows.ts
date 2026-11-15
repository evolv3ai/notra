export const WORKFLOW_RUN_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
  "stopped",
] as const;

export const WORKFLOW_RUN_NODE_STATUSES = [
  "running",
  "retrying",
  "success",
  "halted",
  "error",
  "skipped",
] as const;

export const WORKFLOW_RUN_STEP_STATUSES = [
  "running",
  "retrying",
  "success",
  "halted",
  "error",
] as const;
