import { describe, expect, test } from "bun:test";

import type { AiTrendsTrafficProjectRow } from "@/types/ai-trends";
import {
  detectTrafficAnomalies,
  trafficPeriodStats,
} from "@/utils/ai-trends-traffic";

const SITES = ["a", "b", "c", "d", "e", "f"];

/** `recent` covers 7 days and `baseline` 21, spread evenly over its three weeks. */
function rows(
  source: string,
  perSite: (site: string) => [recent: number, baseline: number]
): AiTrendsTrafficProjectRow[] {
  return SITES.map((projectId) => {
    const [recent, baseline] = perSite(projectId);
    return { projectId, source, recent, baselineWeeks: weeks(baseline) };
  });
}

function weeks(baseline: number): number[] {
  return [baseline / 3, baseline / 3, baseline / 3];
}

function detect(projectRows: AiTrendsTrafficProjectRow[]) {
  return detectTrafficAnomalies(trafficPeriodStats(projectRows));
}

describe("detectTrafficAnomalies", () => {
  test("flags a crawler that doubles on most sites", () => {
    const anomalies = detect(rows("crawler:ClaudeBot", () => [140, 210]));

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]?.source).toBe("crawler:ClaudeBot");
    expect(anomalies[0]?.change).toBeCloseTo(1);
  });

  test("ignores one site's crawl sweep", () => {
    const anomalies = detect(
      rows("crawler:GPTBot", (site) => (site === "a" ? [5000, 300] : [99, 300]))
    );

    expect(anomalies).toEqual([]);
  });

  test("ignores sites that only started sending traffic", () => {
    const anomalies = detect([
      ...rows("crawler:GPTBot", () => [100, 300]),
      ...["g", "h", "i", "j", "k"].map((projectId) => ({
        projectId,
        source: "crawler:GPTBot",
        recent: 900,
        baselineWeeks: weeks(0),
      })),
    ]);

    expect(anomalies).toEqual([]);
  });
});

describe("trafficPeriodStats", () => {
  test("doesn't read a bursty crawler's quiet week as a slowdown", () => {
    // Each site had one burst week in the baseline and a normal last week.
    const stats = trafficPeriodStats(
      SITES.map((projectId, index) => ({
        projectId,
        source: "crawler:Bytespider",
        recent: 100,
        baselineWeeks: [100, 100, 100].map((visits, week) =>
          week === index % 3 ? visits * 20 : visits
        ),
      }))
    ).get("crawler:Bytespider");

    expect(stats?.change).toBeCloseTo(0);
    expect(stats?.score).toBe(0);
  });

  test("reports the typical site's change, not one big site's", () => {
    const stats = trafficPeriodStats(
      rows("crawler:GPTBot", (site) =>
        site === "a" ? [10_000_000, 3_000_000] : [130, 300]
      )
    ).get("crawler:GPTBot");

    expect(stats?.change).toBeCloseTo(0.3);
  });
});
