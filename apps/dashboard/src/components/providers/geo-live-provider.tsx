"use client";

import { GEO_LIVE_INVALIDATE_THROTTLE_MS } from "@notra/geo-core/constants/geo";
import { geoLiveChannel } from "@notra/geo-core/utils/geo-live";
import { useThrottledCallback } from "@tanstack/react-pacer";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext } from "react";

import { useGeoProjectScope } from "@/components/providers/geo-project-provider";
import { useGuardedRealtime } from "@/lib/hooks/use-guarded-realtime";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { GeoLiveProviderProps } from "@/types/geo";
import {
  invalidateGeoTrafficQueries,
  isGeoLiveEventInScope,
} from "@/utils/geo-live";
import { invalidateGeoScanResultQueries } from "@/utils/geo-scan-results";

const GeoLiveContext = createContext(false);

export function GeoLiveProvider({
  organizationId,
  children,
}: GeoLiveProviderProps) {
  const queryClient = useQueryClient();
  const { projectId } = useGeoProjectScope();
  const throttle = {
    wait: GEO_LIVE_INVALIDATE_THROTTLE_MS,
    leading: true,
    trailing: true,
  };
  const refreshTraffic = useThrottledCallback(() => {
    invalidateGeoTrafficQueries(queryClient, {
      organizationId,
      projectId,
    }).catch(() => undefined);
  }, throttle);
  const refreshVisibility = useThrottledCallback(() => {
    const input = { organizationId, projectId };
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: dashboardOrpc.geo.settings.key({ input }),
      }),
      queryClient.invalidateQueries({
        queryKey: dashboardOrpc.geo.personasActivity.key({ input }),
      }),
      queryClient.invalidateQueries({
        queryKey: dashboardOrpc.geo.personaResults.key({ input }),
      }),
      invalidateGeoScanResultQueries(queryClient, input),
    ]).catch(() => undefined);
  }, throttle);

  const status = useGuardedRealtime({
    channels: [geoLiveChannel(organizationId)],
    events: ["geo.traffic", "geo.visibility"],
    enabled: organizationId.length > 0,
    onData: (payload) => {
      if (payload.event === "geo.traffic") {
        if (isGeoLiveEventInScope(payload.data.projectIds, projectId)) {
          refreshTraffic();
        }
        return;
      }
      if (isGeoLiveEventInScope([payload.data.projectId], projectId)) {
        refreshVisibility();
      }
    },
  });

  return (
    <GeoLiveContext.Provider value={status === "connected"}>
      {children}
    </GeoLiveContext.Provider>
  );
}

export function useGeoLive(): boolean {
  return useContext(GeoLiveContext);
}
