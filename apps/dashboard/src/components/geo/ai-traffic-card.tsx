"use client";

import {
  GEO_EMPTY_TRAFFIC_RESPONSE,
  GEO_TRAFFIC_OTHER_GROUP,
} from "@notra/geo-core/constants/geo";
import {
  hasTrafficSourceSeries,
  toGeoTrafficPreviousTotals,
  trafficSparklineDays,
} from "@notra/geo-core/utils/ai-traffic";
import { AnimatedNumber } from "@notra/ui/components/animated-number";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { memo, useCallback, useMemo, useState } from "react";
import { InstrumentEmpty, InstrumentSection } from "ui/card";
import { useLocale, useTranslations } from "use-intl";

import { TrafficHero } from "@/components/geo/traffic-hero";
import { TrafficSourceSheet } from "@/components/geo/traffic-source-sheet";
import { TrafficSourcesStack } from "@/components/geo/traffic-sources-group";
import { useTrafficSourceColumns } from "@/lib/hooks/use-traffic-source-columns";
import type {
  AiTrafficCardProps,
  GeoTrafficSourceBand,
  GeoTrafficSourceGroup,
} from "@/types/geo";
import {
  buildTrafficGroupSeries,
  groupTrafficSources,
  trafficGroupKey,
  trafficGroupPathsAreLowerBound,
  withSourcePaths,
} from "@/utils/ai-traffic-groups";

const MemoTrafficHero = memo(TrafficHero);
const MemoTrafficSourcesStack = memo(TrafficSourcesStack);

export function AiTrafficCard({
  traffic,
  sourcePaths,
  pages,
  range,
  settingsHref,
  isPending = false,
  showHero = true,
}: AiTrafficCardProps) {
  const tCommon = useTranslations("common");
  const tShared = useTranslations("geo.shared");
  const locale = useLocale();
  const {
    sources: fastSources,
    totals,
    points,
    previousConversions,
  } = traffic ?? GEO_EMPTY_TRAFFIC_RESPONSE;
  const sources = useMemo(
    () => withSourcePaths(fastSources, sourcePaths),
    [fastSources, sourcePaths]
  );
  const pathsPending = sourcePaths === undefined;
  const previousTotals = useMemo(
    () => toGeoTrafficPreviousTotals(sources, previousConversions),
    [sources, previousConversions]
  );
  const groups = useMemo(
    () =>
      groupTrafficSources(sources).map((group) =>
        group.key === GEO_TRAFFIC_OTHER_GROUP.key
          ? { ...group, label: tCommon("labels.other") }
          : group
      ),
    [sources, tCommon]
  );
  const [collapsed, setCollapsed] = useState<ReadonlySet<GeoTrafficSourceBand>>(
    () => new Set()
  );
  const toggleCollapsed = useCallback(
    (band: GeoTrafficSourceBand) =>
      setCollapsed((current) => {
        const next = new Set(current);
        if (next.has(band)) {
          next.delete(band);
        } else {
          next.add(band);
        }
        return next;
      }),
    []
  );
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);
  const [sourceSheetOpen, setSourceSheetOpen] = useState(false);
  const openSource = useCallback((group: GeoTrafficSourceGroup) => {
    setOpenGroupKey(trafficGroupKey(group.band, group.key));
    setSourceSheetOpen(true);
  }, []);
  const sparklineDays = useMemo(
    () => trafficSparklineDays(points, range?.from, range?.to),
    [points, range?.from, range?.to]
  );
  const canSparkline = hasTrafficSourceSeries(points);
  const seriesByGroup = useMemo(() => {
    const map = new Map<string, { day: string; value: number }[]>();
    if (!canSparkline) {
      return map;
    }

    for (const group of groups) {
      const values = buildTrafficGroupSeries(points, group, sparklineDays);
      map.set(
        trafficGroupKey(group.band, group.key),
        sparklineDays.map((day, index) => ({
          day,
          value: values[index] ?? 0,
        }))
      );
    }

    return map;
  }, [canSparkline, groups, points, sparklineDays]);

  const openGroup =
    openGroupKey === null
      ? (groups[0] ?? null)
      : (groups.find(
          (group) => trafficGroupKey(group.band, group.key) === openGroupKey
        ) ?? null);

  const sourceColumns = useTrafficSourceColumns({ seriesByKey: seriesByGroup });
  const columns = useMemo(
    () =>
      sourceColumns.map((column) =>
        column.key === "paths"
          ? {
              ...column,
              cell: (row: GeoTrafficSourceGroup) =>
                pathsPending ? (
                  <Skeleton className="ml-auto h-3 w-8" />
                ) : (
                  <span className="text-sm tabular-nums">
                    {trafficGroupPathsAreLowerBound(row) ? "≥ " : null}
                    <AnimatedNumber locale={locale} value={row.paths} />
                  </span>
                ),
            }
          : column
      ),
    [sourceColumns, locale, pathsPending]
  );

  if (groups.length === 0) {
    return (
      <InstrumentSection eyebrow={tCommon("labels.sources")}>
        <InstrumentEmpty
          message={tShared("noAiTrafficCapturedYet")}
          seed="geo-traffic-sources"
        />
      </InstrumentSection>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {showHero ? (
        <MemoTrafficHero
          groups={groups}
          points={points}
          previousTotals={previousTotals}
          days={sparklineDays}
          settingsHref={settingsHref}
          totals={totals}
        />
      ) : null}
      <InstrumentSection eyebrow={tCommon("labels.sources")}>
        <MemoTrafficSourcesStack
          collapsed={collapsed}
          columns={columns}
          groups={groups}
          loading={isPending}
          onOpen={openSource}
          onToggle={toggleCollapsed}
        />
      </InstrumentSection>
      <TrafficSourceSheet
        group={openGroup}
        open={sourceSheetOpen && openGroup !== null}
        onOpenChange={setSourceSheetOpen}
        pages={pages}
        series={
          openGroup
            ? (seriesByGroup.get(
                trafficGroupKey(openGroup.band, openGroup.key)
              ) ?? [])
            : []
        }
      />
    </div>
  );
}
