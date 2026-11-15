import { DELETED_ANALYTICS_PURGE_ROUTE_PATH } from "@notra/ai/constants/deleted-analytics-purge";
import { logError } from "@notra/ai/utils/server-log";
import { deletedAnalyticsPurgeSchema } from "@notra/schemas/dashboard/workflows/deleted-analytics-purge";
import { flattenError } from "zod";

import { runDeletedAnalyticsPurge } from "@/lib/analytics/deleted-analytics-purge";
import { verifyQstashSignature } from "@/lib/workflows/qstash-verify";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const verified = await verifyQstashSignature({
    request,
    rawBody,
    path: DELETED_ANALYTICS_PURGE_ROUTE_PATH,
  });
  if (!verified) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const parsed = deletedAnalyticsPurgeSchema.safeParse(body);
  if (!parsed.success) {
    logError("[Analytics Purge] Invalid payload", undefined, {
      issues: flattenError(parsed.error),
    });
    return new Response("Invalid payload", { status: 400 });
  }

  try {
    await runDeletedAnalyticsPurge(parsed.data, true);
  } catch (error) {
    logError("[Analytics Purge] Delayed purge failed", error, parsed.data);
    return new Response("Purge failed", { status: 500 });
  }
  return Response.json({ ok: true });
}
