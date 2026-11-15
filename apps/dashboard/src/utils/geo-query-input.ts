import {
  AI_TRAFFIC_LOG_FETCH_LIMIT,
  AI_TRAFFIC_PAGES_FETCH_LIMIT,
  GEO_JOURNEY_RECENT_LIMIT,
} from "@notra/geo-core/constants/geo";
import type {
  GeoTrafficLogFilters,
  GeoTrafficSitesMode,
} from "@notra/geo-core/types/geo";
import {
  toGeoTrafficLogPurposeFilter,
  toGeoTrafficLogVisitorFilter,
} from "@notra/geo-core/utils/ai-traffic";
import { trafficLogHostFilter } from "@notra/geo-core/utils/geo-project-domains";

import type { GeoQueryScope, GeoRangeQuery } from "@/types/geo";
import { toGeoWindowInput } from "@/utils/geo-range";

/**
 * Single source for the GEO query inputs that are both prefetched on the server
 * and requested by the client hooks. The two sides must produce byte-identical
 * inputs or the prefetched cache entry is never read — build them here only.
 */
export function geoSettingsQueryInput(scope: GeoQueryScope) {
  return {
    organizationId: scope.organizationId,
    projectId: scope.projectId,
  };
}

export function geoOverviewQueryInput(
  scope: GeoQueryScope,
  range: GeoRangeQuery | undefined
) {
  return { ...geoSettingsQueryInput(scope), ...toGeoWindowInput(range) };
}

function trafficPathInput(path: string | undefined) {
  return path ? { path } : {};
}

function trafficSitesInput(sites: GeoTrafficSitesMode | undefined) {
  return sites ? { sites } : {};
}

export function geoHostQueryInput(
  scope: GeoQueryScope,
  range: GeoRangeQuery | undefined,
  host: string | undefined,
  path?: string,
  sites?: GeoTrafficSitesMode
) {
  const filter = trafficLogHostFilter(host);
  return {
    ...geoOverviewQueryInput(scope, range),
    ...(filter ? { host: filter } : {}),
    ...trafficPathInput(path),
    ...trafficSitesInput(sites),
  };
}

export function geoTrafficJourneysQueryInput(
  scope: GeoQueryScope,
  range: GeoRangeQuery | undefined
) {
  return {
    ...geoOverviewQueryInput(scope, range),
    limit: GEO_JOURNEY_RECENT_LIMIT,
  };
}

export function geoTrafficPagesQueryInput(
  scope: GeoQueryScope,
  range: GeoRangeQuery | undefined,
  host: string | undefined,
  path?: string,
  sites?: GeoTrafficSitesMode
) {
  return {
    ...geoOverviewQueryInput(scope, range),
    limit: AI_TRAFFIC_PAGES_FETCH_LIMIT,
    host: trafficLogHostFilter(host),
    ...trafficPathInput(path),
    ...trafficSitesInput(sites),
  };
}

export function geoTrafficLogQueryInput(
  scope: GeoQueryScope,
  filters: GeoTrafficLogFilters,
  host: string | undefined,
  path?: string,
  sites?: GeoTrafficSitesMode
) {
  return {
    ...geoSettingsQueryInput(scope),
    limit: AI_TRAFFIC_LOG_FETCH_LIMIT,
    visitorTypes: toGeoTrafficLogVisitorFilter(filters.visitorTypes),
    categories: toGeoTrafficLogPurposeFilter(filters.categories),
    host: trafficLogHostFilter(host),
    ...trafficPathInput(path),
    ...trafficSitesInput(sites),
  };
}
