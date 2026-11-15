import { afterAll, beforeAll, beforeEach, expect, mock, test } from "bun:test";

import type { GeoTrafficOverviewRow } from "@notra/analytics/types/tinybird-endpoints";
import { AI_AGENT_SIGNATURES } from "@usenotra/geo/signatures";
import { Effect } from "effect";

import {
  isIsolatedTestWorker,
  testInIsolatedProcess,
} from "./utils/isolated-process";

if (!isIsolatedTestWorker(import.meta.url)) {
  testInIsolatedProcess(
    "traffic retains every previous-window source through DTO mapping",
    import.meta.url
  );
} else {
  await import("./utils/infrastructure");
  const { database, initializeDatabase, resetDatabase, seedProject } =
    await import("./utils/database");
  let rows: GeoTrafficOverviewRow[] = [];
  const client = await import("@notra/analytics/tinybird/client");
  mock.module("@notra/analytics/tinybird/client", () => ({
    ...client,
    isTinybirdConfigured: () => true,
    queryGeoTrafficOverview: async () => ({ data: rows }),
    queryGeoTrafficTimeseries: async () => ({ data: [] }),
  }));
  const { loadAiTraffic } = await import("../src/geo/programs");
  const { toGeoTrafficPreviousTotals } =
    await import("../src/utils/ai-traffic");
  beforeAll(initializeDatabase, 30_000);
  afterAll(() => database.postgres.close());
  beforeEach(async () => {
    await resetDatabase();
    rows = [];
  });

  test("former crawler, browse and referral sources remain in the previous totals", async () => {
    const scope = await seedProject("baseline");
    rows = [
      {
        source: "GPTBot",
        visitor_type: "crawler",
        category: "training-crawler",
        visits: 0,
        previous_visits: 7,
      },
      {
        source: "ChatGPT-User",
        visitor_type: "crawler",
        category: "assistant-browse",
        visits: 0,
        previous_visits: 2,
      },
      {
        source: "chatgpt",
        visitor_type: "ai_referral",
        category: "assistant-referral",
        visits: 0,
        previous_visits: 4,
      },
      {
        source: "PerplexityBot",
        visitor_type: "crawler",
        category: "search-index",
        visits: 3,
        previous_visits: 1,
      },
    ].map((row) => ({
      ...row,
      agent: row.visitor_type === "crawler" ? row.source : "",
      confidence: "verified",
      markdown_visits: 0,
      paths: row.visits > 0 ? 1 : 0,
      last_seen_at: "2026-10-07 00:00:00",
      previous_markdown_visits: 0,
      previous_paths: 0,
    }));
    const response = await Effect.runPromise(loadAiTraffic(scope, { days: 7 }));
    expect(response.sources).toHaveLength(4);
    expect(response.sources.map((row) => row.source)).toEqual([
      "GPTBot",
      "ChatGPT-User",
      "chatgpt",
      "PerplexityBot",
    ]);
    expect(response.totals).toMatchObject({
      crawler: 3,
      cited: 0,
      aiReferral: 0,
    });
    expect(toGeoTrafficPreviousTotals(response.sources)).toMatchObject({
      crawler: 10,
      cited: 2,
      aiReferral: 4,
    });
  });

  test("no 100-source cap truncates known agents or a larger previous baseline", async () => {
    const scope = await seedProject("baseline-cap");
    rows = AI_AGENT_SIGNATURES.map((signature) => ({
      source: signature.agent,
      visitor_type: "crawler",
      agent: signature.agent,
      category: signature.category,
      confidence: signature.confidence,
      visits: 0,
      previous_visits: 1,
      markdown_visits: 0,
      paths: 0,
      last_seen_at: "2026-10-07 00:00:00",
      previous_markdown_visits: 0,
      previous_paths: 0,
    }));
    for (let index = 0; index < 120; index += 1) {
      rows.push({
        source: `historical-agent-${index}`,
        visitor_type: "crawler",
        agent: `historical-agent-${index}`,
        category: "training-crawler",
        confidence: "verified",
        visits: 0,
        previous_visits: 1,
        markdown_visits: 0,
        paths: 0,
        last_seen_at: "2026-10-07 00:00:00",
        previous_markdown_visits: 0,
        previous_paths: 0,
      });
    }
    const response = await Effect.runPromise(loadAiTraffic(scope, { days: 7 }));
    expect(response.sources).toHaveLength(AI_AGENT_SIGNATURES.length + 120);
    expect(response.sources.map((row) => row.source)).toEqual(
      rows.map((row) => row.source)
    );
    expect(toGeoTrafficPreviousTotals(response.sources)?.crawler).toBe(
      rows.length
    );
    expect(response.totals.crawler).toBe(0);
  });

  test("previous markdown visits and pages map through, and stay absent for an older pipe", async () => {
    const scope = await seedProject("previous-pages");
    const row: GeoTrafficOverviewRow = {
      source: "GPTBot",
      visitor_type: "crawler",
      agent: "GPTBot",
      category: "training-crawler",
      confidence: "verified",
      visits: 12,
      previous_visits: 8,
      markdown_visits: 4,
      paths: 6,
      last_seen_at: "2026-10-07 00:00:00",
      previous_markdown_visits: 2,
      previous_paths: 3,
    };
    rows = [row];
    const [mapped] = (
      await Effect.runPromise(loadAiTraffic(scope, { days: 7 }))
    ).sources;
    expect(mapped).toMatchObject({
      previousMarkdownVisits: 2,
      previousPaths: 3,
    });

    const { previous_markdown_visits, previous_paths, ...legacy } = row;
    rows = [legacy as GeoTrafficOverviewRow];
    const [fallback] = (
      await Effect.runPromise(loadAiTraffic(scope, { days: 7 }))
    ).sources;
    expect(fallback).not.toHaveProperty("previousMarkdownVisits");
    expect(fallback).not.toHaveProperty("previousPaths");
  });
}
