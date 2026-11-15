import type {
  AiTrendsAnomalyKind,
  AiTrendsEngineMetricOption,
  AiTrendsTrafficKind,
  AiTrendsTrafficMetricOption,
} from "@/types/ai-trends";

export const AI_TRENDS_DAY_OPTIONS = [30, 60, 90] as const;
export const AI_TRENDS_DEFAULT_DAYS =
  60 satisfies (typeof AI_TRENDS_DAY_OPTIONS)[number];
export const AI_TRENDS_DEFAULT_DOMAIN = "reddit.com";

/** Anomalies compare the last week against the three weeks before it. */
export const AI_TRENDS_RECENT_DAYS = 7;

/** Trailing periods the domain explorer compares with the period before each. */
export const AI_TRENDS_DOMAIN_STAT_PERIODS = [7, 30] as const;
export const AI_TRENDS_BASELINE_DAYS = 21;
/** AI traffic compares each site's last week with its typical baseline week. */
export const AI_TRENDS_BASELINE_WEEKS =
  AI_TRENDS_BASELINE_DAYS / AI_TRENDS_RECENT_DAYS;

/** Server results are global and slow-moving, so one computation serves everyone. */
export const AI_TRENDS_CACHE_SECONDS = 30 * 60;
export const AI_TRENDS_STALE_MS = 10 * 60 * 1000;

/** Below these sample sizes a daily share is noise, not a trend. */
export const AI_TRENDS_MIN_ENGINE_CITATIONS = 100;
export const AI_TRENDS_MIN_DOMAIN_CITATIONS = 20;
export const AI_TRENDS_MIN_DOMAIN_SHARE = 0.005;
export const AI_TRENDS_MIN_ANSWERS = 50;
export const AI_TRENDS_MIN_RELATIVE_CHANGE = 0.3;
export const AI_TRENDS_MIN_METRIC_CHANGE = 0.2;
export const AI_TRENDS_MIN_SCORE = 3;
/** Float slack so a change of exactly 20% (0.6 / 0.5 − 1 = 0.1999…) still counts. */
export const AI_TRENDS_CHANGE_EPSILON = 1e-9;
/** Score for a difference with no spread on either side, e.g. constant search counts. */
export const AI_TRENDS_CERTAIN_SCORE = 100;
export const AI_TRENDS_MAX_ANOMALIES = 12;
export const AI_TRENDS_MAX_ANOMALIES_PER_ENGINE = 4;
export const AI_TRENDS_TOP_DOMAINS = 25;
export const AI_TRENDS_TOP_ADVERTISERS = 15;
export const AI_TRENDS_MAX_CHART_ENGINES = 6;

/**
 * Redirect hosts that stand in for the real page, e.g. Gemini's grounding
 * links. Counting them would put Google on top of every engine it serves.
 */
export const AI_TRENDS_IGNORED_DOMAINS = [
  "vertexaisearch.cloud.google.com",
] as const;

/** Engines that record a row when Google showed no AI Overview. */
export const AI_TRENDS_OVERVIEW_ENGINES = ["google/ai-overview"] as const;

/** Coding agents whose engine ids reuse API model names. */
export const AI_TRENDS_AGENT_PROVIDERS = [
  "claude-code",
  "codex",
  "cursor",
  "opencode",
  "fx",
] as const;

/** Below this a share moved too little to color it up or down. */
export const AI_TRENDS_NEUTRAL_CHANGE = 0.01;

/** Mobile and legacy hosts collapse into the site they belong to. */
export const AI_TRENDS_HOST_PREFIXES = [
  "www",
  "m",
  "old",
  "new",
  "amp",
] as const;

/**
 * The dashboard's chart colors: primary violet, secondary teal and referral
 * amber lead, so engines read the same here as in the product. Up/down stay
 * green/red and never lead.
 */
export const AI_TRENDS_ENGINE_COLORS = [
  { light: "#8B5CF6", dark: "#9C87E3" },
  { light: "#18929F", dark: "#20ABBA" },
  { light: "#E89A1C", dark: "#FFB547" },
  { light: "#D9488F", dark: "#F06AAE" },
  { light: "#3F7FE0", dark: "#6CA2F2" },
  { light: "#6B6B75", dark: "#9A9AA4" },
] as const;

/** Peak opacity of a series' gradient fill, as in the dashboard's area charts. */
export const AI_TRENDS_FILL_ALPHA = 0.24;
/** Above this many series, fills stack into mud; lines stay readable. */
export const AI_TRENDS_MAX_FILLED_SERIES = 3;

export const AI_TRENDS_ENGINE_METRICS: readonly AiTrendsEngineMetricOption[] = [
  {
    value: "queries",
    volume: "searchedAnswers",
    label: "Search queries",
    description:
      "Average web searches per answer that searched. Notra stores at most 8 per answer, so higher fan-out reads as 8.",
  },
  {
    value: "citationRate",
    volume: "answers",
    label: "Answers with citations",
    description: "Share of answers that cite at least one source.",
  },
  {
    value: "adRate",
    volume: "adReported",
    label: "Ads",
    description:
      "Share of answers with at least one sponsored block, on consumer apps whose scraper reports ads.",
  },
  {
    value: "productRate",
    volume: "productReported",
    label: "Shopping",
    description:
      "Share of answers with product or shopping cards, on consumer apps whose scraper reports them.",
  },
  {
    value: "overviewRate",
    volume: "overviewAnswers",
    label: "AI Overview shown",
    description: "Share of Google searches that showed an AI Overview at all.",
  },
];

/**
 * A traffic source needs this many sites and visits before its trend means
 * anything; one site's crawl sweep is not a trend. With five sites a
 * unanimous move scores 2.2.
 */
export const AI_TRENDS_TRAFFIC_MIN_SITES = 5;
export const AI_TRENDS_TRAFFIC_MIN_VISITS = 100;
export const AI_TRENDS_TRAFFIC_MIN_SCORE = 2;
export const AI_TRENDS_TRAFFIC_MAX_ANOMALIES = 6;
export const AI_TRENDS_TRAFFIC_TOP_SOURCES = 25;

export const AI_TRENDS_TRAFFIC_PURPOSES = [
  "training-crawler",
  "search-index",
  "assistant-browse",
] as const;

export const AI_TRENDS_TRAFFIC_METRICS: readonly AiTrendsTrafficMetricOption[] =
  [
    {
      value: "crawlers",
      visitorType: "crawler",
      series: "visits",
      label: "Crawlers",
      axisLabel: "Visits per site",
      shareTitle: {
        before: "AI ",
        highlight: "crawler visits",
        after: " per site",
      },
      description:
        "Daily visits from each AI crawler on the typical site it reached, so one big site can't set the line.",
    },
    {
      value: "referrals",
      visitorType: "ai_referral",
      series: "visits",
      label: "Referrals",
      axisLabel: "Clicks per site",
      shareTitle: {
        before: "Clicks per site from ",
        highlight: "AI answers",
        after: "",
      },
      description:
        "Daily clicks from AI answers on the typical site they reached, so one big site can't set the line.",
    },
    {
      value: "purposes",
      visitorType: "crawler",
      series: "purposes",
      label: "Purpose",
      axisLabel: "% of crawler visits",
      shareTitle: {
        before: "What AI crawlers ",
        highlight: "collect pages for",
        after: "",
      },
      description:
        "Share of AI crawler visits by what the crawler collects pages for.",
    },
    {
      value: "markdown",
      visitorType: "crawler",
      series: "markdown",
      label: "Markdown",
      axisLabel: "% of visits",
      shareTitle: {
        before: "AI crawlers asking for ",
        highlight: "Markdown",
        after: "",
      },
      description:
        "Share of each crawler's visits that asked for Markdown instead of HTML.",
    },
  ];

/** Matches the dashboard's table rhythm. */
export const AI_TRENDS_TABLE_ROW_HEIGHT = 52;
export const AI_TRENDS_TABLE_MAX_HEIGHT = 420;

/** Share images render at this size, wide enough for X and LinkedIn crops. */
export const AI_TRENDS_CARD_WIDTH = 1600;
export const AI_TRENDS_CARD_HEIGHT = 1000;
export const AI_TRENDS_CARD_LOGO_TIMEOUT_MS = 2500;
export const AI_TRENDS_CARD_LOGO_CACHE_SIZE = 500;

/** The dashboard's dualtone surfaces (`--table-shell`, `--table-card`) per theme. */
export const AI_TRENDS_CARD_THEMES = {
  light: {
    shell: "#F3F3F2",
    shellBorder: "#E7E7E5",
    card: "#FFFFFF",
    cardBorder: "#E5E5E5",
    shadow:
      "0 1px 2px rgba(23,23,28,0.06), 0 8px 24px -8px rgba(23,23,28,0.10)",
    text: "#171717",
    muted: "#62626B",
    grid: "#EFEFEE",
    tick: "#D4D4D2",
    brand: "#8B5CF6",
    marker: "#EEE7FE",
    up: "#15803D",
    upSoft: "#DCFCE7",
    down: "#DC2626",
    downSoft: "#FEE2E2",
    band: "rgba(139,92,246,0.06)",
    /** The Notra mark keeps its own colors; on dark it sits on a white tile. */
    markTile: false,
  },
  dark: {
    shell: "#161616",
    shellBorder: "#232323",
    card: "#1F1F1F",
    cardBorder: "#2C2C2C",
    shadow: "0 1px 2px rgba(0,0,0,0.4)",
    text: "#FAFAFA",
    muted: "#A3A3AD",
    grid: "#2A2A2A",
    tick: "#3A3A3A",
    brand: "#A78BFA",
    marker: "#2E2547",
    up: "#4ADE80",
    upSoft: "#14321F",
    down: "#F87171",
    downSoft: "#3A1717",
    band: "rgba(167,139,250,0.08)",
    markTile: true,
  },
} as const;

export const AI_TRENDS_SHARE_PATH = "/api/ai-trends/share";
