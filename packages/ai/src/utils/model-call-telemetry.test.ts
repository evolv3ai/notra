import assert from "node:assert/strict";
import { test } from "node:test";

import { APICallError } from "@ai-sdk/provider";
import { FREE_ORG, MODEL } from "@notra/ai/constants/router-test";
import { wrapModelWithObservability } from "@notra/ai/observability";
import { createOpenRouterAdapter } from "@notra/ai/router/adapters/openrouter";
import { createModelRouter } from "@notra/ai/router/create-router";
import {
  callOptions,
  createCaptureLogger,
  createFakeAdapter,
  createPolicy,
  createTestRouter,
  httpError,
  readStreamParts,
} from "@notra/ai/router/test-helpers";
import { isRecord } from "@notra/utils/unknown-record";

import { evlogRequestIntegration } from "./evlog-request";
import { getEvlogRuntime } from "./evlog-runtime";
import { withGatewayAgentOptions } from "./gateway-agent-model";

test("real OpenRouter usage survives a later error and is accounted once", async () => {
  const chunks = [
    {
      id: "gen_charged_error",
      model: MODEL,
      choices: [{ index: 0, delta: { content: "partial answer" } }],
      usage: {
        prompt_tokens: 3,
        completion_tokens: 1,
        total_tokens: 4,
        cost: 0.25,
      },
    },
    { error: { message: "fixture provider error", code: 500 } },
  ];
  const adapter = createOpenRouterAdapter({
    apiKey: "fixture",
    fetch: async () =>
      new Response(
        `${chunks
          .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
          .join("")}data: [DONE]\n\n`,
        { headers: { "Content-Type": "text/event-stream" } }
      ),
  });
  const logger = createCaptureLogger();
  const router = createModelRouter({
    adapters: { openrouter: adapter },
    policy: createPolicy(),
    resolvePlan: async () => "free",
    logger,
  });
  const request = evlogRequestIntegration.start(undefined);
  await request.runWith(async () => {
    const parts = await readStreamParts(
      await router
        .model(MODEL, { organizationId: FREE_ORG })
        .doStream(callOptions())
    );
    assert.deepEqual(
      parts
        .filter((part) => ["text-delta", "error", "finish"].includes(part.type))
        .map((part) => part.type),
      ["text-delta", "error", "finish"]
    );
    const text = parts.find((part) => part.type === "text-delta");
    assert.ok(text?.type === "text-delta");
    assert.equal(text.delta, "partial answer");
    const costs = logger.entries.filter(
      ({ event }) => event === "ai.cost.reported"
    );
    assert.equal(costs.length, 1);
    assert.equal(costs[0]?.fields?.gatewayCostUsd, 0.25);
    assert.equal(costs[0]?.fields?.byokInferenceCostUsd, undefined);
    assert.equal(costs[0]?.fields?.costUsd, undefined);
    assert.equal(costs[0]?.fields?.costId, "openrouter:gen_charged_error");
    assert.deepEqual(
      logger.entries
        .filter(({ event }) => event.startsWith("ai.call."))
        .map(({ event }) => event),
      ["ai.call.started", "ai.call.failed"]
    );
    const ai = request.logger.getContext().ai;
    assert.ok(isRecord(ai));
    assert.equal(ai.calls, 1);
    assert.equal(ai.costUsd, undefined);
    const finish = parts.find((part) => part.type === "finish");
    assert.ok(finish?.type === "finish");
    assert.equal(
      router.getRouteMetadata(finish.providerMetadata)?.costUsd,
      undefined
    );
  });
});

test("OpenRouter telemetry and billing distinguish absent/null BYOK measurement from measured zero", async () => {
  for (const costDetails of [
    undefined,
    null,
    { upstream_inference_cost: null },
    { upstream_inference_cost: 0 },
    { upstream_inference_cost: 0.5 },
  ]) {
    for (const operation of ["generate", "stream"] as const) {
      const response = {
        id: "gen_measurement",
        model: MODEL,
        choices: [
          {
            index: 0,
            ...(operation === "generate"
              ? {
                  message: { role: "assistant", content: "fixture answer" },
                  finish_reason: "stop",
                }
              : { delta: { content: "fixture answer" } }),
          },
        ],
        usage: {
          prompt_tokens: 1,
          completion_tokens: 1,
          total_tokens: 2,
          cost: 0.25,
          cost_details: costDetails,
          is_byok: false,
        },
      };
      const adapter = createOpenRouterAdapter({
        apiKey: "fixture",
        fetch: async () =>
          operation === "generate"
            ? Response.json(response)
            : new Response(
                `data: ${JSON.stringify(response)}\n\ndata: ${JSON.stringify({
                  error: { message: "fixture later error", code: 500 },
                })}\n\ndata: [DONE]\n\n`,
                { headers: { "Content-Type": "text/event-stream" } }
              ),
      });
      const logger = createCaptureLogger();
      const router = createModelRouter({
        adapters: { openrouter: adapter },
        policy: createPolicy(),
        resolvePlan: async () => "free",
        logger,
      });
      const model = router.model(MODEL, { organizationId: FREE_ORG });
      const request = evlogRequestIntegration.start(undefined);
      const result = await request.runWith(async () =>
        operation === "generate"
          ? await model.doGenerate(callOptions())
          : (await readStreamParts(await model.doStream(callOptions()))).find(
              (part) => part.type === "finish"
            )
      );
      assert.ok(result);
      const metadata = router.getRouteMetadata(result.providerMetadata);
      const measuredCost = costDetails?.upstream_inference_cost ?? undefined;
      assert.equal(
        metadata?.costUsd,
        measuredCost === undefined ? undefined : 0.25 + measuredCost
      );
      assert.equal(metadata?.byokInferenceCostUsd, measuredCost);
      const normalizedUsage = result.providerMetadata?.openrouter?.usage;
      assert.ok(isRecord(normalizedUsage));
      assert.equal(normalizedUsage.is_byok, undefined);
      assert.equal(normalizedUsage.isByok, undefined);
      assert.equal(metadata?.isByok, undefined);
      const costs = logger.entries.filter(
        ({ event }) => event === "ai.cost.reported"
      );
      assert.equal(costs.length, 1);
      assert.equal(costs[0]?.fields?.gatewayCostUsd, 0.25);
      assert.equal(costs[0]?.fields?.byokInferenceCostUsd, measuredCost);
      assert.equal(
        costs[0]?.fields?.costUsd,
        measuredCost === undefined ? undefined : 0.25 + measuredCost
      );
      const requestAI = request.logger.getContext().ai;
      assert.ok(isRecord(requestAI));
      assert.equal(
        requestAI.costUsd,
        measuredCost === undefined ? undefined : 0.25 + measuredCost
      );
      assert.deepEqual(
        logger.entries
          .filter(({ event }) => event.startsWith("ai.call."))
          .map(({ event }) => event),
        [
          "ai.call.started",
          operation === "generate" ? "ai.call.completed" : "ai.call.failed",
        ]
      );
    }
  }
});

for (const operation of ["generate", "stream"] as const) {
  test(`Neon daily-limit ${operation} logs actionable details once and still completes through fallback`, async () => {
    const neon = createFakeAdapter({
      id: "neon",
      onCall: () => {
        throw new APICallError({
          message: "You've reached your AI Gateway daily spend limit.",
          url: "https://neon.example.test",
          requestBodyValues: { input: "private-prompt" },
          statusCode: 429,
          responseHeaders: { "retry-after": "3600" },
        });
      },
    });
    const vercel = createFakeAdapter({ id: "vercel" });
    const logger = createCaptureLogger();
    const router = createModelRouter({
      adapters: { neon, vercel },
      policy: createPolicy({ defaultGateway: "neon" }),
      resolvePlan: async () => "free",
      logger,
    });
    const model = router.model(MODEL);
    if (operation === "generate") {
      await model.doGenerate(callOptions());
    } else {
      await readStreamParts(await model.doStream(callOptions()));
    }
    const limits = logger.entries.filter(
      ({ event }) => event === "ai.call.limit_hit"
    );
    assert.equal(limits.length, 1);
    assert.equal(limits[0]?.fields?.gateway, "neon");
    assert.equal(limits[0]?.fields?.limitType, "daily-spend");
    assert.equal(limits[0]?.fields?.retryAfterSeconds, 3600);
    assert.doesNotMatch(JSON.stringify(limits), /private-prompt/);
    assert.equal(
      logger.entries.filter(({ event }) => event === "ai.call.completed")
        .length,
      1
    );
    assert.equal(
      logger.entries.find(({ event }) => event === "ai.call.completed")?.fields
        ?.gateway,
      "vercel"
    );
    assert.equal(
      logger.entries.filter(({ event }) => event === "ai.call.failed").length,
      0
    );
  });

  test(`routed agent ${operation} enriches the final gateway cost once without duplicate lifecycle logs`, async () => {
    const openrouter = createFakeAdapter({
      id: "openrouter",
      onCall: () => {
        throw httpError(503);
      },
    });
    const vercel = createFakeAdapter({ id: "vercel" });
    const lookups: string[] = [];
    vercel.lookupRouteMetadata = async (generationId) => {
      lookups.push(generationId);
      return { model: MODEL, costUsd: 0.25, costSource: "reported" };
    };
    const { router, logger } = createTestRouter({ openrouter, vercel });
    const model = withGatewayAgentOptions(
      router.model(MODEL),
      "content-writer-agent"
    );
    if (operation === "generate") {
      await model.doGenerate(callOptions());
    } else {
      await readStreamParts(await model.doStream(callOptions()));
    }
    await Promise.all(getEvlogRuntime().pendingAIUsage ?? []);
    assert.deepEqual(lookups, ["gen_test"]);
    for (const event of [
      "ai.call.started",
      "ai.call.completed",
      "ai.cost.reported",
      "ai.call.cost_enriched",
    ]) {
      assert.equal(
        logger.entries.filter((entry) => entry.event === event).length,
        1
      );
    }
    const cost = logger.entries.find(
      (entry) => entry.event === "ai.cost.reported"
    );
    assert.equal(cost?.fields?.gateway, "vercel");
    assert.equal(cost?.fields?.costUsd, 0.25);
  });

  test(`direct adapter ${operation} models keep ordinary evlog usage inside a request`, async () => {
    const request = evlogRequestIntegration.start(undefined);
    await request.runWith(async () => {
      const model = wrapModelWithObservability(
        createFakeAdapter({ id: "openrouter" }).createModel(MODEL),
        request.logger
      );
      if (operation === "generate") {
        await model.doGenerate(callOptions());
      } else {
        await readStreamParts(await model.doStream(callOptions()));
      }
      const ai = request.logger.getContext().ai;
      assert.ok(isRecord(ai));
      assert.equal(ai.calls, 1);
      assert.equal(ai.model, MODEL);
      assert.equal(ai.inputTokens, 1);
      assert.equal(ai.outputTokens, 1);
      assert.equal(ai.totalTokens, 2);
      assert.equal(ai.finishReason, "stop");
    });
  });

  test(`routed ${operation} wrappers created outside the request keep interim request totals`, async () => {
    const { router } = createTestRouter();
    const request = evlogRequestIntegration.start(undefined);
    const models = [MODEL, "openai/gpt-5.4-mini"].map((modelId) =>
      wrapModelWithObservability(
        router.model(modelId, { organizationId: FREE_ORG }),
        request.logger
      )
    );
    await request.runWith(async () => {
      for (const [index, model] of models.entries()) {
        if (operation === "generate") {
          await model.doGenerate(callOptions());
        } else {
          await readStreamParts(await model.doStream(callOptions()));
        }
        const ai = request.logger.getContext().ai;
        assert.ok(isRecord(ai));
        assert.equal(ai.calls, index + 1);
        assert.equal(ai.totalTokens, (index + 1) * 2);
        assert.equal(ai.finishReason, "stop");
      }
    });
  });

  test(`request usage owns totals across separately wrapped ${operation} models`, async () => {
    const { router, logger } = createTestRouter();
    const request = evlogRequestIntegration.start(undefined);
    await request.runWith(async () => {
      for (const modelId of [MODEL, "openai/gpt-5.4-mini"]) {
        const base = router.model(modelId, { organizationId: FREE_ORG });
        const generate = base.doGenerate.bind(base);
        base.doGenerate = async (options) => {
          const result = await generate(options);
          result.content.push({
            type: "tool-call",
            toolCallId: "tool_fixture",
            toolName: "fixture_tool",
            input: "{}",
          });
          return result;
        };
        const model = wrapModelWithObservability(base, request.logger);
        if (operation === "generate") {
          await model.doGenerate(callOptions());
        } else {
          await readStreamParts(await model.doStream(callOptions()));
        }
      }
      const ai = request.logger.getContext().ai;
      assert.ok(isRecord(ai));
      assert.equal(ai.calls, 2);
      assert.equal(ai.inputTokens, 2);
      assert.equal(ai.outputTokens, 2);
      assert.equal(ai.totalTokens, 4);
      assert.deepEqual(ai.models, [MODEL, "openai/gpt-5.4-mini"]);
      assert.equal(ai.finishReason, "stop");
      if (operation === "generate") {
        assert.deepEqual(ai.toolCalls, ["fixture_tool", "fixture_tool"]);
      }
      assert.equal(
        logger.entries.filter(({ event }) => event === "ai.call.completed")
          .length,
        2
      );
    });
  });
}
