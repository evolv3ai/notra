"use client";

import { Databuddy } from "@databuddy/sdk/react";
import { useConsent } from "c15t/tanstack-start";

import { DATABUDDY_DASHBOARD_WEBSITE_ID } from "@/constants/databuddy";
import {
  DATABUDDY_DASHBOARD_MASK_PATTERNS,
  normalizeDatabuddyEventPath,
} from "@/utils/databuddy";

export function DatabuddyAnalytics() {
  const measurementGranted = useConsent("measurement");

  if (!DATABUDDY_DASHBOARD_WEBSITE_ID) {
    return null;
  }

  return (
    <Databuddy
      clientId={DATABUDDY_DASHBOARD_WEBSITE_ID}
      disabled={!measurementGranted}
      filter={normalizeDatabuddyEventPath}
      maskPatterns={DATABUDDY_DASHBOARD_MASK_PATTERNS}
      trackAttributes={true}
      trackErrors={true}
      trackHashChanges={true}
    />
  );
}
