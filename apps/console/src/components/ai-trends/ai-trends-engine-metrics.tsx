"use client";

import { InstrumentModule } from "@notra/ui/components/instrument/instrument-module";
import { useMemo, useState } from "react";

import { AiTrendsMetricTabs } from "@/components/ai-trends/ai-trends-metric-tabs";
import { AiTrendsSeriesChart } from "@/components/ai-trends/ai-trends-series-chart-lazy";
import { AiTrendsShareButton } from "@/components/ai-trends/ai-trends-share-button";
import {
  AI_TRENDS_ENGINE_METRICS,
  AI_TRENDS_MAX_CHART_ENGINES,
} from "@/constants/ai-trends";
import type {
  AiTrendsEngineMetric,
  AiTrendsEngineMetricsProps,
} from "@/types/ai-trends";
import {
  dayRange,
  engineMetricSeries,
  anomalyChartFormat,
  formatAnomalyTick,
  formatAnomalyValue,
  seriesChartConfig,
  seriesChartRows,
  seriesLogos,
} from "@/utils/ai-trends";
import { seriesShareCard, shareFileName } from "@/utils/ai-trends-share";

export function AiTrendsEngineMetrics({
  overview,
}: AiTrendsEngineMetricsProps) {
  const metrics = AI_TRENDS_ENGINE_METRICS.filter((metric) =>
    overview.engines.some((engine) => engine[metric.volume] > 0)
  );
  const [selected, setSelected] = useState<AiTrendsEngineMetric>("queries");
  const metric =
    metrics.find((item) => item.value === selected) ?? metrics[0] ?? null;

  const chart = useMemo(() => {
    if (!metric) {
      return null;
    }
    const range = dayRange(overview.window.from, overview.window.toExclusive);
    const engines = overview.engines
      .filter((engine) => engine[metric.volume] > 0)
      .sort((a, b) => b[metric.volume] - a[metric.volume])
      .slice(0, AI_TRENDS_MAX_CHART_ENGINES);
    return {
      config: seriesChartConfig(
        engines,
        overview.engines.map((engine) => engine.id)
      ),
      logos: seriesLogos(engines.map((engine) => ({ logo: engine.id }))),
      rows: seriesChartRows(
        engines.map((engine) =>
          engineMetricSeries(
            overview.engineDays,
            engine.id,
            metric.value,
            range
          )
        )
      ),
    };
  }, [metric, overview]);

  if (!(metric && chart)) {
    return null;
  }

  const kind = metric.value;
  return (
    <InstrumentModule
      action={
        <>
          <AiTrendsMetricTabs
            metrics={metrics}
            onChange={setSelected}
            value={kind}
          />
          <AiTrendsShareButton
            card={() =>
              seriesShareCard({
                eyebrow: "How AI engines search",
                title: {
                  before: "",
                  highlight: metric.label,
                  after: " by AI engine",
                },
                description: metric.description,
                ...anomalyChartFormat(kind),
                window: overview.window,
                chart,
              })
            }
            name={shareFileName(metric.label, "by engine")}
          />
        </>
      }
      description={metric.description}
      eyebrow="How engines search"
      variant="table"
    >
      <AiTrendsSeriesChart
        config={chart.config}
        format={(value) => formatAnomalyValue(kind, value)}
        formatTick={(value) => formatAnomalyTick(kind, value)}
        logos={chart.logos}
        rows={chart.rows}
      />
    </InstrumentModule>
  );
}
