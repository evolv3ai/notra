import { logError } from "@notra/ai/utils/server-log";
import { scheduleRunRequestSchema } from "@notra/schemas/api/schedule-run";

import {
  ManualTriggerRunError,
  triggerManualAutomationRun,
} from "@/lib/triggers/manual-run";
import { verifyInternalWorkflowRequest } from "@/lib/workflows/internal-auth";

export async function POST(request: Request) {
  if (!(await verifyInternalWorkflowRequest(request))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const parsed = scheduleRunRequestSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { organizationId, scheduleId, actorId } = parsed.data;
  try {
    const { runId, workflowRunId } = await triggerManualAutomationRun({
      organizationId,
      triggerId: scheduleId,
      triggeredBy: actorId,
    });
    return Response.json({ runId, workflowRunId });
  } catch (error) {
    if (error instanceof ManualTriggerRunError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    logError("Failed to start a schedule run from the API", error, {
      scheduleId,
    });
    return Response.json(
      { error: "Failed to start the schedule run" },
      { status: 502 }
    );
  }
}
