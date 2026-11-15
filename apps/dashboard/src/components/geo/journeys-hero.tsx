"use client";

import {
  GEO_JOURNEY_DEEP_CRAWL_PAGES,
  GEO_TRAFFIC_TREND_CRAWLER_KEY,
  GEO_TRAFFIC_TREND_REFERRAL_KEY,
} from "@notra/geo-core/constants/geo";
import { trafficVisitDelta } from "@notra/geo-core/utils/ai-traffic";
import { todayIsoDate } from "@notra/geo-core/utils/day-label";
import { AnimatedNumber } from "@notra/ui/components/animated-number";
import { useLocale, useTranslations } from "use-intl";

import { EChartsAreaChart } from "@/components/evilcharts/charts/echarts-area-chart";
import { GeoStatDelta } from "@/components/geo/geo-stat-delta";
import { CHART_PRIMARY_COLOR, CHART_REFERRAL_COLOR } from "@/constants/charts";
import {
  TRAFFIC_HERO_CHART_OPTIONS,
  TRAFFIC_HERO_CHART_SURFACE_CLASS,
  TRAFFIC_HERO_FRAME_CLASS,
  TRAFFIC_HERO_METRIC_CELL_CLASS,
  TRAFFIC_HERO_METRIC_VALUE_CLASS,
  TRAFFIC_HERO_METRICS_GRID_CLASS,
  TRAFFIC_HERO_METRICS_STANDALONE_CLASS,
  TRAFFIC_HERO_METRICS_SURFACE_CLASS,
} from "@/constants/geo-traffic-hero";
import { cn } from "@/lib/utils";
import type { ChartConfig } from "@/types/charts";
import type { JourneysHeroMetric, JourneysHeroProps } from "@/types/geo";
import { formatFullDayLabel } from "@/utils/analytics-charts";
import { seriesColors } from "@/utils/chart-colors";
import { formatChartInteger } from "@/utils/geo-charts";
import {
  formatJourneyShare,
  journeyActivityRows,
  journeyAverageDepth,
  journeyTotals,
} from "@/utils/geo-journey";

const JOURNEY_TREND_STROKE_WIDTH = 2;

function JourneysHeroMetricCell({ metric }: { metric: JourneysHeroMetric }) {
  const tGeoShared = useTranslations("geo.shared");
  const locale = useLocale();
  return (
    <div className={TRAFFIC_HERO_METRIC_CELL_CLASS}>
      <p className="text-foreground/75 text-sm leading-5 font-semibold tracking-tight text-pretty">
        {metric.label}
      </p>
      <div className="flex max-w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-2 self-start">
        {typeof metric.value === "number" ? (
          <AnimatedNumber
            className={TRAFFIC_HERO_METRIC_VALUE_CLASS}
            locale={locale}
            value={metric.value}
          />
        ) : (
          <span className={TRAFFIC_HERO_METRIC_VALUE_CLASS}>
            {metric.value}
          </span>
        )}
        {metric.delta === undefined ? null : (
          <GeoStatDelta
            delta={metric.delta}
            hint={tGeoShared("vsPreviousPeriodOfThe")}
            label={metric.label}
          />
        )}
      </div>
    </div>
  );
}

export function JourneysHero({
  sources,
  days,
  totalPages,
  previousTotalPages,
}: JourneysHeroProps) {
  const t = useTranslations("geo.journeysTab");
  const tCommon = useTranslations("common");
  const tGeoShared = useTranslations("geo.shared");
  const locale = useLocale();
  const totals = journeyTotals(sources);
  const showTrend = days.length > 1;
  const rows = journeyActivityRows(sources, days, locale).map((row) => ({
    ...row,
    [GEO_TRAFFIC_TREND_REFERRAL_KEY]:
      row[GEO_TRAFFIC_TREND_REFERRAL_KEY] > 0
        ? row[GEO_TRAFFIC_TREND_REFERRAL_KEY]
        : null,
  }));
  const markIncompleteTail = days.at(-1) === todayIsoDate();
  const metrics: JourneysHeroMetric[] = [
    {
      key: "journeys",
      label: tCommon("labels.journeys"),
      value: totals.journeys,
      delta: trafficVisitDelta(totals.journeys, totals.previousJourneys),
    },
    {
      key: "pages",
      label: tGeoShared("fetchedPages"),
      value: totalPages,
      delta: trafficVisitDelta(totalPages, previousTotalPages),
    },
    {
      key: "depth",
      label: tGeoShared("avgDepth"),
      value: journeyAverageDepth(totals.pages, totals.journeys).toLocaleString(
        locale
      ),
    },
    {
      key: "deep",
      label: tGeoShared("crawledPagesPages", {
        pages: GEO_JOURNEY_DEEP_CRAWL_PAGES,
      }),
      value: formatJourneyShare(totals.deepCrawls, totals.journeys),
    },
  ];
  const config: ChartConfig = {
    [GEO_TRAFFIC_TREND_CRAWLER_KEY]: {
      label: tGeoShared("crawlers"),
      colors: seriesColors(CHART_PRIMARY_COLOR),
    },
    [GEO_TRAFFIC_TREND_REFERRAL_KEY]: {
      label: tGeoShared("referrals"),
      colors: seriesColors(CHART_REFERRAL_COLOR),
    },
  };

  return (
    <div className={TRAFFIC_HERO_FRAME_CLASS}>
      <div
        className={cn(
          TRAFFIC_HERO_METRICS_GRID_CLASS,
          showTrend
            ? TRAFFIC_HERO_METRICS_SURFACE_CLASS
            : TRAFFIC_HERO_METRICS_STANDALONE_CLASS
        )}
      >
        {metrics.map((metric) => (
          <JourneysHeroMetricCell key={metric.key} metric={metric} />
        ))}
      </div>
      {showTrend ? (
        <div className={TRAFFIC_HERO_CHART_SURFACE_CLASS}>
          <h2 className="mb-3 text-sm font-medium">{t("activity")}</h2>
          <EChartsAreaChart
            animationType="left-to-right"
            chartOptions={TRAFFIC_HERO_CHART_OPTIONS}
            className="h-52 w-full cursor-crosshair @md/hero:h-64"
            config={config}
            curveType="monotone"
            data={rows}
            xDataKey="day"
          >
            <EChartsAreaChart.Grid variant="solid" />
            <EChartsAreaChart.XAxis dataKey="day" />
            <EChartsAreaChart.YAxis />
            <EChartsAreaChart.Area
              dataKey={GEO_TRAFFIC_TREND_CRAWLER_KEY}
              enableBufferLine={markIncompleteTail}
              strokeVariant="solid"
              strokeWidth={JOURNEY_TREND_STROKE_WIDTH}
              variant="gradient"
            />
            <EChartsAreaChart.Area
              dataKey={GEO_TRAFFIC_TREND_REFERRAL_KEY}
              enableBufferLine={markIncompleteTail}
              gapMissing
              strokeVariant="solid"
              strokeWidth={JOURNEY_TREND_STROKE_WIDTH}
              variant="gradient"
            />
            <EChartsAreaChart.Tooltip
              confine={false}
              hideZeros
              labelFormatter={(day: string) => formatFullDayLabel(day, locale)}
              labelKey="rawDay"
              layout="rows"
              position="fixed"
              roundness="xl"
              scrub
              valueFormatter={(value: number) =>
                formatChartInteger(value, locale)
              }
              variant="frosted-glass"
            />
          </EChartsAreaChart>
        </div>
      ) : null}
    </div>
  );
}
