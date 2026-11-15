import { describe, expect, test } from "bun:test";

import {
  GEO_MODEL_CATALOG_SEED,
  GEO_MODEL_PROVIDERS,
} from "../src/constants/geo-model-catalog";
import type { GeoModelCatalog } from "../src/types/geo";
import { engineModelOf } from "../src/utils/geo-engine-family";
import {
  isGeoWebSearchEngine,
  isPartialGeoScanEngineScope,
  remapRetiredGeoEngineIds,
  resolveGeoGroundedZdrMode,
  resolveTrackedEngines,
  scopeGeoScanEngines,
} from "../src/utils/geo-engines";
import {
  hasGroundedVariant,
  resolveGroundedEngineByKey,
  resolveGroundedEngines,
} from "../src/utils/geo-grounded-engines";
import {
  buildGeoModelCatalogFromFeed,
  geoDefaultEngines,
  geoEnginesForAudience,
  geoModelsForProvider,
  seedGeoModelCatalog,
} from "../src/utils/geo-model-catalog";
import { isGeoOlostepEngine } from "../src/utils/geo-olostep";

const catalog: GeoModelCatalog = {
  providers: [...GEO_MODEL_PROVIDERS],
  models: [...GEO_MODEL_CATALOG_SEED],
};

describe("selected grounded engines", () => {
  test("Mistral stays out of live and fallback catalogs and saved scan selections", () => {
    const mistralModels = [
      "mistral/mistral-large-4",
      "mistral/mistral-medium-latest",
      "mistral/mistral-medium-3.5",
    ];
    const live = buildGeoModelCatalogFromFeed([
      ...mistralModels.map((id) => ({
        id,
        name: id,
        owned_by: "mistral",
        type: "language",
        zdr: "all" as const,
      })),
      {
        id: "openai/gpt-5.6-sol",
        name: "GPT-5.6 Sol",
        owned_by: "openai",
        type: "language",
        zdr: "all",
      },
    ]);

    for (const available of [live, seedGeoModelCatalog()]) {
      expect(
        available.providers.some((provider) => provider.id === "mistral")
      ).toBe(false);
      expect(
        available.models.some((model) => model.provider === "mistral")
      ).toBe(false);
      expect(
        resolveTrackedEngines(available, [
          ...mistralModels,
          "openai/gpt-5.6-sol",
        ])
      ).toEqual(["openai/gpt-5.6-sol"]);
    }
  });

  test("batch transport variants are not separate models, even without a base in the feed", () => {
    const available = buildGeoModelCatalogFromFeed([
      {
        id: "openai/gpt-6.1-sol",
        name: "GPT-6.1 Sol",
        owned_by: "openai",
        type: "language",
        zdr: "none",
      },
      {
        id: "openai/gpt-6.1-sol-batch",
        name: "GPT-6.1 Sol (Batch)",
        owned_by: "openai",
        type: "language",
        zdr: "none",
      },
      {
        id: "anthropic/claude-opus-5.5-batch",
        name: "Claude Opus 5.5 (Batch)",
        owned_by: "anthropic",
        type: "language",
        zdr: "none",
      },
    ]);
    expect(available.models.some((model) => model.id.endsWith("-batch"))).toBe(
      false
    );
    expect(
      geoModelsForProvider(available, "openai").map((model) => model.id)
    ).toContain("openai/gpt-6.1-sol");
    expect(
      geoDefaultEngines(available).every((id) => !id.endsWith("-batch"))
    ).toBe(true);
    expect(
      resolveTrackedEngines(available, [
        "openai/gpt-6.1-sol-batch",
        "openai/gpt-6.1-sol",
      ])
    ).toEqual(["openai/gpt-6.1-sol"]);
    expect(
      scopeGeoScanEngines(
        available,
        ["openai/gpt-6.1-sol-batch"],
        ["openai/gpt-6.1-sol-batch"]
      )
    ).toEqual(["openai/gpt-6.1-sol"]);
    expect(
      isPartialGeoScanEngineScope(
        ["openai/gpt-6.1-sol-batch"],
        ["openai/gpt-6.1-sol"]
      )
    ).toBe(false);
  });

  test("saved batch approvals and retired models canonicalize without rewriting historical check identities", () => {
    expect(
      remapRetiredGeoEngineIds([
        "spacexai/grok-4.6-batch",
        "spacexai/grok-4.7",
        "openai/gpt-6.1-sol-batch",
      ])
    ).toEqual(["spacexai/grok-4.7", "openai/gpt-6.1-sol"]);
    expect(engineModelOf("openai/gpt-6.1-sol-batch-grounded")).toBe(
      "openai/gpt-6.1-sol-batch"
    );
  });

  test("Grok models use native gateway search and retain their ZDR policy", () => {
    const available = buildGeoModelCatalogFromFeed([
      {
        id: "spacexai/grok-4.7",
        name: "Grok 4.7",
        owned_by: "spacexai",
        type: "language",
        zdr: "all",
      },
      {
        id: "spacexai/grok-4.5",
        name: "Grok 4.5",
        owned_by: "spacexai",
        type: "language",
        zdr: "none",
      },
      {
        id: "spacexai/grok-4.3",
        name: "Grok 4.3",
        owned_by: "spacexai",
        type: "language",
        zdr: "all",
      },
    ]);
    const resolved = {
      ...available,
      models: available.models.map((model) => ({
        ...model,
        supportsGroundedChecks:
          resolveGroundedEngines([model.id], available).length > 0,
      })),
    };
    for (const model of available.models.filter(
      (entry) => entry.provider === "spacexai"
    )) {
      const [engine] = resolveGroundedEngines([model.id], available);
      expect(engine).toMatchObject({
        key: `${model.id}-grounded`,
        model: model.id,
        provider: "gateway-spacexai",
      });
      expect(resolveGroundedEngineByKey(engine?.key ?? "")?.model).toBe(
        model.id
      );
      expect(isGeoWebSearchEngine(resolved, model.id)).toBe(true);
      if (!engine) {
        throw new Error("Grok should have a grounded route");
      }
      expect(
        resolveGeoGroundedZdrMode(available, engine, {
          enforceZdr: true,
          nonZdrApprovedEngines: [],
        })
      ).toBe(model.zdr === "none" ? null : "required");
      expect(
        resolveGeoGroundedZdrMode(available, engine, {
          enforceZdr: true,
          nonZdrApprovedEngines: [model.id],
        })
      ).toBe(model.zdr === "none" ? "preferred" : "required");
      expect(
        resolveGroundedEngines([model.id], {
          ...available,
          models: [{ ...model, gateways: ["openrouter"] }],
        })
      ).toEqual([]);
    }
  });

  test("Meta search is limited to hosted Muse models and requires non-ZDR approval", () => {
    const available = buildGeoModelCatalogFromFeed(
      [
        "muse-wonder-1.0",
        "muse-spark-1.3",
        "muse-glimmer-30b",
        "llama-4-scout",
      ].map((slug) => ({
        id: `meta/${slug}`,
        name: slug,
        owned_by: "meta",
        type: "language",
        zdr: "all" as const,
      }))
    );
    const resolved = {
      ...available,
      models: available.models.map((model) => ({
        ...model,
        supportsGroundedChecks:
          resolveGroundedEngines([model.id], available).length > 0,
      })),
    };
    for (const id of ["meta/muse-wonder-1.0", "meta/muse-spark-1.3"]) {
      const [engine] = resolveGroundedEngines([id], available);
      expect(engine).toMatchObject({
        key: `${id}-grounded`,
        model: id,
        provider: "gateway-meta",
      });
      expect(available.models.find((model) => model.id === id)?.zdr).toBe(
        "none"
      );
      expect(isGeoWebSearchEngine(resolved, id)).toBe(true);
      expect(hasGroundedVariant(id)).toBe(true);
      expect(resolveGroundedEngineByKey(engine?.key ?? "")?.model).toBe(id);
      if (!engine) {
        throw new Error("Hosted Muse models should have a search route");
      }
      expect(
        resolveGeoGroundedZdrMode(available, engine, {
          enforceZdr: false,
          nonEnforcedMode: "preferred",
          nonZdrApprovedEngines: [],
        })
      ).toBe("none");
      expect(
        resolveGeoGroundedZdrMode(available, engine, {
          enforceZdr: true,
          nonZdrApprovedEngines: [],
        })
      ).toBe(null);
      expect(
        resolveGeoGroundedZdrMode(available, engine, {
          enforceZdr: true,
          nonZdrApprovedEngines: [id],
        })
      ).toBe("none");
    }
    for (const id of ["meta/muse-glimmer-30b", "meta/llama-4-scout"]) {
      expect(resolveGroundedEngines([id], available)).toEqual([]);
      expect(resolveGroundedEngineByKey(`${id}-grounded`)).toBe(null);
      expect(hasGroundedVariant(id)).toBe(false);
      expect(isGeoWebSearchEngine(resolved, id)).toBe(false);
    }
    expect(
      available.models.find((model) => model.id === "meta/muse-glimmer-30b")
    ).toBeUndefined();
    expect(
      available.models.find((model) => model.id === "meta/llama-4-scout")?.zdr
    ).toBe("all");
    const fallback = seedGeoModelCatalog();
    expect(
      fallback.models.find((model) => model.id === "meta/muse-wonder-1.0")
    ).toMatchObject({
      label: "Muse Wonder",
      zdr: "none",
      gateways: ["vercel"],
    });
    expect(
      resolveGroundedEngines(["meta/muse-wonder-1.0"], fallback)
    ).toHaveLength(1);
    expect(
      fallback.models.some((model) => model.id.includes("wonder-full"))
    ).toBe(false);
    expect(
      resolveGroundedEngineByKey("meta/muse-wonder-full-1.0-grounded")
    ).toBe(null);
  });

  test("only plans selected models, even when older models remain in the catalog", () => {
    const selected = ["anthropic/claude-sonnet-5", "openai/gpt-5.6-sol"];
    const engines = resolveGroundedEngines(selected, catalog);
    expect(engines.map((engine) => engineModelOf(engine.key)).join(",")).toBe(
      selected.join(",")
    );
    expect(engines.map((engine) => engine.label).join(",")).toBe(
      "Claude Sonnet 5,GPT-5.6 Sol"
    );
    for (const engine of engines) {
      expect(resolveGroundedEngineByKey(engine.key)?.model).toBe(engine.model);
      expect(resolveGroundedEngineByKey(engine.key)?.provider).toBe(
        engine.provider
      );
    }
  });

  test("empty or unsupported selections do not inject default search models", () => {
    expect(resolveGroundedEngines([], catalog).length).toBe(0);
    expect(resolveGroundedEngines(["unlisted/model"], catalog).length).toBe(0);
    expect(resolveGroundedEngines(["moonshotai/kimi-k3"], catalog).length).toBe(
      0
    );
  });

  test("new catalog models work without adding version constants", () => {
    const futureCatalog: GeoModelCatalog = {
      providers: catalog.providers,
      models: [
        {
          id: "google/gemini-test-version",
          provider: "google",
          label: "Gemini test version",
          zdr: "all",
          released: "2099-01-01",
          default: false,
          gateways: ["vercel"],
        },
      ],
    };
    const engine = resolveGroundedEngines(
      ["google/gemini-test-version"],
      futureCatalog
    )[0];
    expect(engine?.model).toBe("google/gemini-test-version");
    expect(engine?.label).toBe("Gemini test version");
    const openRouterCatalog: GeoModelCatalog = {
      ...futureCatalog,
      models: futureCatalog.models.map((model) => ({
        ...model,
        gateways: ["openrouter"],
      })),
    };
    expect(
      resolveGroundedEngines(["google/gemini-test-version"], openRouterCatalog)
        .length
    ).toBe(0);
  });

  test("queued keys preserve the exact model rather than using a default", () => {
    expect(
      resolveGroundedEngineByKey("anthropic/claude-sonnet-5-grounded")?.model
    ).toBe("anthropic/claude-sonnet-5");
    expect(
      resolveGroundedEngineByKey("anthropic/claude-sonnet-4.6-grounded")?.model
    ).toBe("anthropic/claude-sonnet-4.6");
    expect(resolveGroundedEngineByKey("anthropic/claude-sonnet-5")).toBe(null);
  });

  test("Sonar uses the gateway without a Perplexity key", () => {
    const previous = process.env.PERPLEXITY_API_KEY;
    try {
      delete process.env.PERPLEXITY_API_KEY;
      const sonarFeed = {
        id: "perplexity/sonar",
        name: "Sonar",
        owned_by: "perplexity",
        type: "language",
        zdr: "none" as const,
      };
      const feed = [
        sonarFeed,
        {
          id: "perplexity/sonar-pro",
          name: "Sonar Pro",
          owned_by: "perplexity",
          type: "language",
          zdr: "none" as const,
        },
      ];
      expect(
        buildGeoModelCatalogFromFeed(feed)
          .models.filter((model) => model.provider === "perplexity")
          .map((model) => model.id)
      ).toEqual(["perplexity/sonar"]);
      const partial = buildGeoModelCatalogFromFeed([
        {
          id: "openai/gpt-5.6-sol",
          name: "GPT-5.6 Sol",
          owned_by: "openai",
          type: "language",
          zdr: "some" as const,
        },
        ...feed.slice(1),
      ]);
      expect(
        partial.models
          .filter((model) => model.gateways.includes("vercel"))
          .map((model) => model.id)
      ).toEqual(["openai/gpt-5.6-sol", "perplexity/sonar"]);
      expect(
        resolveGroundedEngines(["perplexity/sonar"], partial)[0]?.provider
      ).toBe("gateway-perplexity");
      for (const ineligible of [
        { ...sonarFeed, deprecated_at: 1 },
        { ...sonarFeed, type: "embedding" },
        { ...sonarFeed, tags: ["image-generation"] },
      ]) {
        const available = buildGeoModelCatalogFromFeed([
          ineligible,
          ...feed.slice(1),
        ]);
        expect(
          available.models.filter((model) => model.id === "perplexity/sonar")
        ).toEqual(
          seedGeoModelCatalog().models.filter(
            (model) => model.id === "perplexity/sonar"
          )
        );
        expect(
          resolveGroundedEngines(["perplexity/sonar"], available)[0]?.provider
        ).toBe("gateway-perplexity");
      }
      for (const available of [
        seedGeoModelCatalog(),
        buildGeoModelCatalogFromFeed(feed),
      ]) {
        const sonar = available.models.find(
          (model) => model.id === "perplexity/sonar"
        );
        expect(sonar?.gateways).toEqual(["vercel"]);
        const [grounded] = resolveGroundedEngines(
          ["perplexity/sonar"],
          available
        );
        expect(grounded?.key).toBe("perplexity/sonar-grounded");
        expect(grounded?.provider).toBe("gateway-perplexity");
        expect(grounded?.model).toBe("perplexity/sonar");
        expect(resolveGroundedEngineByKey(grounded?.key ?? "")?.model).toBe(
          "perplexity/sonar"
        );
        if (!grounded) {
          throw new Error("Sonar should have a grounded route");
        }
        expect(
          resolveGeoGroundedZdrMode(available, grounded, {
            enforceZdr: true,
            nonZdrApprovedEngines: [],
          })
        ).toBe(null);
        expect(
          resolveGeoGroundedZdrMode(available, grounded, {
            enforceZdr: true,
            nonZdrApprovedEngines: ["perplexity/sonar"],
          })
        ).toBe("preferred");
      }
      process.env.PERPLEXITY_API_KEY = "test-key";
      expect(
        resolveGroundedEngines(["perplexity/sonar"], seedGeoModelCatalog())[0]
          ?.provider
      ).toBe("gateway-perplexity");
    } finally {
      if (previous === undefined) {
        delete process.env.PERPLEXITY_API_KEY;
      } else {
        process.env.PERPLEXITY_API_KEY = previous;
      }
    }
  });
});

describe("released consumer apps", () => {
  const unreleased = ["perplexity/perplexity", "microsoft/copilot"];

  test("unreleased apps stay hidden, even from stale settings", () => {
    const previous = {
      olostep: process.env.GEO_OLOSTEP_API_KEY_ENV,
      context: process.env.CONTEXT_DEV_API_KEY,
    };
    try {
      process.env.GEO_OLOSTEP_API_KEY_ENV = "test-key";
      process.env.CONTEXT_DEV_API_KEY = "test-key";
      const feed = unreleased.map((id) => ({
        id,
        name: id,
        owned_by: id.split("/")[0] ?? "",
        type: "language",
        zdr: "none" as const,
      }));
      for (const available of [
        seedGeoModelCatalog(),
        buildGeoModelCatalogFromFeed(feed),
      ]) {
        const ids = available.models.map((model) => model.id);
        expect(ids.filter(isGeoOlostepEngine)).toEqual([
          "openai/chatgpt",
          "google/ai-mode",
        ]);
        expect(ids).toContain("google/gemini");
        expect(ids).toContain("google/ai-overview");
        expect(
          resolveTrackedEngines(available, [...unreleased, "openai/chatgpt"])
        ).toEqual(["openai/chatgpt"]);
        expect(resolveTrackedEngines(available, unreleased)).toEqual(
          geoDefaultEngines(available)
        );
        expect(
          scopeGeoScanEngines(available, ["openai/chatgpt"], unreleased)
        ).toEqual([]);
      }
      const seeded = seedGeoModelCatalog();
      expect(seeded.models.map((model) => model.id)).toContain(
        "perplexity/sonar"
      );
      expect(geoEnginesForAudience(seeded, "general")).toEqual([
        "anthropic/claude-opus-5.5",
        "openai/chatgpt",
        "google/gemini",
      ]);
      expect(geoEnginesForAudience(seeded, "commerce")).toEqual([
        "anthropic/claude-opus-5.5",
        "openai/chatgpt",
        "google/gemini",
        "google/ai-overview",
      ]);
    } finally {
      for (const [key, value] of [
        ["GEO_OLOSTEP_API_KEY_ENV", previous.olostep],
        ["CONTEXT_DEV_API_KEY", previous.context],
      ] as const) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });
});

describe("partial engine scope", () => {
  const tracked = ["anthropic/claude-sonnet-5", "openai/gpt-5.6-sol"];

  test("only a selection that leaves out a tracked engine is partial", () => {
    expect(isPartialGeoScanEngineScope(tracked, ["openai/gpt-5.6-sol"])).toBe(
      true
    );
    expect(isPartialGeoScanEngineScope(tracked, [...tracked].reverse())).toBe(
      false
    );
    expect(
      isPartialGeoScanEngineScope(tracked, [...tracked, "spacexai/grok-4.7"])
    ).toBe(false);
    expect(
      isPartialGeoScanEngineScope(["spacexai/grok-4.6"], ["spacexai/grok-4.7"])
    ).toBe(false);
  });
});
