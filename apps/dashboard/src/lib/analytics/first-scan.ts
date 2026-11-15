import { track } from "@databuddy/sdk";

import { DATABUDDY_FUNNEL_EVENT_NAMES } from "@/constants/databuddy";

const completedScopes = new Set<string>();

export function trackFirstScanStarted(trigger: string | undefined): void {
  track(DATABUDDY_FUNNEL_EVENT_NAMES.FIRST_SCAN_STARTED, {
    trigger: trigger ?? null,
  });
}

export function trackFirstScanCompleted(scope: string): void {
  if (completedScopes.has(scope)) {
    return;
  }
  completedScopes.add(scope);
  track(DATABUDDY_FUNNEL_EVENT_NAMES.FIRST_SCAN_COMPLETED);
}
