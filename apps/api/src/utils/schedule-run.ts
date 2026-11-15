import { scheduleRunResponseSchema } from "@notra/schemas/api/schedule-run";

import { SCHEDULE_RUN_START_TIMEOUT_MS } from "../constants/schedule-run";
import {
  callDashboardInternal,
  getInternalWorkflowUrl,
} from "./internal-workflow";

/** Starts a schedule run through the dashboard, which owns the workflows. */
export async function startScheduleRun(
  env: { WORKFLOW_BASE_URL?: string },
  organizationId: string,
  scheduleId: string,
  actorId: string
) {
  const url = getInternalWorkflowUrl(
    env,
    "/api/internal/automation/schedule-run"
  );
  if (!url) {
    throw new Error("WORKFLOW_BASE_URL is not configured");
  }
  return await callDashboardInternal(
    url,
    { organizationId, scheduleId, actorId },
    scheduleRunResponseSchema,
    SCHEDULE_RUN_START_TIMEOUT_MS
  );
}
