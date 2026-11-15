import "server-only";
import { geoAgentVendor } from "@notra/geo-core/utils/ai-traffic";
import { todayIsoDate } from "@notra/geo-core/utils/day-label";
import { aiTrendsTrafficResponseSchema } from "@notra/schemas/api/ai-trends-traffic";
import { AI_TRAFFIC_PURPOSE_LABELS } from "@notra/ui/constants/geo";
import { unstable_cache } from "next/cache";

import {
  AI_TRENDS_BASELINE_DAYS,
  AI_TRENDS_BASELINE_WEEKS,
  AI_TRENDS_CACHE_SECONDS,
  AI_TRENDS_TRAFFIC_TOP_SOURCES,
} from "@/constants/ai-trends";
import { callDashboard } from "@/lib/dashboard";
import { internalServerError } from "@/lib/orpc/utils/errors";
import type {
  AiTrendsAnomaly,
  AiTrendsDays,
  AiTrendsTraffic,
  AiTrendsTrafficDay,
  AiTrendsTrafficKind,
  AiTrendsTrafficProjectRow,
  AiTrendsTrafficWeekRow,
} from "@/types/ai-trends";
import { addDays, dayRange, trendsWindow } from "@/utils/ai-trends";
import {
  detectTrafficAnomalies,
  trafficDayIndex,
  trafficPeriodStats,
  trafficSourceId,
  trafficVisitsSeries,
  trafficWindowSources,
} from "@/utils/ai-trends-traffic";

const TRAFFIC_PATH = "/api/internal/ai-trends/traffic";

function trafficKind(value: string): AiTrendsTrafficKind | null {
  return value === "crawler" || value === "ai_referral" ? value : null;
}

/** One row per project and source, from Tinybird's row per week. */
function trafficProjectRows(
  rows: AiTrendsTrafficWeekRow[]
): AiTrendsTrafficProjectRow[] {
  const byKey = new Map<string, AiTrendsTrafficProjectRow>();
  for (const row of rows) {
    const visitorType = trafficKind(row.visitor_type);
    if (!visitorType || row.weeks_ago > AI_TRENDS_BASELINE_WEEKS) {
      continue;
    }
    const source = trafficSourceId(visitorType, row.source);
    const key = `${row.project_id}\u0000${source}`;
    const entry = byKey.get(key) ?? {
      projectId: row.project_id,
      source,
      recent: 0,
      baselineWeeks: Array.from({ length: AI_TRENDS_BASELINE_WEEKS }, () => 0),
    };
    if (row.weeks_ago === 0) {
      entry.recent += row.visits;
    } else {
      entry.baselineWeeks[row.weeks_ago - 1] =
        (entry.baselineWeeks[row.weeks_ago - 1] ?? 0) + row.visits;
    }
    byKey.set(key, entry);
  }
  return [...byKey.values()];
}

async function computeTraffic(days: AiTrendsDays): Promise<AiTrendsTraffic> {
  // Traffic lands continuously, so the window ends with yesterday, the last full UTC day.
  const window = trendsWindow(todayIsoDate(), days);
  const payload = await callDashboard(TRAFFIC_PATH, {
    from: window.from,
    baselineFrom: addDays(window.recentFrom, -AI_TRENDS_BASELINE_DAYS),
    recentFrom: window.recentFrom,
    toExclusive: window.toExclusive,
  });
  const parsed = aiTrendsTrafficResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw internalServerError("Unexpected AI traffic response", parsed.error);
  }

  const trafficDays: AiTrendsTrafficDay[] = parsed.data.daily.flatMap((row) => {
    const visitorType =
      row.visitor_type === "" ? "" : trafficKind(row.visitor_type);
    if (visitorType === null) {
      return [];
    }
    return [
      {
        day: row.day,
        visitorType,
        source: row.source,
        category: row.category,
        visits: row.visits,
        markdownVisits: row.markdown_visits,
        projects: row.projects,
        medianVisits: row.median_visits,
      },
    ];
  });
  const projectRows = trafficProjectRows(parsed.data.projects);

  const stats = trafficPeriodStats(projectRows);
  const changes = new Map(
    [...stats.values()].map((item) => [item.source, item.change])
  );
  // Distinct sites per source in the last 7 days; daily counts can't be summed.
  const sites = new Map<string, number>();
  for (const row of projectRows) {
    if (row.recent > 0) {
      sites.set(row.source, (sites.get(row.source) ?? 0) + 1);
    }
  }
  const windowSources = trafficWindowSources(trafficDays);
  const sources = trafficWindowSources(
    trafficDays.filter((row) => row.day >= window.recentFrom)
  )
    .slice(0, AI_TRENDS_TRAFFIC_TOP_SOURCES)
    .map((source) => ({
      ...source,
      sites: sites.get(source.id) ?? 0,
      change: changes.get(source.id) ?? null,
    }));
  const range = dayRange(window.from, window.toExclusive);
  const dayIndex = trafficDayIndex(trafficDays);
  const sourceById = new Map(
    windowSources.map((source) => [source.id, source])
  );
  const anomalies: AiTrendsAnomaly[] = detectTrafficAnomalies(stats).flatMap(
    (candidate) => {
      const source = sourceById.get(candidate.source);
      if (!source) {
        return [];
      }
      const crawler = source.visitorType === "crawler";
      return [
        {
          id: `traffic:${candidate.source}`,
          kind: crawler ? "crawlerVisits" : "referralVisits",
          engine: candidate.source,
          engineLabel: `${source.label} · ${crawler ? (AI_TRAFFIC_PURPOSE_LABELS[source.category] ?? "Crawler") : "Referrals"}`,
          subject: source.label,
          domain: null,
          recent: candidate.recent,
          baseline: candidate.baseline,
          change: candidate.change,
          score: candidate.score,
          series: trafficVisitsSeries(dayIndex, candidate.source, range),
          traffic: {
            visitorType: source.visitorType,
            vendor: crawler ? geoAgentVendor(source.source) : null,
            purpose: crawler ? source.category : "",
            sites: candidate.sites,
            sitesMoved:
              candidate.change > 0 ? candidate.sitesUp : candidate.sitesDown,
          },
        },
      ];
    }
  );

  const recentProjects = new Set(
    projectRows.filter((row) => row.recent > 0).map((row) => row.projectId)
  );
  return {
    configured: parsed.data.configured,
    window,
    sites: recentProjects.size,
    visits: trafficDays
      .filter((row) => row.visitorType === "" && row.day >= window.recentFrom)
      .reduce((sum, row) => sum + row.visits, 0),
    days: trafficDays,
    sources,
    anomalies,
  };
}

export const getAiTrendsTraffic = unstable_cache(
  computeTraffic,
  ["console", "ai-trends", "traffic"],
  { revalidate: AI_TRENDS_CACHE_SECONDS }
);
