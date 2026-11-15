import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { setTimeout } from "node:timers/promises";

import { GEO_OPENCODE_SOURCE_LIMIT } from "@notra/ai/constants/geo-opencode";
import type { GeoBoxAnswer } from "@notra/ai/types/geo-opencode";
import { Agent } from "@upstash/box";

import { askGeoOpenCode, askGeoOpenCodeConversation } from "./geo-opencode";

const originalFetch = globalThis.fetch;
const originalBoxKey = process.env.UPSTASH_BOX_API_KEY;
const originalModelKey = process.env.OPENROUTER_API_KEY;
const originalGatewayKey = process.env.AI_GATEWAY_API_KEY;
const requests: { url: string; init?: RequestInit }[] = [];
let streamResponse: () => Response | Promise<Response>;
let deleteResponse: () => Response;

function event(type: string, data: unknown) {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

function completed(output = "A result https://answer.example/source") {
  return new Response(
    event("done", {
      output,
      input_tokens: 12,
      output_tokens: 3,
      cached_input_tokens: 2,
      total_cost_usd: 0.04,
      session_id: "session-1",
    })
  );
}

beforeEach(() => {
  process.env.UPSTASH_BOX_API_KEY = "test-box-key";
  process.env.OPENROUTER_API_KEY = "test-model-key";
  process.env.AI_GATEWAY_API_KEY = "test-gateway-key";
  requests.length = 0;
  streamResponse = () => completed();
  deleteResponse = () => new Response(null, { status: 204 });
  globalThis.fetch = mock<typeof fetch>(async (input, init) => {
    const url = String(input);
    requests.push({ url, init });
    if (url.endsWith("/run/stream")) {
      return streamResponse();
    }
    if (url.endsWith("/v2/box") && init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      return Response.json({ id: "box-1", status: "idle", ...body });
    }
    if (url.endsWith("/v2/box") && init?.method === "DELETE") {
      return deleteResponse();
    }
    throw new Error(`Unexpected mocked Box request: ${init?.method} ${url}`);
  });
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
  if (originalModelKey === undefined) {
    delete process.env.OPENROUTER_API_KEY;
  } else {
    process.env.OPENROUTER_API_KEY = originalModelKey;
  }
});

describe("GEO Box coding providers (real SDK, mocked HTTP)", () => {
  test.each([
    [
      "opencode",
      Agent.OpenCode,
      { reasoningEffort: "medium", textVerbosity: "medium" },
    ],
    ["claude-code", Agent.ClaudeCode, { effort: "medium" }],
    [
      "codex",
      Agent.Codex,
      { model_reasoning_effort: "medium", web_search: true },
    ],
  ] as const)(
    "routes %s credentials, model, and options",
    async (harness, agent, options) => {
      delete process.env.OPENROUTER_API_KEY;
      const model = "test/provider-model";
      const observed: GeoBoxAnswer[] = [];
      const result = await askGeoOpenCode(
        "question",
        undefined,
        undefined,
        model,
        harness,
        (answer) => observed.push(answer)
      );
      expect(observed).toEqual([result]);
      expect(requests.map(({ init }) => init?.method)).toEqual([
        "POST",
        "POST",
        "DELETE",
      ]);
      expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({
        name: expect.stringMatching(/^notra-geo-[\da-f-]+$/u),
        runtime: "node",
        agent,
        model: `vercel/${model}`,
        agent_api_key: "test-gateway-key",
      });
      expect(JSON.parse(String(requests[1]?.init?.body))).toEqual({
        prompt: "question",
        agent_options: options,
      });
      expect(
        requests.every(({ url }) =>
          url.startsWith("https://us-east-1.box.upstash.com/")
        )
      ).toBe(true);
      expect(JSON.parse(String(requests[2]?.init?.body))).toEqual({
        ids: ["box-1"],
      });
      expect(result).toMatchObject({
        text: "A result https://answer.example/source",
        sources: [{ url: "https://answer.example/source", title: null }],
        groundingSources: [],
        usage: {
          modelId: model,
          totalUsd: 0.04,
          inputTokens: harness === "claude-code" ? 14 : 12,
          outputTokens: 3,
          totalTokens: harness === "claude-code" ? 17 : 15,
          inputTokenDetails: {
            noCacheTokens: harness === "claude-code" ? 12 : 10,
            cacheReadTokens: 2,
          },
        },
      });
    }
  );

  test("keeps turns ordered in one box and separates tool evidence from answer links", async () => {
    let turn = 0;
    streamResponse = () => {
      turn += 1;
      return new Response(
        event("tool", {
          tool_call_id: `tool-${turn}`,
          name: "webfetch",
          input: { url: `https://input.example/${turn}` },
        }) +
          event("tool_result", {
            tool_call_id: `tool-${turn}`,
            output: { nested: ["https://evidence.example/page"] },
          }) +
          event("done", {
            output: `answer ${turn} https://answer.example/${turn}`,
            input_tokens: turn,
            output_tokens: 1,
            total_cost_usd: 0.04,
          })
      );
    };
    const observed: GeoBoxAnswer[] = [];
    const results = await askGeoOpenCodeConversation(
      ["first", "follow up"],
      undefined,
      undefined,
      "openai/gpt-6-astra",
      "codex",
      (answer) => observed.push(answer)
    );
    expect(observed).toEqual(results);
    expect(results.map((result) => result.usage.totalUsd)).toEqual([
      0.04, 0.04,
    ]);
    expect(
      requests
        .filter(({ url }) => url.endsWith("/run/stream"))
        .map(({ init }) => JSON.parse(String(init?.body)).prompt)
    ).toEqual(["first", "follow up"]);
    expect(
      requests.filter(({ init }) => init?.method === "DELETE")
    ).toHaveLength(1);
    expect(results.map(({ text }) => text)).toEqual([
      "answer 1 https://answer.example/1",
      "answer 2 https://answer.example/2",
    ]);
    expect(results[1]?.groundingSources).toEqual([
      { url: "https://input.example/2", title: null },
      { url: "https://evidence.example/page", title: null },
    ]);
    expect(results[1]?.toolCalls).toEqual([
      {
        toolCallId: "tool-2",
        name: "webfetch",
        input: { url: "https://input.example/2" },
      },
    ]);
    expect(results[1]?.usage.inputTokens).toBe(2);
  });

  test("caps answer and tool sources independently and deduplicates them", async () => {
    const links = Array.from(
      { length: 30 },
      (_, index) => `https://source.example/${index}`
    ).join(" ");
    streamResponse = () =>
      new Response(
        event("tool", { name: "search", input: [links, links] }) +
          event("done", { output: links })
      );
    const result = await askGeoOpenCode("question");
    expect(result.sources).toHaveLength(GEO_OPENCODE_SOURCE_LIMIT);
    expect(result.groundingSources).toEqual(result.sources);
  });

  test.each(["provider", "cleanup", "cancellation"])(
    "exposes completed turns and usage before a later %s failure",
    async (failure) => {
      const controller = new AbortController();
      const results: GeoBoxAnswer[] = [];
      let turn = 0;
      streamResponse = () => {
        turn += 1;
        if (turn === 2 && failure === "provider") {
          return new Response(event("error", { error: "later turn failed" }));
        }
        if (turn === 2 && failure === "cancellation") {
          controller.abort(new Error("cancelled after first turn"));
        }
        return completed(`answer ${turn}`);
      };
      if (failure === "cleanup") {
        deleteResponse = () => {
          expect(results).toHaveLength(2);
          return Response.json({ error: "cleanup forbidden" }, { status: 403 });
        };
      }

      await expect(
        askGeoOpenCodeConversation(
          ["first", "second"],
          controller.signal,
          undefined,
          "openai/gpt-6-astra",
          "codex",
          (result) => results.push(result)
        )
      ).rejects.toThrow();

      expect(results.map((result) => result.text)).toEqual(
        failure === "cleanup" ? ["answer 1", "answer 2"] : ["answer 1"]
      );
      expect(results[0]?.usage).toMatchObject({
        inputTokens: 12,
        outputTokens: 3,
        totalUsd: 0.04,
      });
      expect(
        requests.filter(({ init }) => init?.method === "DELETE")
      ).toHaveLength(1);
    }
  );

  test("charges Claude session cost increments instead of summing cumulative costs", async () => {
    const costs = [0.19786625, 0.21408225, 0.23034625];
    let turn = 0;
    streamResponse = () =>
      new Response(
        event("done", {
          output: `answer ${++turn}`,
          input_tokens: 2,
          output_tokens: 5,
          cached_input_tokens: 31_637,
          total_cost_usd: costs[turn - 1],
        })
      );
    const observed: GeoBoxAnswer[] = [];
    const results = await askGeoOpenCodeConversation(
      ["first", "second", "third"],
      undefined,
      undefined,
      "anthropic/claude-opus-5",
      "claude-code",
      (result) => observed.push(result)
    );
    expect(results[0]?.usage.totalUsd).toBeCloseTo(0.19786625, 8);
    expect(results[1]?.usage.totalUsd).toBeCloseTo(0.016216, 8);
    expect(results[2]?.usage.totalUsd).toBeCloseTo(0.016264, 8);
    expect(
      results.reduce((total, result) => total + (result.usage.totalUsd ?? 0), 0)
    ).toBeCloseTo(0.23034625, 8);
    expect(observed).toEqual(results);
  });

  test.each([
    [
      [0, 0.2, 0.3],
      [undefined, undefined, 0.1],
    ],
    [
      [0.1, 0.05, 0.12, 0.14],
      [0.1, undefined, undefined, 0.02],
    ],
    [
      [0.1, 0.05, 0.06, 0.12, 0.14],
      [0.1, undefined, undefined, undefined, 0.02],
    ],
    [
      [0.1, 0, 0.05, 0.12, 0.14],
      [0.1, undefined, undefined, undefined, 0.02],
    ],
  ] as const)(
    "does not reuse rejected Claude costs as a baseline for %j",
    async (costs, expected) => {
      let turn = 0;
      streamResponse = () =>
        new Response(
          event("done", {
            output: `answer ${++turn}`,
            input_tokens: 2,
            output_tokens: 5,
            total_cost_usd: costs[turn - 1],
          })
        );
      const observed: GeoBoxAnswer[] = [];
      const results = await askGeoOpenCodeConversation(
        costs.map((_, index) => `question ${index + 1}`),
        undefined,
        undefined,
        "anthropic/claude-opus-5",
        "claude-code",
        (result) => observed.push(result)
      );
      for (const [index, usd] of expected.entries()) {
        if (usd === undefined) {
          expect(results[index]?.usage.totalUsd).toBeUndefined();
        } else {
          expect(results[index]?.usage.totalUsd).toBeCloseTo(usd, 8);
        }
        expect(results[index]?.usage.inputTokens).toBe(2);
      }
      expect(observed).toEqual(results);
    }
  );

  test("does not need credentials or provision a box for no prompts", async () => {
    delete process.env.UPSTASH_BOX_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.AI_GATEWAY_API_KEY;
    expect(await askGeoOpenCodeConversation([])).toEqual([]);
    expect(requests).toHaveLength(0);
  });

  test.each(["opencode", "claude-code", "codex", "fx"] as const)(
    "%s requires the Gateway key before provisioning even with a Box key",
    async (harness) => {
      process.env.AI_GATEWAY_API_KEY = " \n ";
      await expect(
        askGeoOpenCode("question", undefined, undefined, "test/model", harness)
      ).rejects.toThrow("AI_GATEWAY_API_KEY is not configured");
      expect(requests).toHaveLength(0);
    }
  );

  test.each(["UPSTASH_BOX_API_KEY", "AI_GATEWAY_API_KEY"])(
    "fails before provisioning without %s",
    async (name) => {
      process.env[name] = "  ";
      await expect(askGeoOpenCode("question")).rejects.toThrow(
        `${name} is not configured`
      );
      expect(requests).toHaveLength(0);
    }
  );

  test("does not provision for an already cancelled conversation", async () => {
    const failure = new Error("cancelled by caller");
    await expect(
      askGeoOpenCode("question", AbortSignal.abort(failure))
    ).rejects.toBe(failure);
    expect(requests).toHaveLength(0);
  });

  test("does not provision after the shared deadline has expired", async () => {
    await expect(
      askGeoOpenCode("question", undefined, Date.now() - 1)
    ).rejects.toMatchObject({ name: "TimeoutError" });
    expect(requests).toHaveLength(0);
  });

  test("rejects clean stream EOF without terminal usage instead of accepting a partial answer", async () => {
    streamResponse = () =>
      new Response(event("text", { text: "incomplete answer" }));
    await expect(askGeoOpenCode("question")).rejects.toThrow(
      "without a finish event"
    );
    expect(requests.at(-1)?.init?.method).toBe("DELETE");
  });

  test.each(["", "  \n "])(
    "rejects an empty completed answer %j while retaining known usage and cleaning up",
    async (answer) => {
      const observed: GeoBoxAnswer[] = [];
      streamResponse = () => completed(answer);
      await expect(
        askGeoOpenCodeConversation(
          ["first", "must not run"],
          undefined,
          undefined,
          "openai/gpt-6-astra",
          "codex",
          (result) => observed.push(result)
        )
      ).rejects.toThrow("returned no result");
      expect(observed).toHaveLength(1);
      expect(observed[0]?.text).toBe("");
      expect(observed[0]?.usage.totalUsd).toBe(0.04);
      expect(requests).toHaveLength(3);
      expect(requests.at(-1)?.init?.method).toBe("DELETE");
    }
  );

  test("propagates a provider stream error and stops subsequent turns", async () => {
    streamResponse = () =>
      new Response(
        event("text", { text: "partial" }) +
          event("error", { error: "provider unavailable" })
      );
    await expect(
      askGeoOpenCodeConversation(["first", "must not run"])
    ).rejects.toThrow("provider unavailable");
    expect(requests).toHaveLength(3);
    expect(requests.at(-1)?.init?.method).toBe("DELETE");
  });

  test("preserves both run and cleanup failures", async () => {
    streamResponse = () =>
      new Response(event("error", { error: "run failed" }));
    deleteResponse = () =>
      Response.json({ error: "cleanup forbidden" }, { status: 403 });
    try {
      await askGeoOpenCode("question");
      throw new Error("Expected an aggregate failure");
    } catch (error) {
      expect(error).toBeInstanceOf(AggregateError);
      expect(
        (error as AggregateError).errors.map((failure) => failure.message)
      ).toEqual(["run failed", "cleanup forbidden"]);
    }
  });

  test("cancellation during streaming deletes the box even if the SDK body stalls", async () => {
    const controller = new AbortController();
    let streamController:
      | ReadableStreamDefaultController<Uint8Array>
      | undefined;
    const failure = new Error("cancelled during streaming");
    streamResponse = () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(value) {
            streamController = value;
            controller.abort(failure);
          },
        })
      );
    await expect(askGeoOpenCode("question", controller.signal)).rejects.toBe(
      failure
    );
    expect(requests.at(-1)?.init?.method).toBe("DELETE");
    streamController?.close();
    await setTimeout(0);
  });

  test("deadline expiry while reading a stalled body deletes the box", async () => {
    let streamController:
      | ReadableStreamDefaultController<Uint8Array>
      | undefined;
    streamResponse = () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(value) {
            streamController = value;
          },
        })
      );
    await expect(
      askGeoOpenCode("question", undefined, Date.now() + 30)
    ).rejects.toMatchObject({ name: "TimeoutError" });
    expect(requests.at(-1)?.init?.method).toBe("DELETE");
    streamController?.close();
    await setTimeout(0);
  });

  test("cancellation while opening a stream cleans up and handles a late SDK rejection", async () => {
    const controller = new AbortController();
    const failure = new Error("cancelled before stream headers");
    let rejectStream: ((error: Error) => void) | undefined;
    streamResponse = () =>
      new Promise<Response>((_resolve, reject) => {
        rejectStream = reject;
      });
    const pending = askGeoOpenCode("question", controller.signal);
    await setTimeout(0);
    controller.abort(failure);
    await expect(pending).rejects.toBe(failure);
    expect(requests.at(-1)?.init?.method).toBe("DELETE");
    rejectStream?.(new Error("late stream transport failure"));
    await setTimeout(0);
  });
});
