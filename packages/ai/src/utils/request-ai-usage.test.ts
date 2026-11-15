import assert from "node:assert/strict";
import { test } from "node:test";

import { ROUTER_METADATA_KEY } from "@notra/ai/constants/router";
import { MODEL, PAID_ORG } from "@notra/ai/constants/router-test";
import {
  callOptions,
  createFakeAdapter,
  createTestRouter,
} from "@notra/ai/router/test-helpers";
import type { GatewayRouteMetadata } from "@notra/ai/types/router";
import { isRecord } from "@notra/utils/unknown-record";
import type { WideEvent } from "evlog";

import {
  evlogRequestIntegration,
  trackRequestLoggerEmit,
} from "./evlog-request";
import { recordRequestAICost, recordRequestAIUsage } from "./request-ai-usage";

test("final real request totals distinguish incomplete costs, measured zero and a stale earlier subtotal", async () => {
  for (const costs of [
    [0.5, undefined],
    [undefined],
    [0],
    [undefined, 0.5],
    [0.5, 0],
  ]) {
    const events: WideEvent[] = [];
    const request = evlogRequestIntegration.start(undefined, {
      drain: ({ event }) => {
        events.push(event);
      },
    });
    trackRequestLoggerEmit(request.logger);
    await request.runWith(async () => {
      request.logger.set({
        ai: { msToFirstChunk: 3, toolCalls: ["fixture_tool"] },
      });
      for (const cost of costs) {
        recordRequestAIUsage({
          model: MODEL,
          inputTokens: 2,
          outputTokens: 1,
          providerMetadata: {
            [ROUTER_METADATA_KEY]: {
              gateway: "openrouter",
              ...(cost === undefined
                ? {}
                : { costUsd: cost, byokInferenceCostUsd: 0 }),
            },
          },
        });
      }
      await request.finish({ status: 200 });
    });
    assert.equal(events.length, 1);
    const ai = events[0]?.ai;
    assert.ok(isRecord(ai));
    assert.equal(ai.calls, costs.length);
    assert.equal(ai.totalTokens, costs.length * 3);
    assert.equal(ai.msToFirstChunk, 3);
    assert.deepEqual(ai.toolCalls, ["fixture_tool"]);
    assert.equal(
      ai.costUsd,
      costs.includes(undefined)
        ? undefined
        : costs.reduce<number>((sum, cost) => sum + (cost ?? 0), 0)
    );
    if (costs.includes(undefined)) {
      assert.equal(JSON.stringify(ai).includes('"costUsd"'), false);
    }
  }
});

test("existing Vercel enrichment resolves pending costs once, including zero, and cannot change a closed request", async () => {
  for (const costUsd of [0, 0.5]) {
    const adapter = createFakeAdapter({ id: "vercel" });
    let resolveLookup!: (metadata: GatewayRouteMetadata) => void;
    const lookup = new Promise<GatewayRouteMetadata>((resolve) => {
      resolveLookup = resolve;
    });
    adapter.lookupRouteMetadata = () => lookup;
    const { router } = createTestRouter({ vercel: adapter });
    const events: WideEvent[] = [];
    const request = evlogRequestIntegration.start(undefined, {
      drain: ({ event }) => {
        events.push(event);
      },
    });
    trackRequestLoggerEmit(request.logger);
    await request.runWith(async () => {
      const result = await router
        .model(MODEL, { organizationId: PAID_ORG, gateway: "vercel" })
        .doGenerate(callOptions());
      const metadata = router.getRouteMetadata(result.providerMetadata);
      assert.ok(metadata);
      const before = request.logger.getContext().ai;
      assert.ok(isRecord(before));
      assert.equal(before.costUsd, undefined);
      recordRequestAICost("unrelated_generation", 100);
      const enrichment = router.enrichRouteMetadata(metadata);
      resolveLookup({ costUsd, model: MODEL });
      await enrichment;
      await router.enrichRouteMetadata(metadata);
      await request.finish({ status: 200 });
      recordRequestAICost("gen_test", 100);
    });
    assert.equal(events.length, 1);
    const ai = events[0]?.ai;
    assert.ok(isRecord(ai));
    assert.equal(ai.calls, 1);
    assert.equal(ai.costUsd, costUsd);
    assert.equal(ai.totalTokens, 2);
  }
});
