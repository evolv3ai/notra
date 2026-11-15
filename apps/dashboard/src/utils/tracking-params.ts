import { DATABUDDY_TRACKING_PARAMS } from "@/constants/databuddy";
import type { UiRouteSearch } from "@/types/ui-route";
import { firstSearchParamValue } from "@/utils/settings-path";

export function trackingParams(
  searchParams: UiRouteSearch
): Record<string, string | undefined> {
  return Object.fromEntries(
    DATABUDDY_TRACKING_PARAMS.map((key) => [
      key,
      firstSearchParamValue(searchParams[key]),
    ])
  );
}

export function withTrackingParams(
  href: string,
  searchParams: UiRouteSearch
): string {
  const url = new URL(href, "http://localhost");
  for (const [key, value] of Object.entries(trackingParams(searchParams))) {
    if (value && !url.searchParams.has(key)) {
      url.searchParams.set(key, value);
    }
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
