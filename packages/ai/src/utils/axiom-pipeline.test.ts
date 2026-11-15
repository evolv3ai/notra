import { afterAll, expect, spyOn, test } from "bun:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { setTimeout as sleep } from "node:timers/promises";
import { gunzipSync } from "node:zlib";

import { TELEMETRY_TEST_EVENT } from "@notra/ai/constants/telemetry-test";
import type { WideEvent } from "evlog";

import { createAxiomPipeline } from "./axiom-pipeline";
import { sendAxiomBatch } from "./send-axiom-batch";

const received: Request[] = [];
let status = 200;
let reply = "{}";
let delayMs = 0;
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value !== undefined) {
      headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }
  }
  received.push(
    new Request(`${baseUrl}${request.url}`, {
      method: request.method,
      headers,
      body: Buffer.concat(chunks),
    })
  );
  if (delayMs) {
    await sleep(delayMs);
  }
  response.writeHead(status, status === 307 ? { Location: "/redirected" } : {});
  response.end(reply);
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
if (!address || typeof address === "string") {
  throw new Error("Test server has no TCP address");
}
const baseUrl = `http://127.0.0.1:${address.port}`;
const config = {
  apiKey: "test-only",
  dataset: "synthetic test",
  baseUrl,
  orgId: "test-org",
};
const events: WideEvent[] = Array.from({ length: 50 }, (_, i) => ({
  ...TELEMETRY_TEST_EVENT,
  timestamp: new Date().toISOString(),
  event: "network.optimization.test",
  sequence: i,
  message: "Synthetic event — no customer data",
}));
afterAll(() => {
  server.closeAllConnections();
  server.close();
});

test("real HTTP receiver decompresses the identical batch and receives auth, org and timestamp settings", async () => {
  await sendAxiomBatch(events, config);
  const request = received.at(-1);
  assert.ok(request);
  expect(request.headers.get("content-encoding")).toBe("gzip");
  expect(request.headers.get("authorization")).toBe("Bearer test-only");
  expect(request.headers.get("x-axiom-org-id")).toBe("test-org");
  expect(request.redirect).toBe("follow");
  expect(new URL(request.url).pathname).toBe(
    "/v1/datasets/synthetic%20test/ingest"
  );
  expect(new URL(request.url).searchParams.get("timestamp-field")).toBe(
    "timestamp"
  );
  const bytes = Buffer.from(await request.arrayBuffer());
  expect(JSON.parse(gunzipSync(bytes).toString())).toEqual(events);
  expect(bytes.byteLength).toBeLessThan(
    Buffer.byteLength(JSON.stringify(events)) / 2
  );
});

test("empty batches skip I/O; tiny payloads use JSON when gzip would be larger; edge URLs remain supported", async () => {
  const before = received.length;
  await sendAxiomBatch([], config);
  expect(received).toHaveLength(before);
  await sendAxiomBatch([{} as WideEvent], config);
  const tiny = received.at(-1);
  assert.ok(tiny);
  expect(tiny.headers.get("content-encoding")).toBeNull();
  expect(await tiny.json()).toEqual([{}]);
  for (const path of ["/", "/custom/"]) {
    await sendAxiomBatch(events, {
      apiKey: "test-only",
      dataset: "edge",
      edgeUrl: `${config.baseUrl}${path}`,
    });
    const request = received.at(-1);
    assert.ok(request);
    expect(new URL(request.url).pathname).toBe(
      path === "/" ? "/v1/ingest/edge" : "/custom"
    );
  }
});

test("redirects reject without forwarding the batch", async () => {
  const before = received.length;
  status = 307;
  try {
    await expect(sendAxiomBatch(events, config)).rejects.toThrow();
    expect(received.length - before).toBe(1);
  } finally {
    status = 200;
  }
});

test("pipeline retries transient errors, disables permanent failures and never exposes response secrets", async () => {
  const warnings = spyOn(console, "warn").mockImplementation(() => {});
  const errors = spyOn(console, "error").mockImplementation(() => {});
  const options = {
    batch: { size: 50, intervalMs: 60_000 },
    retry: { maxAttempts: 3, initialDelayMs: 1, maxDelayMs: 1 },
  };
  try {
    for (const failure of [429, 503]) {
      status = failure;
      reply = "private-response-marker";
      const before = received.length;
      const pipeline = createAxiomPipeline(config, options);
      pipeline({ event: TELEMETRY_TEST_EVENT });
      await pipeline.flush();
      expect(received.length - before).toBe(3);
      expect(pipeline.pending).toBe(0);
    }
    for (const failure of [401, 403, 404]) {
      status = failure;
      const before = received.length;
      const pipeline = createAxiomPipeline(config, options);
      pipeline({ event: TELEMETRY_TEST_EVENT });
      await pipeline.flush();
      pipeline({ event: TELEMETRY_TEST_EVENT });
      await pipeline.flush();
      expect(received.length - before).toBe(1);
    }
    expect(
      JSON.stringify([...warnings.mock.calls, ...errors.mock.calls])
    ).not.toContain("private-response-marker");
  } finally {
    status = 200;
    reply = "{}";
    warnings.mockRestore();
    errors.mockRestore();
  }
});

test("partial success and malformed success bodies are not replayed; timeouts still reject", async () => {
  const warnings = spyOn(console, "warn").mockImplementation(() => {});
  try {
    for (const response of [
      '{"failed":1,"messages":["private-response-marker"]}',
      "not-json",
    ]) {
      reply = response;
      const before = received.length;
      const pipeline = createAxiomPipeline(config);
      pipeline({ event: TELEMETRY_TEST_EVENT });
      await pipeline.flush();
      await pipeline.flush();
      expect(received.length - before).toBe(1);
    }
    expect(warnings.mock.calls.length).toBe(2);
    expect(JSON.stringify(warnings.mock.calls)).not.toContain(
      "private-response-marker"
    );
    delayMs = 100;
    await expect(
      sendAxiomBatch(events, { ...config, timeout: 10 })
    ).rejects.toThrow();
  } finally {
    delayMs = 0;
    reply = "{}";
    warnings.mockRestore();
  }
});
