import { expect, test } from "bun:test";
import { createServer } from "node:http";
import { connect } from "node:net";

import { startDevProxy } from "../compiler/dev-server";
import type { DevAreaServer } from "../compiler/types/dev-server";
import { isLocalDevHost } from "../compiler/utils/dev-host";

test("local host validation rejects foreign and malformed authorities", () => {
  for (const host of [
    "localhost",
    "LOCALHOST:4321",
    "127.0.0.1:4321",
    "[::1]:4321",
  ]) {
    expect(isLocalDevHost(host)).toBe(true);
  }
  for (const host of [
    undefined,
    "",
    "attacker.example",
    "localhost.attacker.example",
    "attacker@localhost",
    "localhost/path",
    "localhost?query",
    "localhost#fragment",
  ]) {
    expect(isLocalDevHost(host)).toBe(false);
  }
});

test("foreign-host Markdown and upgrades are rejected before readiness or upstream access", async () => {
  let readyCalls = 0;
  let upstreamCalls = 0;
  const upstream = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => {
      upstreamCalls += 1;
      return new Response("Private preview");
    },
  });
  if (upstream.port === undefined) {
    throw new Error("The upstream server did not allocate a TCP port");
  }
  const proxy = await startDevProxy(
    0,
    { blog: "/blog" },
    [
      {
        area: "blog",
        mount: "/blog",
        port: upstream.port,
        paramsPath: "unused",
      },
    ],
    async () => {
      readyCalls += 1;
    }
  );
  const address = proxy.address();
  if (!address || typeof address === "string") {
    throw new Error("The proxy did not allocate a TCP port");
  }
  try {
    for (const host of [
      "attacker.example",
      "localhost.attacker.example",
      "attacker@localhost",
    ]) {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/blog/post.md`,
        { headers: { host } }
      );
      expect(response.status).toBe(403);
      expect(await response.text()).not.toContain("Private preview");
    }
    const client = connect(address.port, "127.0.0.1");
    let response = "";
    client.on("data", (chunk) => {
      response += chunk.toString();
    });
    const closed = new Promise<void>((resolve) =>
      client.once("close", () => resolve())
    );
    client.write(
      "GET / HTTP/1.1\r\nHost: attacker.example\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n"
    );
    await closed;
    expect(response).toBe("");
    expect(readyCalls).toBe(0);
    expect(upstreamCalls).toBe(0);
    const local = await fetch(`http://127.0.0.1:${address.port}/blog/post`);
    expect(await local.text()).toBe("Private preview");
    expect(readyCalls).toBe(1);
    expect(upstreamCalls).toBe(1);
  } finally {
    proxy.close();
    upstream.stop(true);
  }
});

test("blog.json redirects apply before the area servers, like the worker", async () => {
  let upstreamCalls = 0;
  const upstream = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => {
      upstreamCalls += 1;
      return new Response("Page");
    },
  });
  if (upstream.port === undefined) {
    throw new Error("The upstream server did not allocate a TCP port");
  }
  const proxy = await startDevProxy(
    0,
    { blog: "/blog" },
    [
      {
        area: "blog",
        mount: "/blog",
        port: upstream.port,
        paramsPath: "unused",
      },
    ],
    async () => undefined,
    () => [],
    () => [
      {
        source: "/blog/old-launch",
        destination: "/blog/2026/launch",
        status: 308,
      },
      {
        source: "/docs/*",
        destination: "https://docs.example.com/*",
        status: 307,
      },
    ]
  );
  const address = proxy.address();
  if (!address || typeof address === "string") {
    throw new Error("The proxy did not allocate a TCP port");
  }
  try {
    const exact = await fetch(
      `http://127.0.0.1:${address.port}/blog/old-launch/`,
      {
        redirect: "manual",
      }
    );
    expect(exact.status).toBe(308);
    expect(exact.headers.get("location")).toBe("/blog/2026/launch");
    expect(exact.headers.get("cache-control")).toBe("no-store");
    const wildcard = await fetch(
      `http://127.0.0.1:${address.port}/docs/getting started`,
      { redirect: "manual" }
    );
    expect(wildcard.status).toBe(307);
    expect(wildcard.headers.get("location")).toBe(
      "https://docs.example.com/getting%20started"
    );
    expect(upstreamCalls).toBe(0);
    const page = await fetch(
      `http://127.0.0.1:${address.port}/blog/2026/launch`
    );
    expect(await page.text()).toBe("Page");
  } finally {
    proxy.close();
    upstream.stop(true);
  }
});

test("document requests wait for the current refresh instead of loading an old or restarting page", async () => {
  let html = "Old snapshot";
  const upstream = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => new Response(html),
  });
  if (upstream.port === undefined) {
    throw new Error("The test server did not allocate a TCP port");
  }
  const ready = Promise.withResolvers<void>();
  const proxy = await startDevProxy(
    0,
    { blog: "/blog" },
    [
      {
        area: "blog",
        mount: "/blog",
        port: upstream.port,
        paramsPath: "unused",
      },
    ],
    () => ready.promise
  );
  const address = proxy.address();
  if (!address || typeof address === "string") {
    throw new Error("The proxy did not allocate a TCP port");
  }
  try {
    let completed = false;
    const request = fetch(`http://127.0.0.1:${address.port}/blog/post`);
    request.then(() => {
      completed = true;
    });
    await Bun.sleep(50);
    expect(completed).toBe(false);
    html = "Refreshed snapshot";
    ready.resolve();
    const response = await request;
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Refreshed snapshot");
  } finally {
    ready.resolve();
    proxy.close();
    upstream.stop(true);
  }
});

test("WebSocket upgrades wait for refreshed ports and reject failed readiness", async () => {
  const upgrades: string[] = [];
  const before = createServer();
  const after = createServer();
  for (const [server, label] of [
    [before, "before"],
    [after, "after"],
  ] as const) {
    server.on("upgrade", (_request, socket) => {
      upgrades.push(label);
      socket.end(
        "HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n"
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve)
    );
  }
  const beforeAddress = before.address();
  const afterAddress = after.address();
  if (
    !beforeAddress ||
    typeof beforeAddress === "string" ||
    !afterAddress ||
    typeof afterAddress === "string"
  ) {
    throw new Error("The upstream servers did not allocate TCP ports");
  }
  let ready = Promise.withResolvers<void>();
  const area: DevAreaServer = {
    area: "blog",
    mount: "/blog",
    port: beforeAddress.port,
    paramsPath: "unused",
  };
  const proxy = await startDevProxy(
    0,
    { blog: "/blog" },
    [area],
    () => ready.promise
  );
  const address = proxy.address();
  if (!address || typeof address === "string") {
    throw new Error("The proxy did not allocate a TCP port");
  }
  const client = connect(address.port, "127.0.0.1");
  let headers = "";
  client.on("data", (chunk) => {
    headers += chunk.toString();
  });
  const closed = new Promise<void>((resolve) =>
    client.once("close", () => resolve())
  );
  try {
    client.write(
      "GET /blog/ HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n"
    );
    await Bun.sleep(50);
    expect(upgrades).toEqual([]);
    area.port = afterAddress.port;
    ready.resolve();
    await closed;
    expect(upgrades).toEqual(["after"]);
    expect(headers).toContain("101 Switching Protocols");

    ready = Promise.withResolvers<void>();
    const rejected = connect(address.port, "127.0.0.1");
    let rejectedHeaders = "";
    rejected.on("data", (chunk) => {
      rejectedHeaders += chunk.toString();
    });
    const rejectedClosed = new Promise<void>((resolve) =>
      rejected.once("close", () => resolve())
    );
    rejected.write(
      "GET /blog/ HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n"
    );
    await Bun.sleep(20);
    ready.reject(new Error("Refresh failed"));
    await rejectedClosed;
    expect(rejectedHeaders).toBe("");
    expect(upgrades).toEqual(["after"]);

    ready = Promise.withResolvers<void>();
    const disconnected = connect(address.port, "127.0.0.1");
    const disconnectedClosed = new Promise<void>((resolve) =>
      disconnected.once("close", () => resolve())
    );
    disconnected.write(
      "GET /blog/ HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n"
    );
    await Bun.sleep(20);
    disconnected.destroy();
    await disconnectedClosed;
    await Bun.sleep(20);
    ready.resolve();
    await Bun.sleep(20);
    expect(upgrades).toEqual(["after"]);
  } finally {
    ready.resolve();
    client.destroy();
    proxy.close();
    before.close();
    after.close();
  }
}, 5000);

test("HMR routes by session, reloads stale generations and rejects unknown tokens", async () => {
  const upgrades: string[] = [];
  const servers = [createServer(), createServer()];
  const areas: DevAreaServer[] = [];
  for (const [index, server] of servers.entries()) {
    const area = index === 0 ? "blog" : "changelog";
    server.on("upgrade", (incoming, socket) => {
      upgrades.push(
        `${area}:${incoming.url}:${incoming.headers["x-notra-hmr-reload"] ?? ""}`
      );
      socket.end(
        "HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n"
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve)
    );
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("The upstream server did not allocate a TCP port");
    }
    areas.push({
      area,
      mount: `/${area}`,
      port: address.port,
      paramsPath: "unused",
      hmrToken: `${area}-session`,
      hmrGeneration: 3,
    });
  }
  const proxy = await startDevProxy(
    0,
    { blog: "/blog", changelog: "/changelog" },
    areas,
    () => Promise.resolve()
  );
  const address = proxy.address();
  if (!address || typeof address === "string") {
    throw new Error("The proxy did not allocate a TCP port");
  }
  const upgrade = (token: string) =>
    new Promise<string>((resolve, reject) => {
      const client = connect(address.port, "127.0.0.1");
      let response = "";
      client.on("data", (chunk) => {
        response += chunk.toString();
      });
      client.once("error", reject);
      client.once("close", () => resolve(response));
      client.write(
        `GET /?token=${token} HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Protocol: vite-hmr\r\nX-Notra-Hmr-Reload: 1\r\n\r\n`
      );
    });
  try {
    for (const token of [
      "",
      "unknown-session.1",
      `${encodeURIComponent("é".repeat("blog-session".length))}.1`,
      "blog-session.0",
      "blog-session.4",
      "blog-session.01",
      "blog-session.nope",
      "blog-session.1.extra",
    ]) {
      expect(await upgrade(token)).toBe("");
    }
    expect(upgrades).toEqual([]);
    expect(await upgrade("blog-session.3")).toContain(
      "101 Switching Protocols"
    );
    expect(await upgrade("blog-session.1")).toContain(
      "101 Switching Protocols"
    );
    expect(await upgrade("changelog-session.3")).toContain(
      "101 Switching Protocols"
    );
    expect(upgrades).toEqual([
      "blog:/?token=blog-session.3:",
      "blog:/?token=blog-session.3:1",
      "changelog:/?token=changelog-session.3:",
    ]);
  } finally {
    proxy.close();
    for (const server of servers) {
      server.close();
    }
  }
});
