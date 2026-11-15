"use client";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "@notra/ui/components/ui/chart";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { SiteBuildDurationChart } from "@/components/sites/site-build-duration-chart";
import { SiteChartTooltip } from "@/components/sites/site-chart-tooltip";
import { SiteQueryError } from "@/components/sites/site-query-error";
import {
  SITE_BUILD_ACTIVITY_CONFIG,
  SITE_CHART_HEIGHT_CLASS,
} from "@/constants/site-charts";
import { SITE_ACTIVITY_DAYS, SITE_IDLE_REFETCH_MS } from "@/constants/sites";
import { consoleOrpc } from "@/lib/orpc/query";
import type {
  SiteBuildChartsProps,
  SiteChartCardProps,
  SiteRecentBuild,
} from "@/types/sites";
import { formatChartDay, medianBuildMs } from "@/utils/site-charts";
import { formatBuildDuration } from "@/utils/site-deployments";

function durationDescription(builds: SiteRecentBuild[]): string {
  const medianMs = medianBuildMs(builds);
  const summary = `Last ${builds.length} finished builds, oldest to newest`;
  return medianMs === null
    ? summary
    : `${summary} · median ${formatBuildDuration(medianMs)} (dashed)`;
}

function SiteChartCard({ title, description, children }: SiteChartCardProps) {
  return (
    <div className="bg-card ring-foreground/10 flex min-w-0 flex-col gap-3 rounded-xl p-4 ring-1">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function SiteBuildCharts({ siteId }: SiteBuildChartsProps) {
  const activityQuery = useQuery({
    ...consoleOrpc.sites.buildActivity.queryOptions({
      input: { siteId, days: SITE_ACTIVITY_DAYS },
    }),
    refetchInterval: SITE_IDLE_REFETCH_MS,
  });

  if (activityQuery.isError && !activityQuery.data) {
    return (
      <SiteQueryError
        message="Could not load build charts."
        onRetry={() => activityQuery.refetch()}
        retrying={activityQuery.isFetching}
      />
    );
  }

  const days = activityQuery.data?.days;
  const builds = activityQuery.data?.builds;

  let durationBody = <Skeleton className="h-48 w-full" />;
  if (builds?.length === 0) {
    durationBody = (
      <p className="text-muted-foreground flex h-48 items-center justify-center text-sm">
        No finished builds yet.
      </p>
    );
  } else if (builds) {
    durationBody = (
      <SiteBuildDurationChart builds={builds} showSite={!siteId} />
    );
  }
  const total = days?.reduce(
    (sum, day) => sum + day.ready + day.failed + day.other,
    0
  );

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <SiteChartCard
        description={
          total === undefined
            ? `Last ${SITE_ACTIVITY_DAYS} days`
            : `${total} builds in the last ${SITE_ACTIVITY_DAYS} days`
        }
        title="Builds per day"
      >
        {days ? (
          <ChartContainer
            className={SITE_CHART_HEIGHT_CLASS}
            config={SITE_BUILD_ACTIVITY_CONFIG}
          >
            <BarChart accessibilityLayer data={days}>
              <CartesianGrid vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="day"
                minTickGap={24}
                tickFormatter={formatChartDay}
                tickLine={false}
                tickMargin={8}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <ChartTooltip
                content={
                  <SiteChartTooltip config={SITE_BUILD_ACTIVITY_CONFIG} />
                }
                cursor={false}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="ready" fill="var(--color-ready)" stackId="builds" />
              <Bar
                dataKey="failed"
                fill="var(--color-failed)"
                stackId="builds"
              />
              <Bar
                dataKey="other"
                fill="var(--color-other)"
                radius={[3, 3, 0, 0]}
                stackId="builds"
              />
            </BarChart>
          </ChartContainer>
        ) : (
          <Skeleton className="h-48 w-full" />
        )}
      </SiteChartCard>
      <SiteChartCard
        description={builds ? durationDescription(builds) : "Finished builds"}
        title="Build duration"
      >
        {durationBody}
      </SiteChartCard>
    </div>
  );
}
