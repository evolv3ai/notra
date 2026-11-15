import { evaluateGeoAlerts } from "@/lib/automation/geo-alerts";
import type { GeoAlertScanContext } from "@/types/automation/geo-alerts";

export async function evaluateGeoAlertsStep(
  context: GeoAlertScanContext
): Promise<{ fired: number }> {
  "use step";
  return await evaluateGeoAlerts(context);
}

// A retry would ping Slack twice; a failed evaluation is logged instead.
evaluateGeoAlertsStep.maxRetries = 0;
