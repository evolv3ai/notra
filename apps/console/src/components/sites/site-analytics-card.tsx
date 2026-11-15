"use client";

import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";

import {
  SiteStatCard,
  SiteStatCardSkeleton,
} from "@/components/sites/site-stat-card";
import { SITE_ANALYTICS_DAYS, SITE_TOP_ROWS } from "@/constants/sites";
import { consoleOrpc } from "@/lib/orpc/query";
import type { SiteAnalyticsCardProps } from "@/types/sites";
import { formatSeconds } from "@/utils/site-charts";

const SiteTrafficChart = dynamic(
  () =>
    import("@/components/sites/site-traffic-chart").then(
      (module) => module.SiteTrafficChart
    ),
  { loading: () => <Skeleton className="h-40 rounded-xl" /> }
);

const ANALYTICS_LABELS = [
  "Visitors",
  "Page views",
  "AI visitors",
  "Avg. time on page",
] as const;

const numberFormat = new Intl.NumberFormat("en");

function formatChange(current: number, previous: number): string | null {
  if (previous <= 0) {
    return null;
  }
  const change = Math.round(((current - previous) / previous) * 100);
  return `${change >= 0 ? "+" : ""}${change}% vs previous ${SITE_ANALYTICS_DAYS} days`;
}

export function SiteAnalyticsCard({ siteId, enabled }: SiteAnalyticsCardProps) {
  const analyticsQuery = useQuery({
    ...consoleOrpc.sites.analytics.queryOptions({
      input: { siteId, days: SITE_ANALYTICS_DAYS },
    }),
    enabled,
    retry: false,
  });

  if (!enabled) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
        Analytics are turned off for this site.
      </p>
    );
  }
  if (analyticsQuery.isPending) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {ANALYTICS_LABELS.map((label) => (
          <SiteStatCardSkeleton key={label} label={label} />
        ))}
      </div>
    );
  }
  if (analyticsQuery.isError && analyticsQuery.data === undefined) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
        Could not load analytics: {analyticsQuery.error.message}
      </p>
    );
  }

  const { web, traffic, engagement } = analyticsQuery.data;
  if (!web.configured) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
        Tinybird is not configured on the dashboard.
      </p>
    );
  }

  const topPages = web.pages.slice(0, SITE_TOP_ROWS);
  const topSources = web.sources.slice(0, SITE_TOP_ROWS);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SiteStatCard
          hint={formatChange(web.totals.visitors, web.totals.previousVisitors)}
          label={ANALYTICS_LABELS[0]}
          value={numberFormat.format(web.totals.visitors)}
        />
        <SiteStatCard
          hint={formatChange(web.totals.views, web.totals.previousViews)}
          label={ANALYTICS_LABELS[1]}
          value={numberFormat.format(web.totals.views)}
        />
        <SiteStatCard
          hint={
            traffic.configured
              ? `${numberFormat.format(traffic.totals.crawler)} crawler visits`
              : "Crawler traffic unavailable"
          }
          label={ANALYTICS_LABELS[2]}
          value={numberFormat.format(web.totals.aiVisitors)}
        />
        <SiteStatCard
          hint={`${numberFormat.format(engagement.views)} timed views`}
          label={ANALYTICS_LABELS[3]}
          value={formatSeconds(engagement.avgSeconds)}
        />
      </div>
      <div className="bg-card ring-foreground/10 rounded-xl p-4 ring-1">
        <p className="text-muted-foreground mb-2 text-xs">
          Visitors and page views per day, last {SITE_ANALYTICS_DAYS} days
        </p>
        <SiteTrafficChart points={web.points} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="bg-card ring-foreground/10 rounded-xl p-4 ring-1">
          <p className="mb-2 text-sm font-medium">Top pages</p>
          {topPages.length === 0 ? (
            <p className="text-muted-foreground text-sm">No page views yet.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {topPages.map((page) => (
                <li
                  className="flex items-center justify-between gap-3"
                  key={`${page.host}${page.path}`}
                >
                  <span className="truncate font-mono text-xs">
                    {page.path}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {numberFormat.format(page.views)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-card ring-foreground/10 rounded-xl p-4 ring-1">
          <p className="mb-2 text-sm font-medium">Top sources</p>
          {topSources.length === 0 ? (
            <p className="text-muted-foreground text-sm">No referrers yet.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {topSources.map((source) => (
                <li
                  className="flex items-center justify-between gap-3"
                  key={`${source.group}:${source.source}`}
                >
                  <span className="truncate">{source.source || "Direct"}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {numberFormat.format(source.visitors)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
