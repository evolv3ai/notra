"use client";

import { normalizeCompetitorDomain } from "@notra/geo-core/geo/domain";
import type { GeoCompetitor } from "@notra/geo-core/types/geo";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useGeoProjectScope } from "@/components/providers/geo-project-provider";
import { GEO_COMPETITOR_DOMAIN_BACKFILL_MAX } from "@/constants/geo-competitors";
import { geoDbQueryKey } from "@/lib/db/geo-collections";
import { useCompanyLogosByName } from "@/lib/hooks/use-onboarding";
import { dashboardOrpc } from "@/lib/orpc/query";

/**
 * Tracked competitors added by name only (onboarding, CSV, older scans) have
 * no website. The logo lookup already resolved one for each of them; the
 * server stores it only while the stored website is still empty.
 */
export function useGeoCompetitorDomainBackfill(
  organizationId: string,
  competitors: readonly GeoCompetitor[]
) {
  const queryClient = useQueryClient();
  const { projectId } = useGeoProjectScope();
  const missing = competitors
    .filter((competitor) => !competitor.domain)
    .slice(0, GEO_COMPETITOR_DOMAIN_BACKFILL_MAX);
  const lookups = useCompanyLogosByName(
    missing.map((competitor) => competitor.name)
  );
  const attempted = useRef(new Set<string>());
  const resolved = missing.flatMap((competitor, index) => {
    const domain = normalizeCompetitorDomain(
      lookups[index]?.data?.domain ?? ""
    );
    return domain ? [{ name: competitor.name, domain }] : [];
  });

  useEffect(() => {
    const domains = resolved.filter(
      (entry) => !attempted.current.has(entry.name)
    );
    if (!organizationId || domains.length === 0) {
      return;
    }
    for (const entry of domains) {
      attempted.current.add(entry.name);
    }
    dashboardOrpc.geo.competitorDomainsFill
      .call({ organizationId, projectId, domains })
      .then(() =>
        queryClient.invalidateQueries({
          queryKey: geoDbQueryKey("competitors", { organizationId, projectId }),
        })
      )
      .catch(() => undefined);
  }, [resolved, organizationId, projectId, queryClient]);
}
