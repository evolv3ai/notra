"use client";

import { formatDayLabel, todayIsoDate } from "@notra/geo-core/utils/day-label";
import { useMemo } from "react";
import { useLocale } from "use-intl";

import { EChartsBarChart } from "@/components/evilcharts/charts/echarts-bar-chart";
import { CHART_PRIMARY_COLOR } from "@/constants/charts";
import { TRAFFIC_HERO_CHART_OPTIONS } from "@/constants/geo-traffic-hero";
import type { ChartConfig } from "@/types/charts";
import type { DailyTrendChartProps } from "@/types/geo";
import { seriesColors } from "@/utils/chart-colors";
import { formatChartInteger } from "@/utils/geo-charts";

const DAILY_TREND_SERIES_KEY = "value";

export function DailyTrendChart({ points, label }: DailyTrendChartProps) {
  const locale = useLocale();
  const config = useMemo<ChartConfig>(
    () => ({
      [DAILY_TREND_SERIES_KEY]: {
        label,
        colors: seriesColors(CHART_PRIMARY_COLOR),
      },
    }),
    [label]
  );
  const rows = useMemo(
    () =>
      points.map((point) => ({
        day: formatDayLabel(point.day, locale),
        [DAILY_TREND_SERIES_KEY]: point.value,
      })),
    [locale, points]
  );
  const incompleteTail = points.at(-1)?.day === todayIsoDate();

  return (
    <EChartsBarChart
      animation={false}
      barRadius={4}
      chartOptions={TRAFFIC_HERO_CHART_OPTIONS}
      className="h-44 w-full"
      config={config}
      data={rows}
      xDataKey="day"
    >
      <EChartsBarChart.Grid />
      <EChartsBarChart.XAxis dataKey="day" hideDots />
      <EChartsBarChart.YAxis hideDots />
      <EChartsBarChart.Bar
        bufferBar={incompleteTail}
        dataKey={DAILY_TREND_SERIES_KEY}
      />
      <EChartsBarChart.Tooltip
        roundness="xl"
        valueFormatter={(value) => formatChartInteger(Number(value), locale)}
      />
    </EChartsBarChart>
  );
}
