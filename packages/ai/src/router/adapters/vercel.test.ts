import { mock, spyOn } from "bun:test";
import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  LanguageModelV4,
  LanguageModelV4StreamPart,
} from "@ai-sdk/provider";
import {
  calculateTokenCostUsd,
  getModelPricing,
  MODEL_PRICING,
} from "@notra/ai/billing/token-pricing";
import {
  AGENT_DEFAULT_MODEL,
  GEO_WRITER_MODEL,
  UTILITY_MODEL_ID,
} from "@notra/ai/constants/models";
import { summarizeRouteUsage } from "@notra/ai/utils/route-usage";
import { toAgentTokenUsage } from "@notra/ai/utils/token-usage";

import { setModelRouter } from "../../gateway";
import { createModelRouter } from "../create-router";
import { VERCEL_SERVED_MODEL_ALIASES } from "../model-ids";
import {
  callOptions,
  createCaptureLogger,
  createPolicy,
  metadataOf,
  readStreamParts,
} from "../test-helpers";

test("real Vercel adapter generate and stream metadata price served aliases identically when enrichment fails", async () => {
  let served: string | undefined = "gpt-5.4-mini";
  let tier = "standard";
  let lookups = 0;
  const usage = {
    inputTokens: {
      total: 90_000,
      noCache: 80_000,
      cacheRead: 10_000,
      cacheWrite: 0,
    },
    outputTokens: { total: 100_000, text: 100_000, reasoning: 0 },
  };
  const metadata = () => ({
    gateway: { generationId: "gen_fixture", serviceTier: tier },
  });
  mock.module("@ai-sdk/gateway", () => ({
    createGateway: () =>
      Object.assign(
        (modelId: string): LanguageModelV4 => ({
          specificationVersion: "v4",
          provider: "fixture",
          modelId,
          supportedUrls: {},
          doGenerate: async () => ({
            content: [],
            warnings: [],
            finishReason: { unified: "stop", raw: "stop" },
            usage,
            ...(served === undefined ? {} : { response: { modelId: served } }),
            providerMetadata: metadata(),
          }),
          doStream: async () => ({
            stream: new ReadableStream<LanguageModelV4StreamPart>({
              start(controller) {
                if (served !== undefined) {
                  controller.enqueue({
                    type: "response-metadata",
                    modelId: served,
                  });
                }
                controller.enqueue({
                  type: "finish",
                  finishReason: { unified: "stop", raw: "stop" },
                  usage,
                  providerMetadata: metadata(),
                });
                controller.close();
              },
            }),
          }),
        }),
        {
          getGenerationInfo: async () => {
            lookups += 1;
            throw new Error("fixture enrichment unavailable");
          },
        }
      ),
  }));
  const { createVercelAdapter } = await import("./vercel");
  const adapter = createVercelAdapter({ apiKey: "fixture" });
  const router = createModelRouter({
    adapters: { vercel: adapter },
    resolvePlan: async () => "paid",
    policy: createPolicy(),
    logger: createCaptureLogger(),
  });
  const network = spyOn(globalThis, "fetch").mockImplementation(() => {
    throw new Error("Unexpected provider request");
  });
  setModelRouter(router);
  try {
    for (const raw of [
      "constructor",
      "__proto__",
      "toString",
      "hasOwnProperty",
      "custom/model-v2",
      "custom/model-20260115",
      undefined,
    ]) {
      served = raw;
      const model = router.model(UTILITY_MODEL_ID, { gateway: "vercel" });
      const generated = await model.doGenerate(callOptions());
      const parts = await readStreamParts(await model.doStream(callOptions()));
      const finish = parts.find((part) => part.type === "finish");
      assert.ok(finish?.type === "finish");
      for (const result of [generated, finish]) {
        const route = router.getRouteMetadata(result.providerMetadata);
        assert.equal(typeof metadataOf(result)?.model, "string");
        assert.equal(route?.model, raw ?? UTILITY_MODEL_ID);
        assert.equal(route?.requestedModel, UTILITY_MODEL_ID);
      }
    }
    for (const serviceTier of ["standard", "flex"]) {
      tier = serviceTier;
      for (const [raw, canonical] of [
        ["gpt-5.4", "openai/gpt-5.4"],
        ["gpt-5.4-nano", "openai/gpt-5.4-nano"],
        ["gpt-5.4-mini", "openai/gpt-5.4-mini"],
        ["claude-sonnet-4-6", "anthropic/claude-sonnet-4.6"],
        ["claude-haiku-4-5", "anthropic/claude-haiku-4.5"],
        ["gpt-5.6-sol", "openai/gpt-5.6-sol"],
        ["gpt-6-luna", UTILITY_MODEL_ID],
        ["claude-sonnet-5", AGENT_DEFAULT_MODEL],
        ["claude-opus-5-5", GEO_WRITER_MODEL],
        ["claude-opus-5.5", GEO_WRITER_MODEL],
      ]) {
        assert.ok(raw && canonical);
        const pricingKey = Object.hasOwn(MODEL_PRICING, `vercel/${canonical}`)
          ? `vercel/${canonical}`
          : canonical;
        assert.equal(Object.hasOwn(MODEL_PRICING, canonical), true);
        assert.equal(Object.hasOwn(MODEL_PRICING, pricingKey), true);
        assert.equal(
          getModelPricing(canonical, "vercel"),
          MODEL_PRICING[pricingKey]
        );
        for (const variant of [
          raw,
          `${raw}-20261012`,
          `${raw}-2026-10-12`,
          canonical,
          `vercel/${canonical}`,
        ]) {
          served = variant;
          const model = router.model(UTILITY_MODEL_ID, { gateway: "vercel" });
          const generated = await model.doGenerate(callOptions());
          const parts = await readStreamParts(
            await model.doStream(callOptions())
          );
          const finish = parts.find((part) => part.type === "finish");
          assert.ok(finish?.type === "finish");
          for (const result of [generated, finish]) {
            const route = metadataOf(result);
            assert.equal(route?.model, canonical);
            assert.equal(route?.requestedModel, UTILITY_MODEL_ID);
            assert.equal(
              router.getRouteMetadata(result.providerMetadata)?.model,
              canonical
            );
            const summary = await summarizeRouteUsage([
              {
                providerMetadata: result.providerMetadata,
                usage: {
                  inputTokens: 90_000,
                  outputTokens: 100_000,
                  inputTokenDetails: { cacheReadTokens: 10_000 },
                },
              },
            ]);
            const expectedCost = calculateTokenCostUsd(
              toAgentTokenUsage({
                inputTokens: 90_000,
                outputTokens: 100_000,
                inputTokenDetails: { cacheReadTokens: 10_000 },
              }),
              canonical,
              "vercel",
              serviceTier
            );
            assert.equal(summary.tokenCostUsd, expectedCost);
            if (canonical === "openai/gpt-5.6-sol") {
              assert.equal(
                expectedCost,
                serviceTier === "flex" ? 1.162 : 2.324
              );
            } else if (canonical === AGENT_DEFAULT_MODEL) {
              assert.equal(expectedCost, 1.162);
            }
          }
        }
      }
    }
    assert.ok(lookups > 0);
    for (const [raw, canonical] of [
      ["claude-opus-4-6", "anthropic/claude-opus-4.6"],
      ["google/gemini-3-flash-preview", "google/gemini-3-flash"],
      ["mistralai/mistral-large-2512", "mistral/mistral-large-3"],
    ]) {
      assert.ok(raw && canonical);
      assert.equal(Object.hasOwn(MODEL_PRICING, canonical), false);
      assert.equal(Object.hasOwn(MODEL_PRICING, `vercel/${canonical}`), false);
      assert.equal(
        adapter.extractRouteMetadata(undefined, raw).model,
        canonical
      );
    }
    assert.equal(network.mock.calls.length, 0);
  } finally {
    setModelRouter(null);
    network.mockRestore();
  }
});

test("current vendor aliases resolve to owned canonical pricing entries", async () => {
  const { createVercelAdapter } = await import("./vercel");
  const adapter = createVercelAdapter({ apiKey: "fixture" });
  for (const [raw, canonical] of [
    ["claude-sonnet-5", AGENT_DEFAULT_MODEL],
    ["claude-opus-5-5", GEO_WRITER_MODEL],
    ["gpt-6-luna", UTILITY_MODEL_ID],
    ["gpt-5.6-sol", "openai/gpt-5.6-sol"],
  ]) {
    assert.ok(raw && canonical);
    assert.equal(Object.hasOwn(MODEL_PRICING, canonical), true);
    assert.equal(adapter.extractRouteMetadata(undefined, raw).model, canonical);
  }
  for (const canonical of VERCEL_SERVED_MODEL_ALIASES.values()) {
    assert.equal(
      Object.hasOwn(MODEL_PRICING, canonical),
      canonical !== "anthropic/claude-opus-4.6"
    );
  }
});
