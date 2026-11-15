"use client";

import { GEO_LIVE_SCAN_FALLBACK_INTERVAL_MS } from "@notra/geo-core/constants/geo";
import { useQuery } from "@tanstack/react-query";

import { useHasGeoFeature } from "@/lib/hooks/use-plan";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { GeoAccessLevel } from "@/types/geo-access";
import { toGeoAccessLevel } from "@/utils/geo-access";

/**
 * Single source for GEO gates in the UI. The plan comes from the billing
 * customer so upgrades apply instantly; the data check only runs without one.
 * `level` is undefined while loading. The API still enforces every write.
 */
export function useGeoAccess(organizationId: string) {
  const plan = useHasGeoFeature();
  const dataStatus = useQuery({
    ...dashboardOrpc.geo.dataStatus.queryOptions({
      input: { organizationId },
    }),
    enabled: Boolean(organizationId) && plan.isLocked,
    refetchInterval: (query) =>
      query.state.data?.hasData ? false : GEO_LIVE_SCAN_FALLBACK_INTERVAL_MS,
  });
  const isLoading = plan.isLoading || (plan.isLocked && dataStatus.isPending);
  const level: GeoAccessLevel | undefined =
    isLoading || plan.isUnavailable
      ? undefined
      : toGeoAccessLevel(
          !plan.isLocked,
          dataStatus.data?.hasData ?? dataStatus.isError
        );
  return {
    level,
    isLoading,
    isUnavailable: plan.isUnavailable,
    isFetching: plan.isFetching,
    refetch: plan.refetch,
  };
}
