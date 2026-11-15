import { isDemoMode } from "@notra/utils/demo-mode";

import { isAuthorizedCron } from "@/lib/auth/cron";
import { sweepSiteJobs } from "@/lib/sites/dispatch";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (isDemoMode()) {
    return new Response(null, { status: 204 });
  }
  return Response.json(await sweepSiteJobs());
}
