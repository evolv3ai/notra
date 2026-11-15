"use client";

import { InstrumentModule } from "@notra/ui/components/instrument/instrument-module";
import { AI_TRAFFIC_PURPOSE_LABELS } from "@notra/ui/constants/geo";
import { useMemo, useState } from "react";

import { AiTrendsMetricTabs } from "@/components/ai-trends/ai-trends-metric-tabs";
import { AiTrendsSeriesChart } from "@/components/ai-trends/ai-trends-series-chart-lazy";
import { AiTrendsShareButton } from "@/components/ai-trends/ai-trends-share-button";
import {
  AI_TRENDS_MAX_CHART_ENGINES,
  AI_TRENDS_TRAFFIC_METRICS,
  AI_TRENDS_TRAFFIC_PURPOSES,
} from "@/constants/ai-trends";
import type {
  AiTrendsTrafficChartProps,
  AiTrendsTrafficMetric,
  AiTrendsTrafficMetricOption,
  AiTrendsTrafficChartSource,
} from "@/types/ai-trends";
import {
  dayRange,
  seriesChartConfig,
  seriesChartRows,
  seriesLogos,
  chartFormatters,
} from "@/utils/ai-trends";
import { seriesShareCard, shareFileName } from "@/utils/ai-trends-share";
import {
  trafficDayIndex,
  trafficMarkdownSeries,
  trafficPurposeSeries,
  trafficVisitsSeries,
} from "@/utils/ai-trends-traffic";

function chartedSources(
  sources: AiTrendsTrafficChartSource[],
  metric: AiTrendsTrafficMetricOption
) {
  return sources.filter(
    (item) =>
      item.visitorType === metric.visitorType &&
      (metric.series !== "markdown" || item.markdownVisits > 0)
  );
}

export function AiTrendsTrafficChart({
  traffic,
  sources,
  sourceOrder,
}: AiTrendsTrafficChartProps) {
  const metrics = AI_TRENDS_TRAFFIC_METRICS.filter(
    (metric) => chartedSources(sources, metric).length > 0
  );
  const [selected, setSelected] = useState<AiTrendsTrafficMetric>("crawlers");
  const metric =
    metrics.find((item) => item.value === selected) ?? metrics[0] ?? null;
  const dayIndex = useMemo(() => trafficDayIndex(traffic.days), [traffic]);

  const chart = useMemo(() => {
    if (!metric) {
      return null;
    }
    const range = dayRange(traffic.window.from, traffic.window.toExclusive);
    if (metric.series === "purposes") {
      const purposes = AI_TRENDS_TRAFFIC_PURPOSES.map((purpose) => ({
        id: purpose,
        label: AI_TRAFFIC_PURPOSE_LABELS[purpose] ?? purpose,
      }));
      return {
        config: seriesChartConfig(purposes, AI_TRENDS_TRAFFIC_PURPOSES),
        rows: seriesChartRows(
          purposes.map((purpose) =>
            trafficPurposeSeries(traffic.days, purpose.id, range)
          )
        ),
      };
    }
    const charted = chartedSources(sources, metric).slice(
      0,
      AI_TRENDS_MAX_CHART_ENGINES
    );
    const series =
      metric.series === "markdown"
        ? trafficMarkdownSeries
        : trafficVisitsSeries;
    return {
      config: seriesChartConfig(charted, sourceOrder[metric.visitorType]),
      logos: seriesLogos(charted.map((item) => ({ logo: item.source }))),
      rows: seriesChartRows(
        charted.map((item) => series(dayIndex, item.id, range))
      ),
    };
  }, [dayIndex, metric, sourceOrder, sources, traffic]);

  if (!(metric && chart)) {
    return null;
  }

  const format = metric.series === "visits" ? "visits" : "share";
  const formatters = chartFormatters(format);
  return (
    <InstrumentModule
      action={
        <>
          <AiTrendsMetricTabs
            metrics={metrics}
            onChange={setSelected}
            value={metric.value}
          />
          <AiTrendsShareButton
            card={() =>
              seriesShareCard({
                eyebrow: "AI traffic on Notra-tracked sites",
                title: metric.shareTitle,
                description: metric.description,
                format,
                axisLabel: metric.axisLabel,
                window: traffic.window,
                chart,
              })
            }
            name={shareFileName("ai traffic", metric.label)}
          />
        </>
      }
      description={metric.description}
      eyebrow="Over time"
      variant="table"
    >
      <AiTrendsSeriesChart
        config={chart.config}
        format={formatters.value}
        formatTick={formatters.tick}
        logos={"logos" in chart ? chart.logos : undefined}
        rows={chart.rows}
      />
    </InstrumentModule>
  );
}
