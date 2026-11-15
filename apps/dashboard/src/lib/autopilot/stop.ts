import { db } from "@notra/db/drizzle";
import { autopilotRuns, autopilotSettings } from "@notra/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";

import { AUTOPILOT_RUN_STOPPED_MESSAGE } from "@/constants/autopilot";
import { AUTOPILOT_DAILY_WORKFLOW_KEY } from "@/constants/workflow-engine";
import { stopWorkflowRun } from "@/lib/workflow-engine/store";
import type { AutopilotStopRunInput } from "@/types/autopilot-runtime";

export async function stopAutopilotRun(params: AutopilotStopRunInput) {
  return await db.transaction(async (tx) => {
    const finishedAt = new Date();
    const [stopped] = await tx
      .update(autopilotRuns)
      .set({
        status: "stopped",
        finishedAt,
        errorMessage: AUTOPILOT_RUN_STOPPED_MESSAGE,
      })
      .where(
        and(
          eq(autopilotRuns.id, params.runId),
          eq(autopilotRuns.organizationId, params.organizationId),
          eq(autopilotRuns.status, "running"),
          isNotNull(autopilotRuns.workflowKey)
        )
      )
      .returning({ workflowKey: autopilotRuns.workflowKey });
    if (!stopped) {
      return false;
    }
    await stopWorkflowRun(tx, params.organizationId, params.runId);
    if (stopped.workflowKey === AUTOPILOT_DAILY_WORKFLOW_KEY) {
      await tx
        .update(autopilotSettings)
        .set({ lastRunAt: finishedAt })
        .where(eq(autopilotSettings.organizationId, params.organizationId));
    }
    return true;
  });
}
