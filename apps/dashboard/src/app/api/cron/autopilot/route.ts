import { isAuthorizedCron } from "@/lib/auth/cron";
import { cleanupAutopilotNamespaces } from "@/lib/autopilot/namespace-deletions";
import { runDueAutopilots } from "@/lib/autopilot/schedule";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [cleanup, result] = await Promise.all([
    cleanupAutopilotNamespaces(),
    runDueAutopilots(),
  ]);
  return Response.json(
    { ...result, cleanup },
    {
      status: result.failed > 0 || cleanup.failed > 0 ? 500 : 200,
    }
  );
}
