import type { aiTrendsTrafficProjectRowSchema } from "@notra/schemas/api/ai-trends-traffic";
import type { ChartConfig } from "@notra/ui/components/ui/chart";
import type { LegendProps, TooltipProps } from "recharts";
import type * as z from "zod";

import type { AI_TRENDS_DAY_OPTIONS } from "@/constants/ai-trends";
import type { aiTrendsShareCardSchema } from "@/schemas/ai-trends";

export type AiTrendsDays = (typeof AI_TRENDS_DAY_OPTIONS)[number];

export type AiTrendsEngineMetric =
  | "queries"
  | "citationRate"
  | "overviewRate"
  | "adRate"
  | "productRate";

export type AiTrendsTrafficKind = "crawler" | "ai_referral";

export type AiTrendsTrafficMetric =
  | "crawlers"
  | "referrals"
  | "purposes"
  | "markdown";

interface AiTrendsMetricOption<T extends string> {
  value: T;
  label: string;
  description: string;
}

export interface AiTrendsEngineMetricOption extends AiTrendsMetricOption<AiTrendsEngineMetric> {
  /** Answers that can show the metric; engines without any are left out. */
  volume: Extract<
    keyof AiTrendsEngine,
    | "answers"
    | "searchedAnswers"
    | "overviewAnswers"
    | "adReported"
    | "productReported"
  >;
}

export interface AiTrendsTrafficMetricOption extends AiTrendsMetricOption<AiTrendsTrafficMetric> {
  visitorType: AiTrendsTrafficKind;
  series: "visits" | "markdown" | "purposes";
  axisLabel: string;
  shareTitle: AiTrendsTitle;
}

export type AiTrendsAnomalyKind =
  | "domainShare"
  | AiTrendsEngineMetric
  | "crawlerVisits"
  | "referralVisits";

/** The UTC day range every series covers; `recentFrom` splits the anomaly windows. */
export interface AiTrendsWindow {
  from: string;
  recentFrom: string;
  toExclusive: string;
}

export interface AiTrendsEngine {
  id: string;
  label: string;
  answers: number;
  citations: number;
  searchedAnswers: number;
  overviewAnswers: number;
  adReported: number;
  productReported: number;
}

/** The counts every engine metric is a ratio of. */
export type AiTrendsMetricCounts = Omit<AiTrendsPeriodTotals, "queriesSquared">;

export interface AiTrendsEngineDay extends AiTrendsMetricCounts {
  day: string;
  engine: string;
}

export interface AiTrendsPoint {
  day: string;
  value: number | null;
}

export interface AiTrendsAnomaly {
  id: string;
  kind: AiTrendsAnomalyKind;
  engine: string;
  engineLabel: string;
  /** Who the headline is about, e.g. "GPT-5.4" or "GPTBot". */
  subject: string;
  domain: string | null;
  /** Ratios are 0–1; the queries metric is an average count per answer. */
  recent: number;
  baseline: number;
  change: number;
  score: number;
  series: AiTrendsPoint[];
  /** Traffic anomalies only: who runs the bot and how widely it moved. */
  traffic?: AiTrendsTrafficStory;
}

interface AiTrendsTrafficStory {
  visitorType: AiTrendsTrafficKind;
  vendor: string | null;
  /** Bot purpose, e.g. "training-crawler"; empty for referrals. */
  purpose: string;
  sites: number;
  sitesMoved: number;
}

export interface AiTrendsTopDomain {
  domain: string;
  citations: number;
  share: number;
  /** Recent and baseline share over prompts asked in both periods, for the change. */
  matchedShare: number;
  baselineShare: number;
  engines: number;
}

export interface AiTrendsAdvertiser {
  advertiser: string;
  brand: string | null;
  answers: number;
  /** Of the answers whose scraper reports ads at all. */
  share: number;
  engines: string[];
}

export interface AiTrendsOverview {
  window: AiTrendsWindow;
  engines: AiTrendsEngine[];
  engineDays: AiTrendsEngineDay[];
  anomalies: AiTrendsAnomaly[];
  topDomains: AiTrendsTopDomain[];
  advertisers: AiTrendsAdvertiser[];
  answers: number;
  citations: number;
  /** The domain explorer's opening chart, read alongside everything else. */
  defaultDomainShare: AiTrendsDomainShare;
}

export interface AiTrendsDomainDay {
  day: string;
  engine: string;
  citations: number;
  total: number;
}

export interface AiTrendsDomainShare {
  domain: string;
  window: AiTrendsWindow;
  days: AiTrendsDomainDay[];
}

export interface AiTrendsTrafficDay {
  day: string;
  /** Empty for the per-day total over every source. */
  visitorType: AiTrendsTrafficKind | "";
  source: string;
  category: string;
  visits: number;
  markdownVisits: number;
  /** Projects that got this traffic that day. */
  projects: number;
  /** The median of those projects' visits; 0 on per-day total rows. */
  medianVisits: number;
}

export interface AiTrendsTrafficSource {
  /** `visitorType:source`, unique across crawlers and referrers. */
  id: string;
  visitorType: AiTrendsTrafficKind;
  source: string;
  label: string;
  category: string;
  /** Last 7 days, every project. */
  visits: number;
  markdownVisits: number;
  sites: number;
  /** The typical site's change, on projects with AI traffic in both periods. */
  change: number | null;
}

/** A source as the traffic chart needs it, summed over the whole window. */
export type AiTrendsTrafficChartSource = Omit<
  AiTrendsTrafficSource,
  "sites" | "change"
>;

export interface AiTrendsTraffic {
  configured: boolean;
  window: AiTrendsWindow;
  /** Projects with AI traffic in the last 7 days. */
  sites: number;
  visits: number;
  days: AiTrendsTrafficDay[];
  sources: AiTrendsTrafficSource[];
  anomalies: AiTrendsAnomaly[];
}

export interface AiTrendsTrafficDayIndex {
  /** Per-day total rows by day. */
  totals: Map<string, AiTrendsTrafficDay>;
  /** Source rows keyed `day|sourceId`. */
  sources: Map<string, AiTrendsTrafficDay>;
}

/** One project's visits from one source in each anomaly period. */
export type AiTrendsTrafficWeekRow = z.infer<
  typeof aiTrendsTrafficProjectRowSchema
>;

export interface AiTrendsTrafficProjectRow {
  projectId: string;
  source: string;
  /** Visits in the last week. */
  recent: number;
  /** Visits in each baseline week, the one just before the last week first. */
  baselineWeeks: number[];
}

export interface AiTrendsTrafficStats {
  source: string;
  /** The median matched site's daily visits last week and in a typical baseline week. */
  recent: number;
  baseline: number;
  /** Between those medians; null when the typical site had no baseline. */
  change: number | null;
  /** Sign-test z-score over the projects that saw the source. */
  score: number;
  /** Matched sites that saw the source in either period, and which way each moved. */
  sites: number;
  sitesUp: number;
  sitesDown: number;
  visits: number;
}

/** Matched-prompt totals per engine for one anomaly period. */
export interface AiTrendsPeriodTotals {
  answers: number;
  citedAnswers: number;
  citations: number;
  queries: number;
  queriesSquared: number;
  searchedAnswers: number;
  overviewAnswers: number;
  overviewAbsent: number;
  adReported: number;
  adShown: number;
  productReported: number;
  productShown: number;
}

export interface AiTrendsEnginePeriodRow {
  engine: string;
  recent: AiTrendsPeriodTotals;
  baseline: AiTrendsPeriodTotals;
}

export interface AiTrendsDomainPeriodRow {
  engine: string;
  domain: string;
  recent: number;
  baseline: number;
}

export interface AiTrendsAnomalyInput {
  engines: AiTrendsEnginePeriodRow[];
  domains: AiTrendsDomainPeriodRow[];
}

/** Answer-data anomalies; traffic has its own candidates. */
export type AiTrendsAnomalyCandidate = Omit<
  AiTrendsAnomaly,
  "id" | "engineLabel" | "subject" | "series" | "kind" | "traffic"
> & { kind: "domainShare" | AiTrendsEngineMetric };

export interface AiTrendsStat {
  label: string;
  hint: string;
  value: number | null;
  previous: number | null;
}

export interface AiTrendsMetricTabsProps<T extends string> {
  metrics: readonly AiTrendsMetricOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export interface AiTrendsChangeProps {
  change: number | null;
  /** Moves below this stay uncolored. */
  threshold?: number;
  /** Shown when there is no change to report. */
  empty?: string;
  className?: string;
}

export interface AiTrendsAnomalyCardProps {
  anomaly: AiTrendsAnomaly;
  /** Engine ids in color order, shared by every chart on the page. */
  engineOrder: readonly string[];
  window: AiTrendsWindow;
  onSelect?: (anomaly: AiTrendsAnomaly) => void;
}

export interface AiTrendsDomainExplorerProps {
  days: AiTrendsDays;
  domain: string;
  /** Null charts every engine that cites the domain. */
  engine: string | null;
  engineOrder: readonly string[];
  suggestions: string[];
  /** The overview's share of `domain`, so the explorer doesn't fetch it again. */
  initialShare?: AiTrendsDomainShare;
  onDomainChange: (domain: string) => void;
  onEngineChange: (engine: string | null) => void;
}

export interface AiTrendsEngineMetricsProps {
  overview: AiTrendsOverview;
}

export interface AiTrendsTopDomainsProps {
  domains: AiTrendsTopDomain[];
  onSelect: (domain: string) => void;
}

/** Engine id or source name per series key, for its logo. */
export type AiTrendsSeriesLogos = Record<string, string>;

export type AiTrendsChartTooltipProps = TooltipProps<number, string> & {
  config: ChartConfig;
  format: (value: number) => string;
  logos?: AiTrendsSeriesLogos;
};

export type AiTrendsChartLegendProps = Pick<LegendProps, "payload"> & {
  config: ChartConfig;
  logos?: AiTrendsSeriesLogos;
};

/** Recharts rows keyed `s0…sN`, since engine ids can't be CSS variable names. */
export type AiTrendsChartRow = { day: string } & Record<
  string,
  number | null | string
>;

export interface AiTrendsSeriesChartProps {
  rows: AiTrendsChartRow[];
  config: ChartConfig;
  format: (value: number) => string;
  formatTick?: (value: number) => string;
  markDay?: string;
  logos?: AiTrendsSeriesLogos;
  compact?: boolean;
}

export interface AiTrendsStatTilesProps {
  stats: AiTrendsStat[];
  format: (value: number | null) => string;
}

export interface AiTrendsTrafficSectionProps {
  days: AiTrendsDays;
}

/** Source ids in color order, one list per visitor type so neither runs out of colors. */
export type AiTrendsTrafficSourceOrder = Record<AiTrendsTrafficKind, string[]>;

export interface AiTrendsTrafficChartProps {
  traffic: AiTrendsTraffic;
  sources: AiTrendsTrafficChartSource[];
  sourceOrder: AiTrendsTrafficSourceOrder;
}

export interface AiTrendsTrafficSourcesProps {
  sources: AiTrendsTrafficSource[];
}

export interface AiTrendsAdvertisersProps {
  advertisers: AiTrendsAdvertiser[];
}

export type AiTrendsShareCard = z.infer<typeof aiTrendsShareCardSchema>;

export type AiTrendsTitle = AiTrendsShareCard["title"];

/**
 * A card as the charts describe it: logos by engine id. The share button
 * swaps them for the SVG the page draws before posting.
 */
export interface AiTrendsShareDraft extends Omit<
  AiTrendsShareCard,
  "icons" | "theme"
> {
  icons: (
    | { kind: "engine"; engine: string }
    | { kind: "domain"; value: string }
  )[];
}

export interface AiTrendsShareButtonProps {
  /** Built on click, so charts don't assemble cards nobody shares. */
  card: () => AiTrendsShareDraft | null;
  /** Base of the downloaded file name. */
  name: string;
  label?: string;
}

export interface AiTrendsShareImage {
  blob: Blob;
  url: string;
}

/** What Recharts passes a custom `dot` renderer. */
export interface AiTrendsChartDotProps {
  cx?: number;
  cy?: number;
  index: number;
}

export interface AiTrendsChartEndDotProps extends AiTrendsChartDotProps {
  last: number;
  color: string;
}
