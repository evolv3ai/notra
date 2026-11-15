import { track } from "@databuddy/sdk";

import { ONBOARDING_FLOW_VARIANTS } from "@/constants/analytics-events";
import type { PendingFunnelEvent } from "@/types/analytics/events";

let onboardingVariant: string = ONBOARDING_FLOW_VARIANTS.CONTROL;
let identityReady = false;
const pendingEvents: PendingFunnelEvent[] = [];

export function setOnboardingVariant(variant: string): void {
  onboardingVariant = variant;
}

export function markFunnelIdentityReady(): void {
  identityReady = true;
  for (const { event, properties } of pendingEvents.splice(0)) {
    track(event, properties);
  }
}

export function trackOnboardingFunnelEvent(
  event: string,
  properties?: Record<string, unknown>
): void {
  const payload = { ...properties, onboarding_variant: onboardingVariant };
  if (identityReady) {
    track(event, payload);
    return;
  }
  pendingEvents.push({ event, properties: payload });
}
