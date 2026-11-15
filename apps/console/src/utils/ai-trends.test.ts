import { describe, expect, test } from "bun:test";

import type {
  AiTrendsEnginePeriodRow,
  AiTrendsPeriodTotals,
} from "@/types/ai-trends";
import { detectAnomalies } from "@/utils/ai-trends";

function totals(
  overrides: Partial<AiTrendsPeriodTotals>
): AiTrendsPeriodTotals {
  return {
    answers: 1000,
    citedAnswers: 900,
    citations: 4000,
    queries: 3000,
    queriesSquared: 10_000,
    searchedAnswers: 1000,
    overviewAnswers: 0,
    overviewAbsent: 0,
    adReported: 0,
    adShown: 0,
    productReported: 0,
    productShown: 0,
    ...overrides,
  };
}

function engine(
  id: string,
  recent: Partial<AiTrendsPeriodTotals> = {},
  baseline: Partial<AiTrendsPeriodTotals> = {}
): AiTrendsEnginePeriodRow {
  return { engine: id, recent: totals(recent), baseline: totals(baseline) };
}

describe("detectAnomalies", () => {
  test("flags a domain whose citation share collapses", () => {
    const anomalies = detectAnomalies({
      engines: [engine("openai/chatgpt")],
      domains: [
        {
          engine: "openai/chatgpt",
          domain: "reddit.com",
          recent: 20,
          baseline: 150,
        },
        {
          engine: "openai/chatgpt",
          domain: "g2.com",
          recent: 100,
          baseline: 104,
        },
      ],
    });

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toMatchObject({
      kind: "domainShare",
      domain: "reddit.com",
      recent: 0.005,
      baseline: 0.0375,
    });
    expect(anomalies[0]?.score).toBeLessThan(-3);
  });

  test("ignores large relative moves on tiny samples", () => {
    const anomalies = detectAnomalies({
      engines: [engine("openai/chatgpt")],
      domains: [
        {
          engine: "openai/chatgpt",
          domain: "example.com",
          recent: 9,
          baseline: 3,
        },
      ],
    });

    expect(anomalies).toEqual([]);
  });

  test("flags a jump in search queries per answer", () => {
    const anomalies = detectAnomalies({
      engines: [
        engine(
          "openai/chatgpt",
          { queries: 5000, queriesSquared: 27_000 },
          { queries: 3000, queriesSquared: 10_000 }
        ),
      ],
      domains: [],
    });

    expect(anomalies.map((anomaly) => anomaly.kind)).toEqual(["queries"]);
    expect(anomalies[0]?.change).toBeCloseTo(2 / 3);
  });

  test("flags ChatGPT showing ads more often", () => {
    const anomalies = detectAnomalies({
      engines: [
        engine(
          "openai/chatgpt",
          { adReported: 400, adShown: 130 },
          { adReported: 1200, adShown: 240 }
        ),
      ],
      domains: [],
    });

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toMatchObject({
      kind: "adRate",
      recent: 0.325,
      baseline: 0.2,
    });
  });

  test("caps anomalies per engine so one noisy engine can't fill the list", () => {
    const anomalies = detectAnomalies({
      engines: [engine("openai/chatgpt")],
      domains: ["a.com", "b.com", "c.com", "d.com", "e.com"].map((domain) => ({
        engine: "openai/chatgpt",
        domain,
        recent: 200,
        baseline: 40,
      })),
    });

    expect(anomalies).toHaveLength(4);
  });
});
