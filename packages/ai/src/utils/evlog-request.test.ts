import { mock, spyOn } from "bun:test";
import assert from "node:assert/strict";
import { test } from "node:test";

import type { DrainContext, WideEvent } from "evlog";

import {
  evlogRequestIntegration,
  trackRequestLoggerEmit,
  useRequestLogger,
} from "./evlog-request";
import { httpErrorKind } from "./http-error-kind";
import {
  getOperationalContext,
  runWithOperationalContext,
} from "./operational-context";
import { telemetryEvent } from "./telemetry-event";
import { telemetryValue } from "./telemetry-value";

test("final request outcome follows body failures without changing the sent status or lazy attribution", async () => {
  for (const status of [200, 403]) {
    const events: WideEvent[] = [];
    const request = evlogRequestIntegration.start(undefined, {
      drain: ({ event }) => {
        events.push(event);
      },
    });
    trackRequestLoggerEmit(request.logger);
    request.logger.set({
      event: "api.request.completed",
      outcome: status >= 400 ? "error" : "success",
      errorKind: httpErrorKind(status),
      organizationId: "org_stale",
    });
    if (status === 403) {
      request.logger.setLevel("warn");
    }
    let authorizedOrganization: string | undefined;
    const emit = request.logger.emit.bind(request.logger);
    request.logger.emit = (overrides) =>
      emit({ ...overrides, organizationId: authorizedOrganization });
    let reads = 0;
    const response = await request.finishResponse(
      new Response(
        new ReadableStream({
          pull(controller) {
            if (reads++ === 0) {
              controller.enqueue(new TextEncoder().encode("partial"));
            } else {
              authorizedOrganization = "org_verified";
              controller.error(new Error("fixture body failure"));
            }
          },
        }),
        { status, headers: { "content-type": "text/event-stream" } }
      )
    );
    assert.equal(response.status, status);
    assert.equal(events.length, 0);
    await assert.rejects(response.text(), /fixture body failure/);
    assert.equal(events.length, 1);
    assert.equal(events[0]?.status, 500);
    assert.equal(events[0]?.outcome, "error");
    assert.equal(events[0]?.errorKind, "server_error");
    assert.equal(events[0]?.level, "error");
    assert.equal(events[0]?.organizationId, "org_verified");
  }
});

test("normal final requests preserve client-error levels and clear stale error kinds", async () => {
  for (const status of [200, 403]) {
    const events: WideEvent[] = [];
    const request = evlogRequestIntegration.start(undefined, {
      drain: ({ event }) => {
        events.push(event);
      },
    });
    trackRequestLoggerEmit(request.logger);
    request.logger.set({ outcome: "error", errorKind: "server_error" });
    if (status === 403) {
      request.logger.setLevel("warn");
    }
    const response = await request.finishResponse(
      new Response(null, { status })
    );
    assert.equal(response.status, status);
    assert.equal(events.length, 1);
    assert.equal(events[0]?.outcome, status >= 400 ? "error" : "success");
    assert.equal(events[0]?.errorKind, httpErrorKind(status));
    assert.equal(events[0]?.level, status === 403 ? "warn" : "info");
  }
});

test("request intake replaces unsafe IDs before the logger and final destinations see them", async () => {
  for (const candidate of [
    undefined,
    "",
    "x".repeat(257),
    "sk_fixture_credential",
    "header.payload.signature",
    "request:header.payload.signature:1",
    "request_fixture.123",
    "550e8400-e29b-41d4-a716-446655440000",
  ]) {
    const events: WideEvent[] = [];
    const request = evlogRequestIntegration.start(
      new Request("https://fixture.invalid/rpc", {
        headers: candidate === undefined ? {} : { "x-request-id": candidate },
      }),
      {
        drain: ({ event }) => {
          events.push(event);
        },
      }
    );
    const id = request.logger.getContext().requestId;
    assert.equal(telemetryValue("requestId", id), true);
    if (telemetryValue("requestId", candidate)) {
      assert.equal(id, candidate);
    } else {
      assert.notEqual(id, candidate);
    }
    await request.finish({ status: 200 });
    assert.equal(events.length, 1);
    assert.equal(events[0]?.requestId, id);
    assert.ok(events[0]);
    assert.equal(telemetryEvent(events[0]).requestId, id);
  }
});

test("validated parent IDs and nested streams share one safe ID in the rich sink", async () => {
  const rich: WideEvent[] = [];
  mock.module("@notra/ai/utils/evlog-runtime", () => ({
    getEvlogRuntime: () => ({
      aiDrain: Object.assign(
        ({ event }: DrainContext) => {
          rich.push(event);
        },
        { flush: async () => {} }
      ),
    }),
  }));
  const network = spyOn(globalThis, "fetch").mockImplementation(() => {
    throw new Error("Unexpected network");
  });
  const { withEvlog } = await import("../evlog");
  try {
    for (const parentId of [
      "req_parent",
      "request:header.payload.signature:1",
    ]) {
      rich.length = 0;
      let id: unknown;
      const nested = withEvlog(() => {
        assert.equal(useRequestLogger().getContext().requestId, id);
        assert.equal(getOperationalContext()?.requestId, id);
      });
      const handle = withEvlog(async () => {
        id = useRequestLogger().getContext().requestId;
        assert.equal(telemetryValue("requestId", id), true);
        assert.equal(getOperationalContext()?.requestId, id);
        await nested();
        return new Response("fixture");
      });
      const response = await runWithOperationalContext(
        { requestId: parentId },
        handle
      );
      await response.text();
      assert.equal(rich.length, 1);
      assert.equal(rich[0]?.requestId, id);
      if (telemetryValue("requestId", parentId)) {
        assert.equal(id, parentId);
      } else {
        assert.notEqual(id, parentId);
      }
    }
    assert.equal(network.mock.calls.length, 0);
  } finally {
    network.mockRestore();
  }
});
