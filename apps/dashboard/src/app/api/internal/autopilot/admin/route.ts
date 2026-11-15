import { logError } from "@notra/ai/utils/server-log";
import { autopilotAdminRequestSchema } from "@notra/schemas/api/autopilot-admin";

import {
  listAdminFindings,
  listAdminRuns,
  loadAdminTrace,
} from "@/lib/autopilot/admin";
import { verifyInternalWorkflowRequest } from "@/lib/workflows/internal-auth";

/**
 * Autopilot decision traces for the Notra admin console: every run, every
 * filter drop, every Jev and model call with its input and output. Workspace
 * members only ever see the summarized events; the console is the only reader
 * of the internal ones. The caller is a verified Notra admin.
 */
export async function POST(request: Request) {
  if (!(await verifyInternalWorkflowRequest(request))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const parsed = autopilotAdminRequestSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
  const input = parsed.data;
  try {
    switch (input.action) {
      case "runs":
        return Response.json({ runs: await listAdminRuns(input) });
      case "trace": {
        const trace = await loadAdminTrace(input.runId, input.includeDetail);
        return trace
          ? Response.json(trace)
          : Response.json({ error: "Run not found" }, { status: 404 });
      }
      case "findings":
        return Response.json({
          findings: await listAdminFindings(input.organizationId),
        });
      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    logError("Autopilot admin request failed", error, {
      action: input.action,
    });
    return Response.json(
      { error: "Autopilot admin request failed" },
      { status: 500 }
    );
  }
}
