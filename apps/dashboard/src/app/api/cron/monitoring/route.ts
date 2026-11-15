import { flushLogs } from "@notra/ai/evlog";
import { getEvlogRuntime } from "@notra/ai/utils/evlog-runtime";
import { sweepOgDesignCosts } from "@notra/ai/utils/og-design-store";
import { isDemoMode } from "@notra/utils/demo-mode";
import { Effect, Result } from "effect";

import { checkMissedGeoScans } from "@/lib/analytics/geo-scan-watchdog";
import { runMonitoringSweep } from "@/lib/analytics/monitoring-sweep";
import { isAuthorizedCron } from "@/lib/auth/cron";
import { scheduleRequestErrorTelemetry } from "@/utils/request-error-telemetry";
import { retryWorkflowFailureAlerts } from "@/utils/workflow-failure-alert";
import { logWorkflowTelemetry } from "@/utils/workflow-telemetry";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (isDemoMode()) {
    return new Response(null, { status: 204 });
  }
  try {
    await checkMissedGeoScans();
  } catch (error) {
    logWorkflowTelemetry({
      event: "geo.scan.watchdog.failed",
      outcome: "error",
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
  try {
    await retryWorkflowFailureAlerts();
  } catch (error) {
    logWorkflowTelemetry({
      event: "workflow.alert.failed",
      outcome: "error",
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
  const telemetry = getEvlogRuntime();
  try {
    await Effect.runPromise(sweepOgDesignCosts());
  } catch (error) {
    logWorkflowTelemetry({
      event: "monitoring.operation.failed",
      operation: "og.cost.sweep",
      outcome: "error",
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
  if (!telemetry.aiDrain) {
    scheduleRequestErrorTelemetry(flushLogs);
    return Response.json({ skipped: "telemetry_not_configured" });
  }
  const sweepId = crypto.randomUUID();
  try {
    const result = await Effect.runPromise(
      runMonitoringSweep(sweepId).pipe(Effect.result)
    );
    if (Result.isFailure(result)) {
      logWorkflowTelemetry({
        event: "monitoring.sweep.completed",
        sweepId,
        outcome: "error",
        errors: 1,
        operation: result.failure.operation,
        errorName: result.failure.errorName,
      });
      return Response.json(
        { error: "Monitoring sweep failed" },
        { status: 500 }
      );
    }
    return Response.json(result.success);
  } catch (error) {
    logWorkflowTelemetry({
      event: "monitoring.sweep.completed",
      sweepId,
      outcome: "error",
      errors: 1,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json({ error: "Monitoring sweep failed" }, { status: 500 });
  } finally {
    scheduleRequestErrorTelemetry(flushLogs);
  }
}
