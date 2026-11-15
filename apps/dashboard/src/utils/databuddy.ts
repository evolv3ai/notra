import { getTrackingIds } from "@databuddy/sdk";

import { DATABUDDY_DASHBOARD_WEBSITE_ID } from "@/constants/databuddy";
import { stripeMetadataValueSchema } from "@/schemas/stripe-metadata";
import { readMarketingAttributionFromStorage } from "@/utils/marketing-attribution";
import {
  getFirstPathSegment,
  maskOrganizationPathname,
  shouldMaskOrganizationPathname,
} from "@/utils/organization-pathname";

export const DATABUDDY_DASHBOARD_MASK_PATTERNS = ["/*"];

const ABSOLUTE_URL_REGEX = /^[a-z][a-z\d+.-]*:\/\//i;

const DATABUDDY_MASKED_SEGMENT = "*";

interface DatabuddyFilterEvent {
  path?: unknown;
}

function formatUrl(url: URL, absolute: boolean): string {
  if (absolute) {
    return url.toString();
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

function normalizeDatabuddyPath(path: string): string {
  const absolutePath = ABSOLUTE_URL_REGEX.test(path);
  const currentUrl =
    typeof window === "undefined" ? undefined : new URL(window.location.href);
  const url = new URL(path, currentUrl?.origin ?? "https://app.usenotra.com");

  if (
    getFirstPathSegment(url.pathname) === DATABUDDY_MASKED_SEGMENT &&
    currentUrl
  ) {
    return shouldMaskOrganizationPathname(currentUrl.pathname)
      ? formatUrl(url, absolutePath)
      : formatUrl(currentUrl, absolutePath);
  }

  url.pathname = maskOrganizationPathname(
    url.pathname,
    DATABUDDY_MASKED_SEGMENT
  );
  return formatUrl(url, absolutePath);
}

export function normalizeDatabuddyEventPath(event: DatabuddyFilterEvent) {
  if (typeof event.path !== "string") {
    return true;
  }

  event.path = normalizeDatabuddyPath(event.path);
  return true;
}

export function getDatabuddyPaymentMetadata(): Record<string, string> {
  const stored = readMarketingAttributionFromStorage();
  const tracked = getTrackingIds(new URLSearchParams(window.location.search));
  const values = {
    databuddy_client_id: DATABUDDY_DASHBOARD_WEBSITE_ID,
    databuddy_session_id: stored.sessionId ?? tracked.sessionId,
    databuddy_anonymous_id: stored.anonId ?? tracked.anonId,
    landing_experiment_variant: stored.landingPageH1Variant,
  };
  const metadata: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    const parsed = stripeMetadataValueSchema.safeParse(value);
    if (parsed.success) {
      metadata[key] = parsed.data;
    }
  }
  return metadata;
}
