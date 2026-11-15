import { isAuthorizedCron } from "@/lib/auth/cron";
import { runScheduledPublicationSweep } from "@/lib/content/scheduled-publication-sweep";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await runScheduledPublicationSweep();
  if (result.claimed > 0) {
    console.info("[ScheduledPublication] Sweep", result);
  }
  return Response.json(result);
}
