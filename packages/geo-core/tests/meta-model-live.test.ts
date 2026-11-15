import { expect, mock, test } from "bun:test";

import { MockLanguageModelV4 } from "ai/test";
import { Effect } from "effect";

import { GeoModelService } from "../src/deps";
import { resolveGroundedEngineByKey } from "../src/utils/geo-grounded-engines";

const model = new MockLanguageModelV4({
  doGenerate: async () => ({
    content: [
      {
        type: "tool-call",
        toolCallId: "meta-search",
        toolName: "web_search",
        input: "{}",
        providerExecuted: true,
      },
      {
        type: "tool-result",
        toolCallId: "meta-search",
        toolName: "web_search",
        result: { action: { type: "search", query: "email tools" } },
      },
      {
        type: "source",
        sourceType: "url",
        id: "meta-citation",
        url: "https://example.com/email-tools",
        title: "Email tools",
      },
      { type: "text", text: "Answer with a citation." },
    ],
    finishReason: { unified: "stop", raw: "stop" },
    usage: {
      inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 1, text: 1, reasoning: 0 },
    },
    warnings: [],
  }),
});

const actualGateway = await import("@notra/ai/gateway");
const routedModel = mock<typeof actualGateway.gateway>(() => model);
mock.module("@notra/ai/gateway", () => ({
  ...actualGateway,
  gateway: routedModel,
}));

const { buildGroundedInvocation } = await import("../src/geo/engines");
const { geoModelLive } = await import("../src/geo/model-live");

test("Muse search retains queries and citations without enabling ZDR or prompt training", async () => {
  const engine = resolveGroundedEngineByKey("meta/muse-wonder-1.0-grounded");
  if (!engine) {
    throw new Error("Muse Wonder should have a search route");
  }
  const answer = await Effect.runPromise(
    GeoModelService.pipe(
      Effect.flatMap((service) =>
        service.groundedAnswer({
          organizationId: "test-org",
          engine,
          messages: [{ role: "user", content: "Which email tools?" }],
          zdr: "none",
        })
      ),
      Effect.provide(geoModelLive)
    )
  );
  expect(routedModel).toHaveBeenCalledWith(
    "meta/muse-wonder-1.0",
    expect.objectContaining({ organizationId: "test-org", zdr: "none" })
  );
  expect(routedModel.mock.calls[0]?.[1]?.gateway).toBeUndefined();
  expect(model.doGenerateCalls[0]?.tools).toContainEqual(
    expect.objectContaining({
      type: "provider",
      id: "openai.web_search",
      name: "web_search",
    })
  );
  expect(model.doGenerateCalls[0]?.providerOptions?.gateway).toMatchObject({
    disallowPromptTraining: true,
  });
  expect(answer.text).toBe("Answer with a citation.");
  expect(answer.grounding.queries).toEqual(["email tools"]);
  expect(answer.grounding.sources).toEqual([
    {
      url: "https://example.com/email-tools",
      title: "Email tools",
      domain: "example.com",
    },
  ]);
  expect(answer.sources).toEqual([
    { url: "https://example.com/email-tools", title: "Email tools" },
  ]);
  expect(() => buildGroundedInvocation(engine, { zdr: "required" })).toThrow(
    "Meta web search does not support zero data retention"
  );
});
