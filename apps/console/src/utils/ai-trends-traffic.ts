import { formatGeoSource } from "@notra/geo-core/utils/ai-traffic";

import {
  AI_TRENDS_BASELINE_WEEKS,
  AI_TRENDS_MIN_RELATIVE_CHANGE,
  AI_TRENDS_RECENT_DAYS,
  AI_TRENDS_TRAFFIC_MAX_ANOMALIES,
  AI_TRENDS_TRAFFIC_MIN_SCORE,
  AI_TRENDS_TRAFFIC_MIN_SITES,
  AI_TRENDS_TRAFFIC_MIN_VISITS,
} from "@/constants/ai-trends";
import type {
  AiTrendsPoint,
  AiTrendsTrafficChartSource,
  AiTrendsTrafficDay,
  AiTrendsTrafficDayIndex,
  AiTrendsTrafficKind,
  AiTrendsTrafficProjectRow,
  AiTrendsTrafficStats,
} from "@/types/ai-trends";
import { reachesChange } from "@/utils/ai-trends";
import { median } from "@/utils/site-charts";

export function trafficSourceId(
  visitorType: AiTrendsTrafficKind,
  source: string
): string {
  return `${visitorType}:${source}`;
}

/**
 * The typical site's daily visits from every source, over the projects that
 * had AI traffic in both periods. Comparing the same sites keeps a customer
 * installing the tracker from reading as a crawler surge, and medians keep
 * one site with 10× everyone's traffic from setting the number.
 *
 * Every number compares one week with a typical week, never one week with a
 * three-week average: crawlers visit in bursts, and three weeks catch a burst
 * far more often than one, which made every bursty bot look like it slowed
 * down. `score` is a sign test of each site's last week against its median
 * baseline week, so a single site's crawl sweep can't carry a trend either.
 */
export function trafficPeriodStats(
  rows: AiTrendsTrafficProjectRow[]
): Map<string, AiTrendsTrafficStats> {
  const projectTotals = new Map<string, { recent: number; baseline: number }>();
  for (const row of rows) {
    const totals = projectTotals.get(row.projectId) ?? {
      recent: 0,
      baseline: 0,
    };
    totals.recent += row.recent;
    totals.baseline += sum(row.baselineWeeks);
    projectTotals.set(row.projectId, totals);
  }
  const matched = new Set(
    [...projectTotals.entries()]
      .filter(([, totals]) => totals.recent > 0 && totals.baseline > 0)
      .map(([projectId]) => projectId)
  );

  const bySource = new Map<string, AiTrendsTrafficProjectRow[]>();
  for (const row of rows) {
    if (
      matched.has(row.projectId) &&
      (row.recent > 0 || sum(row.baselineWeeks) > 0)
    ) {
      const sites = bySource.get(row.source);
      if (sites) {
        sites.push(row);
      } else {
        bySource.set(row.source, [row]);
      }
    }
  }

  const result = new Map<string, AiTrendsTrafficStats>();
  for (const [source, sites] of bySource) {
    let up = 0;
    let down = 0;
    for (const site of sites) {
      const typicalWeek = median(site.baselineWeeks) ?? 0;
      if (site.recent > typicalWeek) {
        up += 1;
      } else if (site.recent < typicalWeek) {
        down += 1;
      }
    }
    // The typical site in each baseline week, then the typical one of those weeks.
    const baselineWeek =
      median(
        Array.from(
          { length: AI_TRENDS_BASELINE_WEEKS },
          (_, week) =>
            median(sites.map((site) => site.baselineWeeks[week] ?? 0)) ?? 0
        )
      ) ?? 0;
    const recent =
      (median(sites.map((site) => site.recent)) ?? 0) / AI_TRENDS_RECENT_DAYS;
    const baseline = baselineWeek / AI_TRENDS_RECENT_DAYS;
    const moved = up + down;
    result.set(source, {
      source,
      recent,
      baseline,
      change: baseline > 0 ? (recent - baseline) / baseline : null,
      score: moved > 0 ? (up - down) / Math.sqrt(moved) : 0,
      sites: sites.length,
      sitesUp: up,
      sitesDown: down,
      visits: sites.reduce(
        (total, site) => total + site.recent + sum(site.baselineWeeks),
        0
      ),
    });
  }
  return result;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function detectTrafficAnomalies(
  stats: Map<string, AiTrendsTrafficStats>
): (AiTrendsTrafficStats & { change: number })[] {
  return [...stats.values()]
    .filter(
      (stats): stats is AiTrendsTrafficStats & { change: number } =>
        stats.change !== null &&
        stats.sites >= AI_TRENDS_TRAFFIC_MIN_SITES &&
        stats.visits >= AI_TRENDS_TRAFFIC_MIN_VISITS &&
        reachesChange(stats.change, AI_TRENDS_MIN_RELATIVE_CHANGE) &&
        Math.abs(stats.score) >= AI_TRENDS_TRAFFIC_MIN_SCORE &&
        Math.sign(stats.score) === Math.sign(stats.change)
    )
    .sort(
      (a, b) =>
        Math.abs(b.score) - Math.abs(a.score) ||
        Math.abs(b.change) - Math.abs(a.change)
    )
    .slice(0, AI_TRENDS_TRAFFIC_MAX_ANOMALIES);
}

/** Per-day totals and per-day source rows, built once per chart. */
export function trafficDayIndex(
  days: AiTrendsTrafficDay[]
): AiTrendsTrafficDayIndex {
  const totals = new Map<string, AiTrendsTrafficDay>();
  const sources = new Map<string, AiTrendsTrafficDay>();
  for (const row of days) {
    if (row.visitorType === "") {
      totals.set(row.day, row);
    } else {
      sources.set(
        `${row.day}|${trafficSourceId(row.visitorType, row.source)}`,
        row
      );
    }
  }
  return { totals, sources };
}

/** The typical visited site's visits each day; null on days without any. */
export function trafficVisitsSeries(
  { sources }: AiTrendsTrafficDayIndex,
  sourceId: string,
  range: string[]
): AiTrendsPoint[] {
  return range.map((day) => ({
    day,
    value: sources.get(`${day}|${sourceId}`)?.medianVisits ?? null,
  }));
}

export function trafficMarkdownSeries(
  { sources }: AiTrendsTrafficDayIndex,
  sourceId: string,
  range: string[]
): AiTrendsPoint[] {
  return range.map((day) => {
    const row = sources.get(`${day}|${sourceId}`);
    return {
      day,
      value: row && row.visits > 0 ? row.markdownVisits / row.visits : null,
    };
  });
}

export function trafficPurposeSeries(
  days: AiTrendsTrafficDay[],
  category: string,
  range: string[]
): AiTrendsPoint[] {
  const crawls = new Map<string, { total: number; category: number }>();
  for (const row of days) {
    if (row.visitorType !== "crawler") {
      continue;
    }
    const totals = crawls.get(row.day) ?? { total: 0, category: 0 };
    totals.total += row.visits;
    if (row.category === category) {
      totals.category += row.visits;
    }
    crawls.set(row.day, totals);
  }
  return range.map((day) => {
    const totals = crawls.get(day);
    return {
      day,
      value: totals && totals.total > 0 ? totals.category / totals.total : null,
    };
  });
}

export function formatVisits(value: number | null): string {
  if (value === null) {
    return "–";
  }
  if (value >= 100) {
    return Math.round(value).toLocaleString("en");
  }
  return value.toFixed(value >= 10 ? 1 : 2);
}

/**
 * Every source with traffic anywhere in the window, busiest first. Charts
 * read these instead of the last week's top sources, so a source that went
 * quiet still charts, and referrals keep their tab under many crawlers.
 */
export function trafficWindowSources(
  days: AiTrendsTrafficDay[]
): AiTrendsTrafficChartSource[] {
  const sources = new Map<string, AiTrendsTrafficChartSource>();
  for (const row of days) {
    if (row.visitorType === "") {
      continue;
    }
    const id = trafficSourceId(row.visitorType, row.source);
    const source = sources.get(id) ?? {
      id,
      visitorType: row.visitorType,
      source: row.source,
      label: formatGeoSource(row.source),
      category: row.category,
      visits: 0,
      markdownVisits: 0,
    };
    source.visits += row.visits;
    source.markdownVisits += row.markdownVisits;
    sources.set(id, source);
  }
  return [...sources.values()].sort((a, b) => b.visits - a.visits);
}
