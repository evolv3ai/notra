import type { GeoAlertActions } from "@notra/schemas/dashboard/automation/geo-alerts";

import type { GeoAlertDestinations } from "@/types/automation/geo-alerts";

/** Keep user choices intact while availability loads or changes. */
export function resolveGeoAlertFormActions(
  selection: Partial<GeoAlertActions>,
  destinations?: GeoAlertDestinations
): GeoAlertActions {
  return {
    slack: (selection.slack ?? true) && !!destinations?.slackConnected,
    email: selection.email ?? true,
    webhook:
      (selection.webhook ?? false) && !!destinations?.webhookEndpointCount,
  };
}
