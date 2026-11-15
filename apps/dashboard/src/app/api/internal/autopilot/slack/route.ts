import { autopilotSlackActionRequestSchema } from "@notra/ai/schemas/autopilot-slack-action";
import { logError } from "@notra/ai/utils/server-log";

import { handleAutopilotSlackAction } from "@/lib/autopilot/slack-actions";
import { verifyInternalWorkflowRequest } from "@/lib/workflows/internal-auth";

/**
 * 👍/👎 reactions on Autopilot's Slack messages, forwarded
 * by the agent, which receives Slack's events. Anyone in the Autopilot
 * channel may act; the channel is the access boundary.
 */
export async function POST(request: Request) {
  if (!(await verifyInternalWorkflowRequest(request))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const parsed = autopilotSlackActionRequestSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
  try {
    await handleAutopilotSlackAction(parsed.data);
    return Response.json({ ok: true });
  } catch (error) {
    logError("Autopilot Slack action failed", error, {
      vote: parsed.data.vote,
    });
    return Response.json(
      { error: "Autopilot Slack action failed" },
      { status: 500 }
    );
  }
}
