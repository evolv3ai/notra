import { isAuthorizedCron } from "@/lib/auth/cron";
import { refreshDueGeoContentGaps } from "@/lib/geo/content-gaps-refresh";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await refreshDueGeoContentGaps();
  return Response.json(result, { status: result.failed > 0 ? 500 : 200 });
}
