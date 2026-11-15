"use client";

import { useFlag } from "@databuddy/sdk/react";

import {
  PAYWALL_EXPERIMENT_CONTROL_VARIANT,
  PAYWALL_EXPERIMENT_FLAG_KEY,
} from "@/constants/analytics-events";

export function usePaywallVariant() {
  const flag = useFlag(PAYWALL_EXPERIMENT_FLAG_KEY);
  return {
    loading: flag.loading,
    variant: flag.loading
      ? null
      : (flag.variant ?? PAYWALL_EXPERIMENT_CONTROL_VARIANT),
  };
}
