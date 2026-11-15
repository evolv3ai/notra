"use client";

import { sitesLiveChannel } from "@notra/sites-core/utils/live";
import { useThrottledCallback } from "@tanstack/react-pacer";
import { useQueryClient } from "@tanstack/react-query";

import { SITES_LIVE_INVALIDATE_THROTTLE_MS } from "@/constants/sites";
import { useGuardedRealtime } from "@/lib/hooks/use-guarded-realtime";
import { useSitesOrganizationId } from "@/lib/hooks/use-sites";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { SitesLiveProviderProps } from "@/types/components/sites";

/**
 * Refetches site and deployment queries whenever a deployment of the
 * organization is queued, starts, or settles, so status badges follow a build
 * without waiting for the next poll. Polling stays as the fallback.
 */
export function SitesLiveProvider({
  organizationSlug,
  children,
}: SitesLiveProviderProps) {
  const queryClient = useQueryClient();
  const organizationId = useSitesOrganizationId(organizationSlug);
  const refresh = useThrottledCallback(
    () => {
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: dashboardOrpc.sites.list.key(),
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardOrpc.sites.get.key(),
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardOrpc.sites.deployments.key(),
        }),
      ]).catch(() => undefined);
    },
    { wait: SITES_LIVE_INVALIDATE_THROTTLE_MS, leading: true, trailing: true }
  );

  useGuardedRealtime({
    channels: [sitesLiveChannel(organizationId)],
    events: ["sites.deployment"],
    enabled: organizationId.length > 0,
    onData: refresh,
  });

  return children;
}
