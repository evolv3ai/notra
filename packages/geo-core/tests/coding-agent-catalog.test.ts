import { afterAll, beforeEach, describe, expect, spyOn, test } from "bun:test";

import { Effect } from "effect";

import {
  GEO_CURSOR_ENGINE_ID,
  GEO_OPENCODE_ENGINE_ID,
} from "../src/constants/geo";
import { GeoCodingAgentAccessService } from "../src/deps";
import { loadGeoModelCatalog } from "../src/geo/model-catalog";
import { geoBoxAgentForEngine } from "../src/utils/geo-coding-agents";
import { engineModelOf } from "../src/utils/geo-engine-family";
import {
  geoEngineUsedWebSearch,
  isGeoNativeSearchEngine,
  resolveGeoEngineGateway,
  resolveGeoZdrMode,
  scopeGeoScanEngines,
  resolveTrackedEngines,
  geoScanEmptyEngineSkipReason,
} from "../src/utils/geo-engines";
import {
  geoModelsForProvider,
  seedGeoModelCatalog,
} from "../src/utils/geo-model-catalog";
import { CODING_AGENT_TARGETS } from "./constants/coding-agents";

const envKeys = [
  "UPSTASH_BOX_API_KEY",
  "OPENROUTER_API_KEY",
  "AI_GATEWAY_API_KEY",
  "CURSOR_API_KEY",
] as const;
const originalEnv = envKeys.map((key) => process.env[key]);
const feed = spyOn(globalThis, "fetch").mockImplementation(async () =>
  Response.json({
    data: [
      {
        id: "openai/gpt-5.4-mini",
        name: "GPT-5.4 mini",
        owned_by: "openai",
        type: "language",
        zdr: "all",
      },
    ],
  })
);

beforeEach(() => {
  for (const key of envKeys) {
    process.env[key] = "test-only-never-sent";
  }
});
afterAll(() => {
  feed.mockRestore();
  for (const [index, key] of envKeys.entries()) {
    if (originalEnv[index] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[index];
    }
  }
});

describe("coding-agent catalog and paid-plan boundaries", () => {
  test.each(["claude-code", "codex", "opencode"])(
    "%s exposes its curated selectable models with explicit run targets",
    (provider) => {
      const catalog = seedGeoModelCatalog();
      const models = geoModelsForProvider(catalog, provider);
      expect(models).toHaveLength(provider === "opencode" ? 5 : 3);
      for (const model of models) {
        expect(model.hidden).not.toBe(true);
        expect(geoBoxAgentForEngine(model.id)?.harness).toBe(provider);
      }
    }
  );

  test("migrates retired coding-agent selections to available successors", () => {
    expect(
      resolveTrackedEngines(seedGeoModelCatalog(), [
        "opencode/gpt-5.6-sol-medium",
        "claude-code/claude-opus-5",
        "codex/gpt-5.6-sol-rei",
      ])
    ).toEqual([
      "opencode/gpt-6.1-sol-medium",
      "claude-code/claude-opus-5.5",
      "codex/gpt-6.1-sol",
    ]);
  });

  test.each([
    "opencode/gpt-5.6-sol-medium",
    "claude-code/claude-opus-5",
    "codex/gpt-5.6-sol-rei",
  ])("historical %s retains web search without changing identity", (engine) => {
    expect(geoEngineUsedWebSearch(engine)).toBe(true);
    expect(engineModelOf(engine)).toBe(engine);
    expect(geoBoxAgentForEngine(engine)).toBeNull();
  });

  test.each(["cursor/auto", "openai/gpt-5.4-mini", "unknown/model"])(
    "%s is not classified as historical web search",
    (engine) => {
      expect(geoEngineUsedWebSearch(engine)).toBe(false);
    }
  );

  test.each([false, true])(
    "paid=%s gates every coding engine without rollout flags",
    async (paid) => {
      const catalog = await Effect.runPromise(
        loadGeoModelCatalog(`paid-${paid}`).pipe(
          Effect.provideService(GeoCodingAgentAccessService, {
            hasPaidPlanForOrganization: () => Effect.succeed(paid),
          })
        )
      );
      expect(
        catalog.models.some((model) => model.id === GEO_CURSOR_ENGINE_ID)
      ).toBe(paid);
      for (const [engine] of CODING_AGENT_TARGETS) {
        expect(catalog.models.some((model) => model.id === engine)).toBe(paid);
      }
      expect(
        catalog.models.some((model) => model.id === "openai/gpt-5.4-mini")
      ).toBe(true);
      if (!paid) {
        expect(resolveTrackedEngines(catalog, ["codex/gpt-6-astra"])).toEqual(
          []
        );
        expect(geoScanEmptyEngineSkipReason([], 0)).toBe(
          "scoped_engines_missing"
        );
        expect(
          catalog.providers.some((provider) =>
            ["cursor", "opencode", "claude-code", "codex"].includes(provider.id)
          )
        ).toBe(false);
        expect(
          scopeGeoScanEngines(
            catalog,
            [],
            CODING_AGENT_TARGETS.map(([engine]) => engine)
          )
        ).toEqual([]);
      }
    }
  );

  test.each(CODING_AGENT_TARGETS)(
    "%s needs a Box key, is native search, and requires explicit non-ZDR approval",
    (engine) => {
      const catalog = seedGeoModelCatalog();
      expect(resolveGeoEngineGateway(catalog, engine)).toBe("box");
      expect(isGeoNativeSearchEngine(catalog, engine)).toBe(true);
      expect(geoEngineUsedWebSearch(engine)).toBe(true);
      expect(
        resolveGeoZdrMode(catalog, engine, {
          enforceZdr: true,
          nonZdrApprovedEngines: [],
        })
      ).toBeNull();
      expect(
        resolveGeoZdrMode(catalog, engine, {
          enforceZdr: true,
          nonZdrApprovedEngines: [engine],
        })
      ).toBe("preferred");
      process.env.UPSTASH_BOX_API_KEY = " \n ";
      expect(
        seedGeoModelCatalog().models.some((model) => model.id === engine)
      ).toBe(false);
    }
  );

  test("all Box engines use Gateway without requiring OpenRouter", () => {
    delete process.env.OPENROUTER_API_KEY;
    const catalog = seedGeoModelCatalog();
    expect(
      catalog.models.some((model) => model.id === GEO_OPENCODE_ENGINE_ID)
    ).toBe(true);
    for (const [engine] of CODING_AGENT_TARGETS) {
      expect(catalog.models.some((model) => model.id === engine)).toBe(true);
    }
  });

  test.each([undefined, " \n "])(
    "hides Box models without a Gateway key (%s)",
    (key) => {
      if (key === undefined) {
        delete process.env.AI_GATEWAY_API_KEY;
      } else {
        process.env.AI_GATEWAY_API_KEY = key;
      }
      const catalog = seedGeoModelCatalog();
      for (const [engine] of CODING_AGENT_TARGETS) {
        expect(catalog.models.some((model) => model.id === engine)).toBe(false);
      }
    }
  );
});
