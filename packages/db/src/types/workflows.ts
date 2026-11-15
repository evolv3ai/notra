import type { WORKFLOW_RUN_STEP_STATUSES } from "../constants/workflows";

export interface WorkflowRunNodeStep {
  index: number;
  status: (typeof WORKFLOW_RUN_STEP_STATUSES)[number];
  attempts: number;
  startedAt: string;
  finishedAt?: string | null;
  error?: string | null;
}
