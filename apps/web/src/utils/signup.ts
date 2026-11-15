import { flush, track } from "@databuddy/sdk/react";

import { AUTH_SIGNUP_URL } from "@/constants/auth";
import type { BillingPeriod } from "@/types/landing/pricing";
import { withAppTracking } from "@/utils/app-tracking";
import {
  DATABUDDY_SIGNUP_STARTED_EVENT,
  LANDING_EXPERIMENT_VARIANT_STORAGE_KEY,
  serializeSignupAttribution,
} from "@/utils/databuddy";

export function trackedSignupHref(
  source: string,
  href = AUTH_SIGNUP_URL
): string {
  return serializeSignupAttribution(new URL(href, AUTH_SIGNUP_URL), {
    source,
  });
}

export function rememberLandingExperimentVariant(variant: string): void {
  try {
    window.sessionStorage.setItem(
      LANDING_EXPERIMENT_VARIANT_STORAGE_KEY,
      variant
    );
  } catch {
    return;
  }
}

function readLandingExperimentVariant(): string | null {
  try {
    return window.sessionStorage.getItem(
      LANDING_EXPERIMENT_VARIANT_STORAGE_KEY
    );
  } catch {
    return null;
  }
}

export function signupDestination(
  source: string,
  href = AUTH_SIGNUP_URL
): string {
  return withAppTracking(
    serializeSignupAttribution(new URL(href, AUTH_SIGNUP_URL), {
      source,
      variant: readLandingExperimentVariant(),
    })
  );
}

export function trackSignupStarted(
  source: string,
  href = AUTH_SIGNUP_URL
): string {
  const variant = readLandingExperimentVariant();
  const destination = signupDestination(source, href);
  track(DATABUDDY_SIGNUP_STARTED_EVENT, {
    destination,
    source,
    variant,
  });
  flush();
  return destination;
}

export function startSignup(source: string, href = AUTH_SIGNUP_URL): void {
  window.location.assign(trackSignupStarted(source, href));
}

export function pricingPlanHref(
  href: string,
  planId: string,
  billingPeriod: BillingPeriod
): string {
  const url = new URL(href, AUTH_SIGNUP_URL);
  url.searchParams.set(
    "plan",
    billingPeriod === "yearly" ? `${planId}_annual` : planId
  );
  return url.toString();
}
