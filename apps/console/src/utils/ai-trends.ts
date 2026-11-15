import {
  GEO_BRAND_LABELS,
  GEO_ENGINE_LABELS,
} from "@notra/geo-core/constants/geo";
import { engineModelOf } from "@notra/geo-core/utils/geo-engine-family";
import { formatModelSlug } from "@notra/geo-core/utils/geo-model-label";
import type { ChartConfig } from "@notra/ui/components/ui/chart";

import {
  AI_TRENDS_AGENT_PROVIDERS,
  AI_TRENDS_BASELINE_DAYS,
  AI_TRENDS_CERTAIN_SCORE,
  AI_TRENDS_HOST_PREFIXES,
  AI_TRENDS_ENGINE_COLORS,
  AI_TRENDS_MAX_ANOMALIES,
  AI_TRENDS_MAX_ANOMALIES_PER_ENGINE,
  AI_TRENDS_MIN_ANSWERS,
  AI_TRENDS_MIN_DOMAIN_CITATIONS,
  AI_TRENDS_MIN_DOMAIN_SHARE,
  AI_TRENDS_MIN_ENGINE_CITATIONS,
  AI_TRENDS_CHANGE_EPSILON,
  AI_TRENDS_MIN_METRIC_CHANGE,
  AI_TRENDS_MIN_RELATIVE_CHANGE,
  AI_TRENDS_MIN_SCORE,
  AI_TRENDS_NEUTRAL_CHANGE,
  AI_TRENDS_RECENT_DAYS,
  AI_TRENDS_TABLE_MAX_HEIGHT,
  AI_TRENDS_TABLE_ROW_HEIGHT,
} from "@/constants/ai-trends";
import type {
  AiTrendsAnomaly,
  AiTrendsAnomalyCandidate,
  AiTrendsAnomalyInput,
  AiTrendsAnomalyKind,
  AiTrendsChartRow,
  AiTrendsDomainDay,
  AiTrendsEngineDay,
  AiTrendsEngineMetric,
  AiTrendsMetricCounts,
  AiTrendsPeriodTotals,
  AiTrendsPoint,
  AiTrendsSeriesLogos,
  AiTrendsShareCard,
  AiTrendsStat,
  AiTrendsTitle,
  AiTrendsWindow,
} from "@/types/ai-trends";
import { formatVisits } from "@/utils/ai-trends-traffic";
import { formatChartDay } from "@/utils/site-charts";

const DAY_MS = 24 * 60 * 60 * 1000;

function ownLabel(labels: Record<string, string>, key: string) {
  return Object.hasOwn(labels, key) ? labels[key] : undefined;
}

/**
 * Who answered and on which surface. Grounded variants share their model's
 * name, and coding agents run the same models as the APIs, so `surface` says
 * which one answered.
 */
export function aiTrendsEngineName(engine: string): {
  name: string;
  surface: string | null;
} {
  const [provider = "", ...rest] = engine.split("/");
  const model = rest.join("/");
  const label = ownLabel(GEO_ENGINE_LABELS, engine);
  const agent = AI_TRENDS_AGENT_PROVIDERS.some((id) => id === provider)
    ? ownLabel(GEO_BRAND_LABELS, provider)
    : undefined;
  if (agent) {
    return { name: agent, surface: label ?? formatModelSlug(model) };
  }
  const base = engineModelOf(engine);
  return {
    // Models newer than the catalog read like the catalog's labels.
    name: label ?? formatModelSlug(base.slice(base.indexOf("/") + 1)),
    surface: base === engine ? null : "Web search",
  };
}

export function aiTrendsEngineLabel(engine: string): string {
  const { name, surface } = aiTrendsEngineName(engine);
  return surface ? `${name} · ${surface}` : name;
}

/** Axis ticks need no more precision than their step. */
export function formatShareTick(value: number): string {
  const percent = value * 100;
  if (Number.isInteger(percent) || percent >= 10) {
    return `${Math.round(percent)}%`;
  }
  // Below 1% two significant digits keep 0.01% and 0.02% apart.
  return `${percent >= 1 ? percent.toFixed(1) : Number(percent.toPrecision(2))}%`;
}

/** Count axis ticks: whole numbers bare, steps between them to one decimal. */
export function formatCountTick(value: number): string {
  if (Number.isInteger(value)) {
    return value.toLocaleString("en");
  }
  // Low-volume steps like 0.02 and 0.04 need the second decimal to differ.
  return value.toFixed(value < 1 ? 2 : 1);
}

const URL_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//;
const URL_TAIL = /[/:?#].*$/;
const HOST_PREFIX = new RegExp(`^(${AI_TRENDS_HOST_PREFIXES.join("|")})\\.`);

/** A typed domain or pasted URL as citation domains are stored: bare host, no `www.`. */
export function normalizeTrendsDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(URL_SCHEME, "")
    .replace(URL_TAIL, "")
    .replace(HOST_PREFIX, "");
}

export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** `days` ending before `toExclusive`; the last week is the anomaly period. */
export function trendsWindow(
  toExclusive: string,
  days: number
): AiTrendsWindow {
  return {
    from: addDays(toExclusive, -days),
    recentFrom: addDays(toExclusive, -AI_TRENDS_RECENT_DAYS),
    toExclusive,
  };
}

/** "Aug 26 – Oct 24", with the year for images that leave the app. */
export function formatWindow(
  window: Pick<AiTrendsWindow, "from" | "toExclusive">,
  withYear = false
): string {
  const last = addDays(window.toExclusive, -1);
  const range = `${formatChartDay(window.from)} – ${formatChartDay(last)}`;
  return withYear ? `${range}, ${last.slice(0, 4)}` : range;
}

/** Every UTC day in `[from, toExclusive)`, so missing days still get a point. */
export function dayRange(from: string, toExclusive: string): string[] {
  const days: string[] = [];
  for (let day = from; day < toExclusive; day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

/** Two-proportion z-score; 0 when either side has no sample. */
function proportionScore(
  recentHits: number,
  recentTotal: number,
  baselineHits: number,
  baselineTotal: number
): number {
  if (recentTotal <= 0 || baselineTotal <= 0) {
    return 0;
  }
  const pooled = (recentHits + baselineHits) / (recentTotal + baselineTotal);
  const error = Math.sqrt(
    pooled * (1 - pooled) * (1 / recentTotal + 1 / baselineTotal)
  );
  if (error === 0) {
    return 0;
  }
  return (recentHits / recentTotal - baselineHits / baselineTotal) / error;
}

/** Welch z-score of the mean search queries per searched answer. */
function meanScore(
  recent: AiTrendsPeriodTotals,
  baseline: AiTrendsPeriodTotals
): number {
  const variance = (totals: AiTrendsPeriodTotals) => {
    const mean = totals.queries / totals.searchedAnswers;
    return Math.max(
      totals.queriesSquared / totals.searchedAnswers - mean ** 2,
      0
    );
  };
  const error = Math.sqrt(
    variance(recent) / recent.searchedAnswers +
      variance(baseline) / baseline.searchedAnswers
  );
  const difference =
    recent.queries / recent.searchedAnswers -
    baseline.queries / baseline.searchedAnswers;
  // No spread on either side: any difference in the means is certain.
  if (error === 0) {
    return Math.sign(difference) * AI_TRENDS_CERTAIN_SCORE;
  }
  return difference / error;
}

/** Whether a change is at least `min` in size, ignoring float error. */
export function reachesChange(change: number, min: number): boolean {
  return Math.abs(change) >= min - AI_TRENDS_CHANGE_EPSILON;
}

function relativeChange(recent: number, baseline: number): number {
  return baseline > 0 ? (recent - baseline) / baseline : 0;
}

function metricCandidate(
  kind: AiTrendsEngineMetric,
  engine: string,
  recent: number,
  baseline: number,
  score: number
): AiTrendsAnomalyCandidate | null {
  // Something the engine never did before counts as a full rise, like a new domain.
  const change =
    baseline > 0 ? relativeChange(recent, baseline) : Math.sign(recent);
  if (
    !reachesChange(change, AI_TRENDS_MIN_METRIC_CHANGE) ||
    Math.abs(score) < AI_TRENDS_MIN_SCORE
  ) {
    return null;
  }
  return { kind, engine, domain: null, recent, baseline, change, score };
}

const RATE_METRICS = [
  "citationRate",
  "adRate",
  "productRate",
  "overviewRate",
] as const;

/** Hits and the answers they're out of, for each rate metric. */
const RATE_COUNTS: Record<
  (typeof RATE_METRICS)[number],
  (counts: AiTrendsMetricCounts) => [hits: number, total: number]
> = {
  citationRate: (counts) => [counts.citedAnswers, counts.answers],
  adRate: (counts) => [counts.adShown, counts.adReported],
  productRate: (counts) => [counts.productShown, counts.productReported],
  overviewRate: (counts) => [
    counts.overviewAnswers - counts.overviewAbsent,
    counts.overviewAnswers,
  ],
};

/** A rate, once both periods have enough answers to report it. */
function rateCandidate(
  kind: (typeof RATE_METRICS)[number],
  engine: string,
  recent: AiTrendsPeriodTotals,
  baseline: AiTrendsPeriodTotals
): AiTrendsAnomalyCandidate | null {
  const [recentHits, recentTotal] = RATE_COUNTS[kind](recent);
  const [baselineHits, baselineTotal] = RATE_COUNTS[kind](baseline);
  if (
    recentTotal < AI_TRENDS_MIN_ANSWERS ||
    baselineTotal < AI_TRENDS_MIN_ANSWERS ||
    recentHits + baselineHits === 0
  ) {
    return null;
  }
  return metricCandidate(
    kind,
    engine,
    recentHits / recentTotal,
    baselineHits / baselineTotal,
    proportionScore(recentHits, recentTotal, baselineHits, baselineTotal)
  );
}

function engineCandidates(
  engine: string,
  recent: AiTrendsPeriodTotals,
  baseline: AiTrendsPeriodTotals
): AiTrendsAnomalyCandidate[] {
  const candidates = RATE_METRICS.map((kind) =>
    rateCandidate(kind, engine, recent, baseline)
  );
  if (
    recent.searchedAnswers >= AI_TRENDS_MIN_ANSWERS &&
    baseline.searchedAnswers >= AI_TRENDS_MIN_ANSWERS
  ) {
    candidates.push(
      metricCandidate(
        "queries",
        engine,
        recent.queries / recent.searchedAnswers,
        baseline.queries / baseline.searchedAnswers,
        meanScore(recent, baseline)
      )
    );
  }
  return candidates.filter((candidate) => candidate !== null);
}

/**
 * Ranks the changes between the two anomaly periods by how unlikely they are
 * under no change. Inputs only cover prompts asked in both periods, so a
 * customer adding or deleting prompts doesn't read as an engine change.
 */
export function detectAnomalies({
  engines,
  domains,
}: AiTrendsAnomalyInput): AiTrendsAnomalyCandidate[] {
  const totals = new Map(engines.map((row) => [row.engine, row]));
  const candidates: AiTrendsAnomalyCandidate[] = engines.flatMap((row) =>
    engineCandidates(row.engine, row.recent, row.baseline)
  );

  for (const row of domains) {
    const engine = totals.get(row.engine);
    const recentTotal = engine?.recent.citations ?? 0;
    const baselineTotal = engine?.baseline.citations ?? 0;
    if (
      recentTotal < AI_TRENDS_MIN_ENGINE_CITATIONS ||
      baselineTotal < AI_TRENDS_MIN_ENGINE_CITATIONS ||
      row.recent + row.baseline < AI_TRENDS_MIN_DOMAIN_CITATIONS
    ) {
      continue;
    }
    const recent = row.recent / recentTotal;
    const baseline = row.baseline / baselineTotal;
    if (Math.max(recent, baseline) < AI_TRENDS_MIN_DOMAIN_SHARE) {
      continue;
    }
    // A domain new to an engine has no baseline share to be relative to.
    const change = baseline > 0 ? relativeChange(recent, baseline) : 1;
    const score = proportionScore(
      row.recent,
      recentTotal,
      row.baseline,
      baselineTotal
    );
    if (
      !reachesChange(change, AI_TRENDS_MIN_RELATIVE_CHANGE) ||
      Math.abs(score) < AI_TRENDS_MIN_SCORE
    ) {
      continue;
    }
    candidates.push({
      kind: "domainShare",
      engine: row.engine,
      domain: row.domain,
      recent,
      baseline,
      change,
      score,
    });
  }

  const perEngine = new Map<string, number>();
  return candidates
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .filter((candidate) => {
      const count = perEngine.get(candidate.engine) ?? 0;
      if (count >= AI_TRENDS_MAX_ANOMALIES_PER_ENGINE) {
        return false;
      }
      perEngine.set(candidate.engine, count + 1);
      return true;
    })
    .slice(0, AI_TRENDS_MAX_ANOMALIES);
}

function engineMetricValue(
  day: AiTrendsEngineDay,
  metric: AiTrendsEngineMetric
): number | null {
  return metric === "queries"
    ? ratio(day.queries, day.searchedAnswers)
    : ratio(...RATE_COUNTS[metric](day));
}

/** One engine's daily metric over the whole window, with gaps as null. */
export function engineMetricSeries(
  engineDays: AiTrendsEngineDay[],
  engine: string,
  metric: AiTrendsEngineMetric,
  days: string[]
): AiTrendsPoint[] {
  const byDay = new Map(
    engineDays
      .filter((row) => row.engine === engine)
      .map((row) => [row.day, row])
  );
  return days.map((day) => {
    const row = byDay.get(day);
    return { day, value: row ? engineMetricValue(row, metric) : null };
  });
}

/**
 * Daily share of citations that went to the domain, for one engine or, with
 * `engine` null, for every engine that cites it.
 */
export function domainShareSeries(
  rows: AiTrendsDomainDay[],
  engine: string | null,
  days: string[]
): AiTrendsPoint[] {
  const byDay = new Map<string, { citations: number; total: number }>();
  for (const row of rows) {
    if (engine !== null && row.engine !== engine) {
      continue;
    }
    const entry = byDay.get(row.day) ?? { citations: 0, total: 0 };
    entry.citations += row.citations;
    entry.total += row.total;
    byDay.set(row.day, entry);
  }
  return days.map((day) => {
    const entry = byDay.get(day);
    return { day, value: entry ? ratio(entry.citations, entry.total) : null };
  });
}

function windowShare(
  rows: AiTrendsDomainDay[],
  from: string,
  toExclusive: string
): number | null {
  let citations = 0;
  let total = 0;
  for (const row of rows) {
    if (row.day >= from && row.day < toExclusive) {
      citations += row.citations;
      total += row.total;
    }
  }
  return ratio(citations, total);
}

/** Share over trailing periods against the equally long period before each. */
export function domainShareStats(
  rows: AiTrendsDomainDay[],
  engine: string | null,
  toExclusive: string,
  periods: readonly number[]
): AiTrendsStat[] {
  const engineRows =
    engine === null ? rows : rows.filter((row) => row.engine === engine);
  return periods.map((period) => {
    const from = addDays(toExclusive, -period);
    return {
      label: `Past ${period} days`,
      hint: `Share of citations · vs previous ${period} days`,
      value: windowShare(engineRows, from, toExclusive),
      previous: windowShare(engineRows, addDays(from, -period), from),
    };
  });
}

export function formatShare(value: number | null): string {
  if (value === null) {
    return "–";
  }
  const percent = value * 100;
  return `${percent.toFixed(percent < 10 ? 2 : 1)}%`;
}

/**
 * Size of a change without its sign: "40%" below a doubling, then "2×" or
 * "3.5×", since "+250%" reads worse than "3.5×".
 */
export function formatChangeAmount(change: number): string {
  const percent = Math.round(Math.abs(change) * 100);
  if (change <= 0 || percent < 100) {
    return `${percent}%`;
  }
  const multiple = 1 + change;
  return `${multiple >= 10 ? Math.round(multiple) : Number(multiple.toFixed(1))}×`;
}

export function formatChange(change: number): string {
  const amount = formatChangeAmount(change);
  if (amount.endsWith("×") || amount === "0%") {
    return amount;
  }
  return `${change > 0 ? "+" : "-"}${amount}`;
}

/** Relative change, or null when there is nothing to compare against. */
export function changeOrNull(
  value: number | null,
  previous: number | null
): number | null {
  return value !== null && previous !== null && previous > 0
    ? (value - previous) / previous
    : null;
}

/** Text color for a change; moves under `threshold` stay neutral. */
export function changeTone(
  change: number | null,
  threshold: number = AI_TRENDS_NEUTRAL_CHANGE
): string {
  if (change === null || Math.abs(change) < threshold) {
    return "text-muted-foreground";
  }
  return change > 0 ? "text-geo-up" : "text-geo-down";
}

const formatQueries = (value: number) => value.toFixed(1);

/** Value and axis-tick formatters for each share-card format. */
const FORMATS: Record<
  AiTrendsShareCard["format"],
  { value: (value: number) => string; tick: (value: number) => string }
> = {
  share: { value: formatShare, tick: formatShareTick },
  count: { value: formatQueries, tick: formatQueries },
  visits: { value: formatVisits, tick: formatCountTick },
};

function amountMore(change: number, fewer = "less"): string {
  return `${formatChangeAmount(change)} ${change > 0 ? "more" : fewer}`;
}

/** "{subject} {verb} {N% more|less} {after}", the shape most headlines take. */
function moved(
  subject: string,
  verb: string,
  change: number,
  after = "",
  fewer?: string
): AiTrendsTitle {
  return {
    before: `${subject} ${verb} `,
    highlight: amountMore(change, fewer),
    after,
  };
}

/** What a crawler's visits say about its operator, by bot purpose. */
const CRAWLER_VERBS: Record<
  string,
  [verb: string, after: string, fewer?: string]
> = {
  "training-crawler": ["crawls", " for training"],
  "search-index": ["crawls", " for its search index"],
  "assistant-browse": ["fetches", " pages for live answers", "fewer"],
};

/** How each anomaly kind formats, charts and reads as a headline. */
const ANOMALY_KINDS: Record<
  AiTrendsAnomalyKind,
  Pick<AiTrendsShareCard, "format" | "axisLabel"> & {
    title: (anomaly: AiTrendsAnomaly) => AiTrendsTitle;
  }
> = {
  domainShare: {
    format: "share",
    axisLabel: "% of citations",
    title: ({ subject, domain, change }) =>
      moved(subject, `cites ${domain}`, change),
  },
  queries: {
    format: "count",
    axisLabel: "Searches per answer",
    title: ({ subject, change }) =>
      moved(subject, "runs", change, " searches per answer", "fewer"),
  },
  citationRate: {
    format: "share",
    axisLabel: "% of answers",
    title: ({ subject, change }) =>
      moved(subject, "cites sources", change, " often"),
  },
  adRate: {
    format: "share",
    axisLabel: "% of answers",
    title: ({ subject, change }) =>
      moved(subject, "shows ads", change, " often"),
  },
  productRate: {
    format: "share",
    axisLabel: "% of answers",
    title: ({ subject, change }) =>
      moved(subject, "shows shopping results", change, " often"),
  },
  overviewRate: {
    format: "share",
    axisLabel: "% of searches",
    title: ({ change }) =>
      moved("Google", "shows AI Overviews", change, " often"),
  },
  crawlerVisits: {
    format: "visits",
    axisLabel: "Visits per site",
    title: ({ subject, change, traffic }) => {
      const [verb, after, fewer] = CRAWLER_VERBS[traffic?.purpose ?? ""] ?? [
        "crawls",
        "",
      ];
      return moved(traffic?.vendor ?? subject, verb, change, after, fewer);
    },
  },
  referralVisits: {
    format: "visits",
    axisLabel: "Clicks per site",
    title: ({ subject, change }) =>
      moved(subject, "sends", change, " visitors", "fewer"),
  },
};

/** Value and tick formatters for a share-card format. */
export function chartFormatters(format: AiTrendsShareCard["format"]) {
  return FORMATS[format];
}

export function formatAnomalyValue(
  kind: AiTrendsAnomalyKind,
  value: number | null
): string {
  return value === null
    ? "–"
    : FORMATS[ANOMALY_KINDS[kind].format].value(value);
}

export function formatAnomalyTick(
  kind: AiTrendsAnomalyKind,
  value: number
): string {
  return FORMATS[ANOMALY_KINDS[kind].format].tick(value);
}

/** Share-card format and y-axis label for an anomaly kind. */
export function anomalyChartFormat(
  kind: AiTrendsAnomalyKind
): Pick<AiTrendsShareCard, "format" | "axisLabel"> {
  const { format, axisLabel } = ANOMALY_KINDS[kind];
  return { format, axisLabel };
}

/**
 * The story an anomaly tells, e.g. "Anthropic crawls 100% more for training"
 * or "GPT-5.4 cites reddit.com 54% less". `highlight` is the moving part.
 */
export function anomalyTitle(anomaly: AiTrendsAnomaly): AiTrendsTitle {
  const title = ANOMALY_KINDS[anomaly.kind].title(anomaly);
  // Nothing to compare against, so "2× more" would be made up. Only domains
  // and shown-rates can start from zero, and their tails are "" or " often".
  return isNewAnomaly(anomaly)
    ? {
        before: title.before,
        highlight: `for the first time in ${AI_TRENDS_BASELINE_DAYS / 7} weeks`,
        after: "",
      }
    : title;
}

/** Something the baseline period never saw, like a newly cited domain. */
export function isNewAnomaly(anomaly: AiTrendsAnomaly): boolean {
  return anomaly.baseline === 0 && anomaly.change > 0;
}

/** The change badge: "New" when there was nothing before to compare with. */
export function formatAnomalyChange(anomaly: AiTrendsAnomaly): string {
  return isNewAnomaly(anomaly) ? "New" : formatChange(anomaly.change);
}

export function anomalyHeadline(anomaly: AiTrendsAnomaly): string {
  const { before, highlight, after } = anomalyTitle(anomaly);
  return `${before}${highlight}${after}`;
}

/** "Up on 31 of 38 sites" for traffic anomalies, null otherwise. */
export function anomalySitesLabel(anomaly: AiTrendsAnomaly): string | null {
  if (!anomaly.traffic) {
    return null;
  }
  const { sitesMoved, sites } = anomaly.traffic;
  return `${anomaly.change > 0 ? "Up" : "Down"} on ${sitesMoved} of ${sites} sites`;
}

/**
 * Chart config keyed `s0…` so ids never hit CSS. Colors follow the engine's
 * place in `order`, so an engine keeps its color across every chart.
 */
export function seriesChartConfig(
  series: { id: string; label: string }[],
  order: readonly string[]
): ChartConfig {
  return Object.fromEntries(
    series.map((item, index) => {
      const rank = order.indexOf(item.id);
      const slot = rank === -1 ? order.length + index : rank;
      return [
        `s${index}`,
        {
          label: item.label,
          theme:
            AI_TRENDS_ENGINE_COLORS[slot % AI_TRENDS_ENGINE_COLORS.length] ??
            AI_TRENDS_ENGINE_COLORS[0],
        },
      ];
    })
  );
}

/** Logo keys for `seriesChartConfig` series, keyed the same way. */
export function seriesLogos(
  series: readonly { logo?: string | null }[]
): AiTrendsSeriesLogos {
  return Object.fromEntries(
    series.flatMap((item, index) =>
      item.logo ? [[`s${index}`, item.logo]] : []
    )
  );
}

/**
 * Zips same-length day series into Recharts rows keyed like `seriesChartConfig`.
 * Days without data chart as 0, so a line never starts mid-chart or breaks.
 */
export function seriesChartRows(series: AiTrendsPoint[][]): AiTrendsChartRow[] {
  const first = series[0] ?? [];
  return first.map((point, index) => {
    const row: AiTrendsChartRow = { day: point.day };
    series.forEach((points, seriesIndex) => {
      row[`s${seriesIndex}`] = points[index]?.value ?? 0;
    });
    return row;
  });
}

/** Engines citing the domain, most citations first. */
export function citingEngines(rows: AiTrendsDomainDay[]) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.engine, (totals.get(row.engine) ?? 0) + row.citations);
  }
  return [...totals.entries()]
    .filter(([, citations]) => citations > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([engine]) => ({ id: engine, label: aiTrendsEngineLabel(engine) }));
}

/** Header plus every row, capped so long tables scroll inside their frame. */
export function aiTrendsTableHeight(rows: number): number {
  return Math.min(
    AI_TRENDS_TABLE_MAX_HEIGHT,
    (Math.max(rows, 1) + 1) * AI_TRENDS_TABLE_ROW_HEIGHT
  );
}
