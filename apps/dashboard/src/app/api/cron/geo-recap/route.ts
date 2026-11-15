import { isDemoMode } from "@notra/utils/demo-mode";

import { isAuthorizedCron } from "@/lib/auth/cron";
import { runGeoRecapCron } from "@/lib/email/geo-recap";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (isDemoMode()) {
    return new Response(null, { status: 204 });
  }

  const result = await runGeoRecapCron();
  return Response.json(result, { status: result.failed > 0 ? 500 : 200 });
}
