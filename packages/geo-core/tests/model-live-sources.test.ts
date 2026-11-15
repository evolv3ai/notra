import { expect, mock, test } from "bun:test";

import { MockLanguageModelV4 } from "ai/test";
import { Effect } from "effect";

import { GeoModelService } from "../src/deps";
import { resolveGroundedEngineByKey } from "../src/utils/geo-grounded-engines";

const searchUrl = "https://example.com/search-result";
let retryAcrossGateways = false;
let retryCall = 0;
let grokSearch = false;
const model = new MockLanguageModelV4({
  doGenerate: async () => {
    if (grokSearch) {
      return {
        content: [
          {
            type: "tool-call" as const,
            toolCallId: "grok-search",
            toolName: "web_search",
            input: "{}",
            providerExecuted: true,
          },
          {
            type: "tool-result" as const,
            toolCallId: "grok-search",
            toolName: "web_search",
            result: {
              action: {
                type: "search",
                query: "email tools",
                queries: ["email tools", " email tools pricing ", ""],
              },
              sources: [{ type: "url", url: searchUrl }],
            },
          },
          {
            type: "source" as const,
            sourceType: "url" as const,
            id: "grok-citation",
            url: searchUrl,
            title: "Email tools",
          },
          { type: "text" as const, text: "Answer with a citation." },
        ],
        finishReason: { unified: "stop" as const, raw: "stop" },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 1, text: 1, reasoning: 0 },
        },
        warnings: [],
      };
    }
    if (retryAcrossGateways) {
      const first = retryCall++ === 0;
      return {
        content: [{ type: "text" as const, text: first ? "" : "Answer" }],
        finishReason: {
          unified: first ? ("length" as const) : ("stop" as const),
          raw: first ? "length" : "stop",
        },
        usage: {
          inputTokens: {
            total: 100_000,
            noCache: 100_000,
            cacheRead: 0,
            cacheWrite: 0,
          },
          outputTokens: {
            total: 100_000,
            text: first ? 0 : 100_000,
            reasoning: first ? 100_000 : 0,
          },
        },
        warnings: [],
        providerMetadata: {
          test: { gateway: first ? "openrouter" : "vercel" },
          google: {},
        },
      };
    }
    return {
      content: [
        { type: "text" as const, text: "Other tools are a better fit." },
      ],
      finishReason: { unified: "stop" as const, raw: "stop" },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      },
      warnings: [],
      providerMetadata: {
        test: {},
        google: {
          groundingMetadata: { groundingChunks: [{ web: { uri: searchUrl } }] },
        },
      },
    };
  },
});

// Bun keeps module mocks across test files, so keep the real exports other files import.
const actualGateway = await import("@notra/ai/gateway");
const routedModel = mock<typeof actualGateway.gateway>(() => model);
mock.module("@notra/ai/gateway", () => ({
  ...actualGateway,
  gateway: routedModel,
  getRouteMetadata: (metadata: Record<string, Record<string, unknown>>) => {
    const gateway = metadata?.test?.gateway;
    return gateway === "vercel" || gateway === "openrouter"
      ? {
          gateway,
          requestedModel: "openai/gpt-5.6-sol",
          model: "openai/gpt-5.6-sol",
          reason: "paid" as const,
        }
      : undefined;
  },
}));

const { geoModelLive } = await import("../src/geo/model-live");

test("Grok delegates native search routing and retains queries and citations", async () => {
  const engine = resolveGroundedEngineByKey("spacexai/grok-4.7-grounded");
  if (!engine) {
    throw new Error("Grok should have a grounded route");
  }
  routedModel.mockClear();
  model.doGenerateCalls.length = 0;
  grokSearch = true;
  try {
    const answer = await Effect.runPromise(
      GeoModelService.pipe(
        Effect.flatMap((service) =>
          service.groundedAnswer({
            organizationId: "test-org",
            engine,
            messages: [{ role: "user", content: "Which email tools?" }],
            zdr: "required",
          })
        ),
        Effect.provide(geoModelLive)
      )
    );
    expect(routedModel).toHaveBeenCalledWith(
      "spacexai/grok-4.7",
      expect.objectContaining({ organizationId: "test-org", zdr: "required" })
    );
    expect(routedModel.mock.calls[0]?.[1]?.gateway).toBeUndefined();
    expect(model.doGenerateCalls[0]?.tools).toContainEqual(
      expect.objectContaining({
        type: "provider",
        id: "xai.web_search",
        name: "web_search",
      })
    );
    expect(answer.text).toBe("Answer with a citation.");
    expect(answer.grounding.queries).toEqual([
      "email tools",
      "email tools pricing",
    ]);
    expect(answer.grounding.sources).toEqual([
      { url: searchUrl, title: "Email tools", domain: "example.com" },
    ]);
    expect(answer.sources).toEqual([{ url: searchUrl, title: "Email tools" }]);
  } finally {
    grokSearch = false;
  }
});

test("answer retries preserve each gateway's token cost", async () => {
  retryAcrossGateways = true;
  retryCall = 0;
  try {
    const answer = await Effect.runPromise(
      GeoModelService.pipe(
        Effect.flatMap((service) =>
          service.answer({
            organizationId: "test-org",
            engine: "openai/gpt-5.6-sol",
            prompt: "Which tools?",
            zdr: "preferred",
            gateway: undefined,
          })
        ),
        Effect.provide(geoModelLive)
      )
    );

    expect(retryCall).toBe(2);
    expect(answer.usage?.totalUsd).toBeCloseTo(3.6);
    expect(answer.usage?.route?.gateway).toBe("vercel");
  } finally {
    retryAcrossGateways = false;
  }
});
