"use client";

import { identify, setGlobalProperties, track } from "@databuddy/sdk";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { useConsent } from "c15t/tanstack-start";
import { useEffect } from "react";

import { FIRST_LOGIN_WINDOW_MS } from "@/constants/analytics-events";
import { markFunnelIdentityReady } from "@/lib/analytics/onboarding-funnel";
import { authClient } from "@/lib/auth/client";
import { useBillingCustomer } from "@/lib/hooks/use-billing-customer";
import { findActivePlanSubscription, planTierId } from "@/utils/billing-plans";
import {
  persistMarketingAttribution,
  readMarketingAttributionFromStorage,
} from "@/utils/marketing-attribution";

export function DatabuddyIdentity() {
  const { data: session, isPending } = authClient.useSession();
  const { data: customer, isLoading: customerLoading } = useBillingCustomer();
  const measurementGranted = useConsent("measurement");
  const userId = session?.user.id;
  const createdAt = session?.user.createdAt;
  const plan = customerLoading
    ? undefined
    : (planTierId(
        findActivePlanSubscription(customer?.subscriptions)?.planId
      ) ?? "free");

  useEffect(() => {
    if (isPending) {
      return;
    }
    if (!(measurementGranted && userId && createdAt)) {
      markFunnelIdentityReady();
      return;
    }
    const attribution = readMarketingAttributionFromStorage();
    const variant = attribution.landingPageH1Variant;
    const signedUpAt = new Date(createdAt);
    if (variant) {
      setGlobalProperties({ landing_experiment_variant: variant });
    }
    identify(userId, {
      signed_up_at: signedUpAt.toISOString(),
      ...(variant ? { landing_experiment_variant: variant } : {}),
      ...(plan ? { plan } : {}),
    });
    if (
      attribution.signupCompletedUserId !== userId &&
      Date.now() - signedUpAt.getTime() < FIRST_LOGIN_WINDOW_MS
    ) {
      persistMarketingAttribution({ signupCompletedUserId: userId });
      track(POSTHOG_EVENTS.SIGNUP_COMPLETED, {
        method: attribution.signupMethod ?? "unknown",
        landing_experiment_variant: variant ?? null,
      });
    }
    markFunnelIdentityReady();
  }, [createdAt, isPending, measurementGranted, plan, userId]);

  return null;
}
