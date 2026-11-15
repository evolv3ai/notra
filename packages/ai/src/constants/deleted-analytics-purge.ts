import { GEO_TRAFFIC_FLUSH_INTERVAL_MS } from "@notra/analytics/constants/cache";

export const DELETED_ANALYTICS_PURGE_ROUTE_PATH =
  "/api/workflows/deleted-analytics-purge";
export const DELETED_ANALYTICS_PURGE_DELAY_MS =
  GEO_TRAFFIC_FLUSH_INTERVAL_MS + 5 * 60 * 1000;
