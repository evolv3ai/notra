import { logError } from "@notra/ai/utils/server-log";
import { freeScanAdminRunInputSchema } from "@notra/schemas/api/free-scan-admin";
import { Effect } from "effect";

import { geoCoreDashboardLayer } from "@/lib/geo/configure";
import { startAdminFreeGeoScan } from "@/lib/geo/free-scan";
import { verifyInternalWorkflowRequest } from "@/lib/workflows/internal-auth";

export async function POST(request: Request) {
  if (!(await verifyInternalWorkflowRequest(request))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const parsed = freeScanAdminRunInputSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
  const outcome = await Effect.runPromise(
    Effect.result(
      startAdminFreeGeoScan(parsed.data.domain).pipe(
        Effect.provide(geoCoreDashboardLayer)
      )
    )
  );
  if (outcome._tag === "Failure") {
    logError("[GEO] Admin free scan failed", outcome.failure, {
      domain: parsed.data.domain,
    });
    return Response.json(
      { error: "Could not start the free scan" },
      { status: 500 }
    );
  }
  return Response.json(outcome.success);
}
