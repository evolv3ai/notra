import { expect, test } from "bun:test";
import { createServer } from "node:http";

import { createOctokit } from "./octokit";

test("branch clients retry an idempotent read once and never retry a write", async () => {
  let reads = 0;
  let writes = 0;
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.method === "GET") {
      reads += 1;
      response.writeHead(reads > 1 ? 200 : 503);
      response.end(JSON.stringify({ ok: reads > 1 }));
      return;
    }
    writes += 1;
    response.writeHead(503);
    response.end(JSON.stringify({ message: "Synthetic outage" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Missing local server port");
  }
  try {
    const client = createOctokit("local-fake-token", {
      baseUrl: `http://127.0.0.1:${address.port}`,
      requestTimeoutMs: 1000,
      retryReads: true,
    });
    expect((await client.request("GET /test")).status).toBe(200);
    await expect(client.request("POST /test")).rejects.toThrow();
    expect(reads).toBe(2);
    expect(writes).toBe(1);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("branch client request timeouts abort a stalled transport", async () => {
  const server = createServer(() => {});
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Missing local server port");
  }
  try {
    const client = createOctokit("local-fake-token", {
      baseUrl: `http://127.0.0.1:${address.port}`,
      requestTimeoutMs: 25,
    });
    const started = Date.now();
    await expect(client.request("GET /stalled")).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(2000);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
