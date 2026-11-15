import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";

import { geoMentionChecks, geoScans } from "@notra/db/schema";
import { Effect } from "effect";

import { seedGeoModelCatalog } from "../src/utils/geo-model-catalog";
import { fakeModels, testBillingGate } from "./constants/geo-boundaries";
import { withCodingAgentModels } from "./utils/coding-agents";
import {
  database,
  initializeDatabase,
  resetDatabase,
  seedProject,
  testDb,
} from "./utils/database";

mock.module("@notra/db/drizzle", () => ({ db: testDb }));
mock.module("../src/geo/model-catalog", () => ({
  loadGeoModelCatalog: () => Effect.succeed(seedGeoModelCatalog()),
}));

const { runGeoScanSequenceBatch, runGeoScanTaskBatch } =
  await import("../src/geo/scan");
const originalFetch = globalThis.fetch;
const originalBoxKey = process.env.UPSTASH_BOX_API_KEY;
const originalGatewayKey = process.env.AI_GATEWAY_API_KEY;

beforeAll(initializeDatabase, 30_000);
beforeEach(async () => {
  await resetDatabase();
  process.env.UPSTASH_BOX_API_KEY = "test-only-never-sent";
  process.env.AI_GATEWAY_API_KEY = "test-gateway-key";
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalGatewayKey === undefined) {
    delete process.env.AI_GATEWAY_API_KEY;
  } else {
    process.env.AI_GATEWAY_API_KEY = originalGatewayKey;
  }
  if (originalBoxKey === undefined) {
    delete process.env.UPSTASH_BOX_API_KEY;
  } else {
    process.env.UPSTASH_BOX_API_KEY = originalBoxKey;
  }
});
afterAll(() => database.postgres.close());

describe("real Box SDK partial answers in native scan persistence", () => {
  test.each([
    ["provider", "codex/gpt-6-astra"],
    ["truncated stream", "codex/gpt-6-astra"],
    ["cleanup", "codex/gpt-6-astra"],
    ["single cleanup", "codex/gpt-6-astra"],
    ["single empty", "codex/gpt-6-astra"],
    ["provider", "claude-code/claude-opus-5.5"],
    ["provider", "opencode/claude-opus-5.5"],
  ])(
    "%s failure on %s does not erase completed answers or known usage",
    async (failure, engine) => {
      const single = failure.startsWith("single");
      const scope = await seedProject("native-partial-integration");
      const scanId = "native-partial-integration-scan";
      await testDb.insert(geoScans).values({ id: scanId, ...scope });
      let turns = 0;
      let deletes = 0;
      globalThis.fetch = mock<typeof fetch>(async (input, init) => {
        const url = String(input);
        if (url.endsWith("/v2/box") && init?.method === "POST") {
          expect(JSON.parse(String(init.body))).toMatchObject({
            model:
              engine === "codex/gpt-6-astra"
                ? "vercel/openai/gpt-6-astra"
                : "vercel/anthropic/claude-opus-5.5",
            agent_api_key: "test-gateway-key",
          });
          return Response.json({
            ...JSON.parse(String(init.body)),
            id: "box-partial",
            status: "idle",
          });
        }
        if (url.endsWith("/run/stream")) {
          turns += 1;
          if (turns === 2 && failure === "provider") {
            return new Response(
              'event: error\ndata: {"error":"provider unavailable"}\n\n'
            );
          }
          if (turns === 2 && failure === "truncated stream") {
            return new Response(
              'event: text\ndata: {"text":"unverified partial text"}\n\n'
            );
          }
          return new Response(
            `event: done\ndata: ${JSON.stringify({ output: failure === "single empty" ? "" : `Notra answer ${turns} https://example.com/source`, input_tokens: 12, output_tokens: 3, cached_input_tokens: 2, total_cost_usd: 0.04 })}\n\n`
          );
        }
        if (url.endsWith("/v2/box") && init?.method === "DELETE") {
          deletes += 1;
          return failure.includes("cleanup")
            ? Response.json({ error: "cleanup forbidden" }, { status: 403 })
            : new Response(null, { status: 204 });
        }
        throw new Error(`Unexpected test request: ${init?.method} ${url}`);
      });

      const context = {
        ...scope,
        scanId,
        runId: "native-partial-integration-run",
        companyName: "Notra",
        aliases: [],
        websiteUrl: "https://example.com",
        gate: testBillingGate,
        startedAtMs: Date.now(),
      };
      const effect = single
        ? runGeoScanTaskBatch(context, [
            {
              engine,
              prompt: { id: "single-question", text: "first question" },
              language: "English",
              groundedKey: null,
              zdr: "none",
            },
          ])
        : runGeoScanSequenceBatch(context, [
            {
              sequenceId: "sequence",
              steps: ["first question", "follow-up"],
              language: "English",
              engine,
              groundedKey: null,
              zdr: "none",
            },
          ]);
      const totals = await Effect.runPromise(
        effect.pipe(withCodingAgentModels(fakeModels))
      );
      let checks = failure === "cleanup" ? 2 : 1;
      if (failure === "single empty") {
        checks = 0;
      }
      const paidRuns = failure === "cleanup" ? 2 : 1;
      expect(totals).toMatchObject({
        checks,
        dropped: (single ? 1 : 2) - checks,
        engineUsage: { totalUsd: paidRuns * 0.04 },
      });
      const rows = await testDb
        .select()
        .from(geoMentionChecks)
        .orderBy(geoMentionChecks.turn);
      expect(rows.map((row) => [row.turn, row.answer, row.costUsd])).toEqual(
        Array.from({ length: checks }, (_, index) => [
          single ? 0 : index + 1,
          `Notra answer ${index + 1} https://example.com/source`,
          0.04,
        ])
      );
      expect(rows.map((row) => [row.prompt, row.engine, row.language])).toEqual(
        ["first question", "follow-up"]
          .slice(0, checks)
          .map((prompt) => [prompt, engine, "English"])
      );
      expect(turns).toBe(single ? 1 : 2);
      expect(deletes).toBe(1);
    }
  );
});
