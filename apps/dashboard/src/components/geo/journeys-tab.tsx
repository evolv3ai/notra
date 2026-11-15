"use client";

import { GEO_JOURNEY_OVERVIEW_ROWS } from "@notra/geo-core/constants/geo";
import type { GeoJourney } from "@notra/geo-core/types/geo";
import { trafficSparklineDays } from "@notra/geo-core/utils/ai-traffic";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useMemo, useState } from "react";
import { InstrumentEmpty } from "ui/card";
import { InstrumentGrid } from "ui/card/grid";
import { DataTableSkeleton } from "ui/table";
import { useTranslations } from "use-intl";

import { JourneyDetailSheet } from "@/components/geo/journey-detail-sheet";
import { JourneyGroupSheet } from "@/components/geo/journey-group-sheet";
import { JourneyOverviewCard } from "@/components/geo/journey-overview-card";
import { JourneyPathsCard } from "@/components/geo/journey-paths-card";
import { JourneysCard } from "@/components/geo/journeys-card";
import { JourneysHero } from "@/components/geo/journeys-hero";
import { GeoSectionSkeleton } from "@/components/geo/skeleton-parts";
import { SkeletonCrossfade } from "@/components/skeleton-crossfade";
import {
  TRAFFIC_HERO_CHART_SURFACE_CLASS,
  TRAFFIC_HERO_FRAME_CLASS,
  TRAFFIC_HERO_METRIC_CELL_CLASS,
  TRAFFIC_HERO_METRICS_GRID_CLASS,
  TRAFFIC_HERO_METRICS_SURFACE_CLASS,
} from "@/constants/geo-traffic-hero";
import { trackEvent } from "@/lib/analytics/posthog-client";
import { usePrefetchGeoJourneyDetail } from "@/lib/hooks/use-geo";
import { cn } from "@/lib/utils";
import type { GeoJourneyGroupSelection, JourneysTabProps } from "@/types/geo";

const JOURNEY_TABLE_SKELETON_ROWS = 6;
const HERO_SKELETON_KEYS = ["a", "b", "c", "d"] as const;

function JourneysHeroSkeleton() {
  return (
    <div className={TRAFFIC_HERO_FRAME_CLASS}>
      <div
        className={cn(
          TRAFFIC_HERO_METRICS_GRID_CLASS,
          TRAFFIC_HERO_METRICS_SURFACE_CLASS
        )}
      >
        {HERO_SKELETON_KEYS.map((key) => (
          <div className={TRAFFIC_HERO_METRIC_CELL_CLASS} key={key}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
      <div className={TRAFFIC_HERO_CHART_SURFACE_CLASS}>
        <Skeleton className="mb-3 h-4 w-28" />
        <Skeleton className="h-52 w-full @md/hero:h-64" />
      </div>
    </div>
  );
}

function JourneysTabSkeleton() {
  const t = useTranslations("geo.journeysTab");
  const tCommon = useTranslations("common");
  const tGeoShared = useTranslations("geo.shared");
  return (
    <div aria-busy="true" className="mt-6 flex flex-col gap-6">
      <span className="sr-only">{t("loading")}</span>
      <JourneysHeroSkeleton />
      <div className="grid grid-cols-1 gap-4 @min-[44rem]/main:grid-cols-2">
        <GeoSectionSkeleton eyebrow={tCommon("labels.sources")}>
          <DataTableSkeleton rows={GEO_JOURNEY_OVERVIEW_ROWS} />
        </GeoSectionSkeleton>
        <GeoSectionSkeleton eyebrow={tGeoShared("fetchedPages")}>
          <DataTableSkeleton rows={GEO_JOURNEY_OVERVIEW_ROWS} />
        </GeoSectionSkeleton>
      </div>
      <GeoSectionSkeleton eyebrow={tGeoShared("agentJourneys")}>
        <DataTableSkeleton rows={JOURNEY_TABLE_SKELETON_ROWS} />
      </GeoSectionSkeleton>
    </div>
  );
}

export function JourneysTab({
  journeys,
  journeysFailed,
  journeyStats,
  journeyStatsFailed,
  loading,
  organizationId,
  organizationSlug,
  range,
}: JourneysTabProps) {
  const t = useTranslations("geo.journeysTab");
  const showSkeleton = loading && journeys.length === 0;
  const sources = journeyStats?.sources ?? [];
  const pages = journeyStats?.pages ?? [];
  const days = useMemo(
    () =>
      trafficSparklineDays(
        (journeyStats?.sources ?? []).flatMap((row) => row.daily),
        range.from,
        range.to
      ),
    [journeyStats, range.from, range.to]
  );
  const activeSources = sources.filter((row) => row.journeys > 0).length;
  const hasStats = !journeyStatsFailed && activeSources > 0;
  const [group, setGroup] = useState<GeoJourneyGroupSelection | null>(null);
  const [selectedJourney, setSelectedJourney] = useState<GeoJourney | null>(
    null
  );
  const prefetchJourneyDetail = usePrefetchGeoJourneyDetail(organizationId);
  const prefetchJourney = (journey: GeoJourney) =>
    prefetchJourneyDetail(journey.journeyId);
  const openJourney = (journey: GeoJourney) => {
    trackEvent(POSTHOG_EVENTS.GEO_JOURNEY_OPENED, {
      visitor_type: journey.visitorType,
      source: journey.source,
      pages: journey.pages,
      distinct_paths: journey.distinctPaths,
    });
    setGroup(null);
    setSelectedJourney(journey);
  };
  const previewRows = Math.max(
    1,
    Math.min(GEO_JOURNEY_OVERVIEW_ROWS, Math.max(activeSources, pages.length))
  );

  return (
    <SkeletonCrossfade
      loading={showSkeleton}
      skeleton={<JourneysTabSkeleton />}
    >
      <div className="mt-6 flex flex-col gap-6">
        {hasStats ? (
          <>
            <JourneysHero
              days={days}
              previousTotalPages={journeyStats?.previousTotalPages ?? 0}
              sources={sources}
              totalPages={journeyStats?.totalPages ?? 0}
            />
            <InstrumentGrid className="grid-cols-1 items-stretch gap-4 @min-[44rem]/main:grid-cols-2">
              <JourneyOverviewCard
                loading={loading}
                onOpenSource={(row) =>
                  setGroup({
                    kind: "source",
                    source: row.source,
                    visitorType: row.visitorType,
                  })
                }
                previewRows={previewRows}
                sources={sources}
              />
              <JourneyPathsCard
                loading={loading}
                onOpenPath={(row) => setGroup({ kind: "page", path: row.path })}
                pages={pages}
                previewRows={previewRows}
                totalPages={journeyStats?.totalPages ?? 0}
              />
            </InstrumentGrid>
          </>
        ) : null}
        {journeyStatsFailed ? (
          <InstrumentEmpty
            className="min-h-40"
            message={t("loadFailed")}
            seed="geo-journey-stats-error"
          />
        ) : null}
        <JourneysCard
          failed={journeysFailed}
          journeys={journeys}
          loading={loading}
          organizationSlug={organizationSlug}
          onOpenJourney={openJourney}
          onPrefetchJourney={prefetchJourney}
        />
        <JourneyGroupSheet
          days={days}
          journeys={journeys}
          stats={journeyStats}
          onOpenChange={(open) => {
            if (!open) {
              setGroup(null);
            }
          }}
          onOpenJourney={openJourney}
          onPrefetchJourney={prefetchJourney}
          selection={group}
        />
        <JourneyDetailSheet
          journey={selectedJourney}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedJourney(null);
            }
          }}
          open={selectedJourney !== null}
          organizationId={organizationId}
        />
      </div>
    </SkeletonCrossfade>
  );
}
