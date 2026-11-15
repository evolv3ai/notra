import assert from "node:assert/strict";
import { test } from "node:test";

import { createModelRouter } from "../create-router";
import {
  callOptions,
  createCaptureLogger,
  createFakeAdapter,
  createPolicy,
  metadataOf,
  readStreamParts,
} from "../test-helpers";
import { createNeonAdapter } from "./neon";

test("native Neon endpoints preserve authentication, options, responses and usage", async () => {
  for (const [modelId, path, response] of [
    [
      "openai/gpt-6-luna",
      "/openai/v1/responses",
      {
        id: "resp_fixture",
        created_at: 0,
        model: "gpt-6-luna",
        output: [
          {
            type: "message",
            id: "msg_fixture",
            role: "assistant",
            content: [{ type: "output_text", text: "OK", annotations: [] }],
          },
        ],
        usage: { input_tokens: 3, output_tokens: 1 },
      },
    ],
    [
      "anthropic/claude-sonnet-5",
      "/anthropic/v1/messages",
      {
        id: "msg_fixture",
        type: "message",
        role: "assistant",
        model: "claude-sonnet-5",
        content: [{ type: "text", text: "OK" }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 3, output_tokens: 1 },
      },
    ],
    [
      "google/gemini-3-flash",
      "/gemini/v1beta/models/gemini-3-flash:generateContent",
      {
        candidates: [
          {
            content: { role: "model", parts: [{ text: "OK" }] },
            finishReason: "STOP",
          },
        ],
        usageMetadata: {
          promptTokenCount: 3,
          candidatesTokenCount: 1,
          totalTokenCount: 4,
        },
      },
    ],
    [
      "openai/gpt-oss-120b",
      "/v1/chat/completions",
      {
        id: "chat_fixture",
        created: 0,
        model: "gpt-oss-120b",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "OK" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
      },
    ],
  ] as const) {
    let requests = 0;
    const adapter = createNeonAdapter({
      apiKey: "fixture-key",
      baseURL: "https://neon.test/v1/",
      fetch: async (input, init) => {
        requests += 1;
        assert.equal(new URL(String(input)).pathname, path);
        assert.equal(
          new Headers(init?.headers).get("authorization"),
          "Bearer fixture-key"
        );
        const body = JSON.parse(String(init?.body));
        assert.equal(body.gateway, undefined);
        assert.equal(body.openrouter, undefined);
        if (modelId === "openai/gpt-6-luna") {
          assert.equal(body.store, false);
          assert.equal(body.reasoning.effort, "low");
        } else if (modelId.startsWith("anthropic/")) {
          assert.deepEqual(body.cache_control, { type: "ephemeral" });
          assert.equal(body.max_tokens, 128);
        } else if (modelId.startsWith("google/")) {
          assert.equal(body.generationConfig.maxOutputTokens, 128);
        } else {
          assert.equal(body.model, "gpt-oss-120b");
        }
        return Response.json(response);
      },
    });
    const router = createModelRouter({
      adapters: { neon: adapter },
      policy: createPolicy({ defaultGateway: "neon" }),
      resolvePlan: async () => "free",
    });
    const result = await router.model(modelId, { zdr: "none" }).doGenerate({
      ...callOptions({
        gateway: { caching: "auto" },
        openai: { reasoningEffort: "low" },
      }),
      maxOutputTokens: 128,
    });
    assert.equal(requests, 1);
    assert.equal(
      result.content.find((part) => part.type === "text")?.text,
      "OK"
    );
    assert.equal(result.usage.inputTokens.total, 3);
    assert.equal(result.usage.outputTokens.total, 1);
    assert.equal(metadataOf(result)?.gateway, "neon");
    assert.equal(metadataOf(result)?.model, modelId);
  }
});

test("a native Gemini stream retains text and usage", async () => {
  const adapter = createNeonAdapter({
    apiKey: "fixture-key",
    baseURL: "https://neon.test",
    fetch: async (input, init) => {
      const url = new URL(String(input));
      assert.equal(
        url.pathname,
        "/gemini/v1beta/models/gemini-3-flash:streamGenerateContent"
      );
      assert.equal(url.searchParams.get("alt"), "sse");
      assert.equal(
        new Headers(init?.headers).get("authorization"),
        "Bearer fixture-key"
      );
      return new Response(
        `data: ${JSON.stringify({
          candidates: [
            {
              content: { role: "model", parts: [{ text: "OK" }] },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 3,
            candidatesTokenCount: 1,
            totalTokenCount: 4,
          },
        })}\n\n`,
        { headers: { "Content-Type": "text/event-stream" } }
      );
    },
  });
  const parts = await readStreamParts(
    await adapter.createModel("google/gemini-3-flash").doStream(callOptions())
  );
  assert.equal(parts.find((part) => part.type === "text-delta")?.delta, "OK");
  const finish = parts.find((part) => part.type === "finish");
  assert.equal(finish?.usage.inputTokens.total, 3);
  assert.equal(finish?.usage.outputTokens.total, 1);
  assert.equal(
    parts.some((part) => part.type === "error"),
    false
  );
});

test("a retryable native Neon failure falls back before generate or stream starts", async () => {
  for (const operation of ["generate", "stream"] as const) {
    let requests = 0;
    const neon = createNeonAdapter({
      apiKey: "fixture-key",
      baseURL: "https://neon.test",
      fetch: async (input) => {
        requests += 1;
        assert.equal(new URL(String(input)).pathname, "/openai/v1/responses");
        return Response.json(
          { error: { message: "fixture outage", type: "server_error" } },
          { status: 503 }
        );
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
    const model = router.model("openai/gpt-6-luna", { zdr: "none" });
    if (operation === "generate") {
      assert.equal(
        metadataOf(await model.doGenerate(callOptions()))?.gateway,
        "vercel"
      );
    } else {
      const parts = await readStreamParts(await model.doStream(callOptions()));
      assert.equal(
        metadataOf(parts.find((part) => part.type === "finish") ?? {})?.gateway,
        "vercel"
      );
    }
    assert.equal(requests, 1);
    assert.equal(vercel.calls.length, 1);
    assert.ok(
      logger.entries.some(
        (entry) =>
          entry.event === "ai.router.fallback" &&
          entry.fields?.fallbackReason === "upstream-error"
      )
    );
  }
});
