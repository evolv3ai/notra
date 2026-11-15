import {
  CHART_MENTION_RATE_PERCENT_PRECISION,
  CHART_MENTION_RATE_PERCENT_SCALE,
  GEO_CHART_EMPTY_COMPETITORS,
  GEO_CHART_EMPTY_OVERVIEW,
  GEO_CHART_EMPTY_TIMESERIES,
  GEO_CHART_MENTION_COUNT_SUBTITLE,
  GEO_CHART_MENTION_RATE_SUBTITLE,
  GEO_COMPETITOR_SHARE_CHART_TITLE,
  GEO_OVERVIEW_CHART_TITLE,
  GEO_TIMESERIES_CHART_TITLE,
} from "@notra/ai/constants/chart-artifact";
import type {
  ChartArtifact,
  ChartSegment,
  GeoCompetitorShareChartInput,
  GeoOverviewChartInput,
  GeoTimeseriesChartInput,
} from "@notra/ai/types/chart-artifact";

const DIRECT_GROUNDED_SUFFIX = "-direct-grounded";
const GROUNDED_SUFFIX = "-grounded";

function chartEngineLabel(engine: string): string {
  if (engine.endsWith(DIRECT_GROUNDED_SUFFIX)) {
    return `${engine.slice(0, -DIRECT_GROUNDED_SUFFIX.length)} (direct)`;
  }
  if (engine.endsWith(GROUNDED_SUFFIX)) {
    return `${engine.slice(0, -GROUNDED_SUFFIX.length)} (grounded)`;
  }
  return engine;
}

function toMentionRatePercent(rate: number): number {
  return (
    Math.round(
      rate *
        CHART_MENTION_RATE_PERCENT_SCALE *
        CHART_MENTION_RATE_PERCENT_PRECISION
    ) / CHART_MENTION_RATE_PERCENT_PRECISION
  );
}

function geoChartWindowSubtitle(days: number, metric: string): string {
  return `${metric} · last ${days} days`;
}

function emptyChart(
  title: string,
  subtitle: string,
  emptyMessage: string
): ChartArtifact {
  return { kind: "empty", title, subtitle, emptyMessage };
}

export function buildGeoOverviewChart(
  input: GeoOverviewChartInput
): ChartArtifact {
  const subtitle = geoChartWindowSubtitle(
    input.days,
    GEO_CHART_MENTION_RATE_SUBTITLE
  );
  if (input.engines.length === 0) {
    return emptyChart(
      GEO_OVERVIEW_CHART_TITLE,
      subtitle,
      GEO_CHART_EMPTY_OVERVIEW
    );
  }

  return {
    kind: "bar",
    title: GEO_OVERVIEW_CHART_TITLE,
    subtitle,
    segments: input.engines.map((engine) => ({
      label: chartEngineLabel(engine.engine),
      value: toMentionRatePercent(engine.mention_rate),
    })),
  };
}

export function buildGeoTimeseriesChart(
  input: GeoTimeseriesChartInput
): ChartArtifact {
  const subtitle = geoChartWindowSubtitle(
    input.days,
    GEO_CHART_MENTION_RATE_SUBTITLE
  );
  const seriesByEngine = new Map<
    string,
    { name: string; pointsByDay: Map<string, number> }
  >();

  for (const point of input.points) {
    const series = seriesByEngine.get(point.engine) ?? {
      name: chartEngineLabel(point.engine),
      pointsByDay: new Map<string, number>(),
    };
    series.pointsByDay.set(point.day, toMentionRatePercent(point.mention_rate));
    seriesByEngine.set(point.engine, series);
  }

  if (input.points.length === 0) {
    return emptyChart(
      GEO_TIMESERIES_CHART_TITLE,
      subtitle,
      GEO_CHART_EMPTY_TIMESERIES
    );
  }

  return {
    kind: "area",
    title: GEO_TIMESERIES_CHART_TITLE,
    subtitle,
    series: [...seriesByEngine.values()].map((entry) => ({
      name: entry.name,
      points: [...entry.pointsByDay.entries()].map(([x, y]) => ({ x, y })),
    })),
  };
}

export function buildGeoCompetitorShareChart(
  input: GeoCompetitorShareChartInput
): ChartArtifact {
  const subtitle = geoChartWindowSubtitle(
    input.days,
    GEO_CHART_MENTION_COUNT_SUBTITLE
  );
  const segments: ChartSegment[] = [];
  for (const competitor of input.competitors) {
    if (competitor.mentions > 0) {
      segments.push({
        label: competitor.brand,
        value: competitor.mentions,
      });
    }
  }

  if (segments.length === 0) {
    return emptyChart(
      GEO_COMPETITOR_SHARE_CHART_TITLE,
      subtitle,
      GEO_CHART_EMPTY_COMPETITORS
    );
  }

  return {
    kind: "pie",
    title: GEO_COMPETITOR_SHARE_CHART_TITLE,
    subtitle,
    segments,
  };
}
