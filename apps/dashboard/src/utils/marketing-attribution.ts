import { parseAsString, parseAsStringLiteral } from "nuqs";

import { sessionStorageKeys } from "@/constants/storage";
const MARKETING_ATTRIBUTION_STORAGE_KEY =
  sessionStorageKeys.marketingAttribution;

export const marketingAttributionSearchParams = {
  dbLandingPageH1Copy: parseAsString,
  dbLandingPageH1Variant: parseAsString,
  dbSource: parseAsString,
  signupMethod: parseAsStringLiteral(["email", "google", "github"]),
};

export interface MarketingAttribution {
  source?: string;
  landingPageH1Variant?: string;
  landingPageH1Copy?: string;
  signupMethod?: "email" | "google" | "github";
  signupCompletedUserId?: string;
  anonId?: string;
  sessionId?: string;
}

interface MarketingAttributionValues {
  source?: string | null;
  landingPageH1Variant?: string | null;
  landingPageH1Copy?: string | null;
  signupMethod?: string | null;
}

export function readMarketingAttributionFromValues(
  values: MarketingAttributionValues
): MarketingAttribution {
  return {
    source: values.source ?? undefined,
    landingPageH1Variant: values.landingPageH1Variant ?? undefined,
    landingPageH1Copy: values.landingPageH1Copy ?? undefined,
    signupMethod: normalizeSignupMethod(values.signupMethod ?? undefined),
  };
}

export function readMarketingAttributionFromStorage(): MarketingAttribution {
  if (typeof window === "undefined") {
    return {};
  }

  const raw = window.sessionStorage.getItem(MARKETING_ATTRIBUTION_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as MarketingAttribution;

    return {
      source: parsed.source,
      landingPageH1Variant: parsed.landingPageH1Variant,
      landingPageH1Copy: parsed.landingPageH1Copy,
      signupMethod: normalizeSignupMethod(parsed.signupMethod),
      signupCompletedUserId: parsed.signupCompletedUserId,
      anonId: parsed.anonId,
      sessionId: parsed.sessionId,
    };
  } catch {
    return {};
  }
}

export function persistMarketingAttribution(
  updates: MarketingAttribution
): MarketingAttribution {
  if (typeof window === "undefined") {
    return updates;
  }

  const stored = readMarketingAttributionFromStorage();
  const searchParams = new URLSearchParams(window.location.search);
  const nextValue = {
    ...stored,
    anonId: searchParams.get("anonId") ?? stored.anonId,
    sessionId: searchParams.get("sessionId") ?? stored.sessionId,
    ...updates,
  };

  window.sessionStorage.setItem(
    MARKETING_ATTRIBUTION_STORAGE_KEY,
    JSON.stringify(nextValue)
  );

  return nextValue;
}

function normalizeSignupMethod(
  value?: string
): MarketingAttribution["signupMethod"] {
  if (value === "email" || value === "google" || value === "github") {
    return value;
  }

  return undefined;
}
