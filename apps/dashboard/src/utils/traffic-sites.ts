import { GEO_TRAFFIC_SITES_MODES } from "@notra/geo-core/constants/geo";
import type {
  GeoTrafficSitesMode,
  WebAnalyticsResponse,
} from "@notra/geo-core/types/geo";

export function toTrafficSitesMode(
  value: string | null | undefined
): GeoTrafficSitesMode | undefined {
  return GEO_TRAFFIC_SITES_MODES.find((mode) => mode === value);
}

/** Hosts served by Notra Sites in the window, so the page can offer a filter. */
export function trafficSiteHosts(
  web: WebAnalyticsResponse | undefined
): string[] {
  return [
    ...new Set(
      (web?.hosts ?? []).filter((row) => row.siteId).map((row) => row.host)
    ),
  ];
}
