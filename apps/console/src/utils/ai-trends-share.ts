import type { ChartConfig } from "@notra/ui/components/ui/chart";

import {
  AI_TRENDS_ENGINE_COLORS,
  AI_TRENDS_ENGINE_METRICS,
} from "@/constants/ai-trends";
import type {
  AiTrendsAnomaly,
  AiTrendsChartRow,
  AiTrendsSeriesLogos,
  AiTrendsShareCard,
  AiTrendsShareDraft,
  AiTrendsStat,
  AiTrendsWindow,
} from "@/types/ai-trends";
import {
  anomalyChartFormat,
  anomalySitesLabel,
  anomalyTitle,
  changeOrNull,
  formatAnomalyValue,
  formatShare,
  formatWindow,
  isNewAnomaly,
} from "@/utils/ai-trends";

interface ChartData {
  config: ChartConfig;
  rows: AiTrendsChartRow[];
  logos?: AiTrendsSeriesLogos;
}

const SHARE_STEADY_CHANGE = 0.05;
/** Keeps the longest valid hostname inside the card's title and description limits. */
const SHARE_DOMAIN_CHARS = 60;
const FILE_NAME_PATTERN = /[^a-z0-9]+/g;

/** File-name-safe slug of a card title. */
export function shareFileName(...parts: string[]): string {
  return `notra-${parts
    .join(" ")
    .toLowerCase()
    .replace(FILE_NAME_PATTERN, "-")
    .replace(/^-|-$/g, "")}`;
}

/** Chart rows and config as card series, light-mode colors. */
function cardSeries({ config, rows, logos }: ChartData) {
  return Object.entries(config).map(([key, entry]) => {
    const theme =
      ("theme" in entry ? entry.theme : undefined) ??
      AI_TRENDS_ENGINE_COLORS[0];
    return {
      label: String(entry.label ?? key),
      logo: logos?.[key] ?? null,
      color: theme.light,
      darkColor: theme.dark,
      values: rows.map((row) => {
        const value = row[key];
        return typeof value === "number" ? value : 0;
      }),
    };
  });
}

function anomalyDescription(anomaly: AiTrendsAnomaly, label: string): string {
  if (anomaly.kind === "domainShare") {
    return `${anomaly.domain}'s daily share of all citations in ${label} answers. Compares the last 7 days with the 3 weeks before, on prompts asked in both.`;
  }
  if (anomaly.traffic) {
    return `Daily ${anomaly.kind === "crawlerVisits" ? "visits" : "clicks"} from ${label} on the typical site running the Notra tracker. ${anomalySitesLabel(anomaly)}.`;
  }
  const metric = AI_TRENDS_ENGINE_METRICS.find(
    (item) => item.value === anomaly.kind
  );
  return `${metric?.description ?? ""} Shown for ${label}.`.trim();
}

export function anomalyShareCard(
  anomaly: AiTrendsAnomaly,
  window: AiTrendsWindow,
  chart: ChartData
): AiTrendsShareDraft {
  const label = anomaly.traffic ? anomaly.subject : anomaly.engineLabel;
  return {
    eyebrow: anomaly.engineLabel,
    title: { ...anomalyTitle(anomaly), domain: anomaly.domain ?? undefined },
    description: `${anomalyDescription(anomaly, label)} ${formatWindow(window, true)}.`,
    icons: [{ kind: "engine", engine: anomaly.engine }],
    stats: [
      {
        label: "Last 7 days",
        value: formatAnomalyValue(anomaly.kind, anomaly.recent),
        change: isNewAnomaly(anomaly) ? null : anomaly.change,
        hint: isNewAnomaly(anomaly)
          ? "None in the 3 weeks before"
          : "vs the 3 weeks before",
      },
      {
        label: "3 weeks before",
        value: formatAnomalyValue(anomaly.kind, anomaly.baseline),
        change: null,
        hint: "Baseline",
      },
    ],
    ...anomalyChartFormat(anomaly.kind),
    days: chart.rows.map((row) => row.day),
    markDay: window.recentFrom,
    series: cardSeries({
      ...chart,
      logos: { s0: anomaly.engine },
    }).map((series) => ({ ...series, label })),
  };
}

export function domainShareCard({
  domain,
  engineLabel,
  engine,
  stats,
  window,
  chart,
}: {
  domain: string;
  engine: string | null;
  engineLabel: string | null;
  stats: AiTrendsStat[];
  window: AiTrendsWindow;
  chart: ChartData;
}): AiTrendsShareDraft {
  const longest = stats.at(-1);
  const change = longest ? changeOrNull(longest.value, longest.previous) : null;
  // No comparison (or a zero baseline) is not a steady share.
  let highlight = "share";
  if (longest?.previous === 0 && (longest.value ?? 0) > 0) {
    highlight = "rise";
  } else if (change !== null && change >= SHARE_STEADY_CHANGE) {
    highlight = "rise";
  } else if (change !== null && change <= -SHARE_STEADY_CHANGE) {
    highlight = "decline";
  } else if (change !== null) {
    highlight = "steady share";
  }
  const name =
    domain.length > SHARE_DOMAIN_CHARS
      ? `${domain.slice(0, SHARE_DOMAIN_CHARS - 1)}…`
      : domain;
  return {
    eyebrow: engineLabel ?? "All AI engines",
    title: {
      before: `${name}'s `,
      highlight,
      after: ` in ${engineLabel ?? "AI answers"}`,
      domain: name === domain ? domain : undefined,
    },
    description: `${name}'s daily share of all citations in ${engineLabel ?? "AI engine"} answers across tracked prompts, ${formatWindow(window, true)}.`,
    icons: [
      engine ? { kind: "engine", engine } : { kind: "domain", value: domain },
    ],
    stats: stats.map((stat) => ({
      label: stat.label,
      value: formatShare(stat.value),
      change: changeOrNull(stat.value, stat.previous),
      hint: stat.hint,
    })),
    format: "share",
    axisLabel: "% of citations",
    days: chart.rows.map((row) => row.day),
    markDay: null,
    series: cardSeries(chart),
  };
}

export function seriesShareCard({
  eyebrow,
  title,
  description,
  format,
  axisLabel,
  window,
  chart,
}: Pick<
  AiTrendsShareCard,
  "eyebrow" | "title" | "description" | "format" | "axisLabel"
> & {
  window: AiTrendsWindow;
  chart: ChartData;
}): AiTrendsShareDraft {
  const series = cardSeries(chart);
  return {
    eyebrow,
    title,
    description: `${description} ${formatWindow(window, true)}.`,
    icons: series
      .flatMap((item) =>
        item.logo ? [{ kind: "engine" as const, engine: item.logo }] : []
      )
      .slice(0, 3),
    stats: [],
    format,
    axisLabel,
    days: chart.rows.map((row) => row.day),
    markDay: null,
    series,
  };
}
