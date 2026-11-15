import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useState, useSyncExternalStore } from "react";

import { useOrganizationsContext } from "@/components/providers/organization-provider";
import {
  SITE_ACTIVE_POLL_INTERVAL_MS,
  SITE_ANALYTICS_POLL_INTERVAL_MS,
  SITE_IDLE_POLL_INTERVAL_MS,
} from "@/constants/sites";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  SitePollingQuery,
  SiteAnalyticsWindow,
} from "@/types/hooks/sites";
import type { SiteDetail, SiteListResult } from "@/types/sites";
import { hasDeploymentInProgress } from "@/utils/site-deployments";

export function useSitesOrganizationId(organizationSlug: string): string {
  const { getOrganization, activeOrganization } = useOrganizationsContext();
  const organization =
    activeOrganization?.slug === organizationSlug
      ? activeOrganization
      : getOrganization(organizationSlug);
  return organization?.id ?? "";
}

export function useSitesStatus(organizationId: string) {
  return useQuery(
    dashboardOrpc.sites.status.queryOptions({
      input: { organizationId },
      enabled: organizationId.length > 0,
      staleTime: Number.POSITIVE_INFINITY,
    })
  );
}

export function useSitePlanUsage(organizationId: string, enabled = true) {
  return useQuery(
    dashboardOrpc.sites.planUsage.queryOptions({
      input: { organizationId },
      enabled: enabled && organizationId.length > 0,
    })
  );
}

export function useSitePlanLimitReached(
  organizationId: string,
  kind: "sites" | "domains"
) {
  const usage = useSitePlanUsage(organizationId).data?.[kind];
  return usage?.limit != null && usage.used >= usage.limit;
}

/**
 * Free plan site limit for the new-site page: `blocked` is set while creation
 * is not allowed. Once creation is allowed it stays allowed for the visit, so
 * creating the site does not send the user away mid-deployment.
 */
export function useSiteCreationLimit(organizationId: string, enabled: boolean) {
  const planQuery = useSitePlanUsage(organizationId, enabled);
  const [allowed, setAllowed] = useState(false);
  const sites = planQuery.data?.sites;
  const blocked = sites?.limit != null && sites.used >= sites.limit;
  if (!allowed && sites && !blocked) {
    setAllowed(true);
  }
  return {
    settled: Boolean(sites),
    failed: !sites && planQuery.isError,
    retry: planQuery.refetch,
    blocked: !allowed && blocked,
  };
}

export function useSitesList(organizationId: string, projectId: string) {
  return useQuery(
    dashboardOrpc.sites.list.queryOptions({
      input: { organizationId, projectId },
      enabled: organizationId.length > 0 && projectId.length > 0,
      refetchInterval: (query: SitePollingQuery<SiteListResult>) => {
        const latest = (query.state.data?.sites ?? []).flatMap((site) =>
          site.latestDeployment ? [site.latestDeployment] : []
        );
        return hasDeploymentInProgress(latest)
          ? SITE_ACTIVE_POLL_INTERVAL_MS
          : SITE_IDLE_POLL_INTERVAL_MS;
      },
      refetchIntervalInBackground: false,
    })
  );
}

export function useSiteDetail(organizationId: string, siteId: string) {
  return useQuery(
    dashboardOrpc.sites.get.queryOptions({
      input: { organizationId, siteId },
      enabled: organizationId.length > 0 && siteId.length > 0,
      refetchInterval: (query: SitePollingQuery<SiteDetail>) =>
        hasDeploymentInProgress(query.state.data?.deployments ?? [])
          ? SITE_ACTIVE_POLL_INTERVAL_MS
          : SITE_IDLE_POLL_INTERVAL_MS,
      refetchIntervalInBackground: false,
    })
  );
}

/**
 * The project of the site the open site page loads, `null` once that load
 * failed. Reads the cache without adding an entry, so the page's loader data
 * still hydrates during render.
 */
export function useLoadedSiteProjectId(
  organizationId: string,
  siteId: string
): string | null | undefined {
  const queryClient = useQueryClient();
  const queryKey = dashboardOrpc.sites.get.queryKey({
    input: { organizationId, siteId },
  });
  const { queryHash } = queryClient.defaultQueryOptions({ queryKey });
  const subscribe = useCallback(
    (onChange: () => void) =>
      queryClient.getQueryCache().subscribe((event) => {
        if (event.query.queryHash === queryHash) {
          onChange();
        }
      }),
    [queryClient, queryHash]
  );
  const read = () => {
    if (!siteId) {
      return undefined;
    }
    const state = queryClient.getQueryState(queryKey);
    if (state?.data) {
      return state.data.site.projectId;
    }
    return state?.status === "error" ? null : undefined;
  };
  return useSyncExternalStore(subscribe, read, read);
}

export function useSiteAnalytics(
  organizationId: string,
  siteId: string,
  window: SiteAnalyticsWindow
) {
  return useQuery({
    ...dashboardOrpc.sites.analytics.queryOptions({
      input: { organizationId, siteId, ...window },
      enabled: organizationId.length > 0,
      refetchInterval: SITE_ANALYTICS_POLL_INTERVAL_MS,
      refetchIntervalInBackground: false,
    }),
    placeholderData: keepPreviousData,
  });
}

export function useInvalidateSites() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: dashboardOrpc.sites.key() });
}
