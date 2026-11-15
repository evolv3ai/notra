import { expect, test } from "bun:test";
import { createServer, request } from "node:http";
import type { Server } from "node:http";

import { startDevProxy } from "../compiler/dev-server";

async function proxyFor(upstream: Server) {
  await new Promise<void>((resolve) =>
    upstream.listen(0, "127.0.0.1", resolve)
  );
  const upstreamAddress = upstream.address();
  if (!upstreamAddress || typeof upstreamAddress === "string") {
    throw new Error("The upstream did not allocate a TCP port");
  }
  const proxy = await startDevProxy(
    0,
    { blog: "/blog" },
    [
      {
        area: "blog",
        mount: "/blog",
        port: upstreamAddress.port,
        paramsPath: "unused",
      },
    ],
    () => Promise.resolve()
  );
  const address = proxy.address();
  if (!address || typeof address === "string") {
    throw new Error("The proxy did not allocate a TCP port");
  }
  return { proxy, url: `http://127.0.0.1:${address.port}/blog/post` };
}

test("an upstream response abort closes the downstream without appending an error body", async () => {
  const upstream = createServer((_request, response) => {
    response.writeHead(200, { "content-length": "1000" });
    response.write("partial");
    setTimeout(() => response.destroy(), 20);
  });
  const { proxy, url } = await proxyFor(upstream);
  try {
    const response = await fetch(url);
    expect(response.status).toBe(200);
    expect(
      await Promise.race([
        response.text().then(
          () => "completed",
          () => "aborted"
        ),
        Bun.sleep(1000).then(() => "unresolved"),
      ])
    ).toBe("aborted");
  } finally {
    proxy.closeAllConnections();
    proxy.close();
    upstream.closeAllConnections();
    upstream.close();
  }
});

test("a disconnected downstream closes its active upstream response", async () => {
  const closed = Promise.withResolvers<void>();
  const upstream = createServer((_request, response) => {
    response.once("close", () => closed.resolve());
    response.writeHead(200, { "content-length": "1000" });
    response.write("partial");
  });
  const { proxy, url } = await proxyFor(upstream);
  try {
    const response = await fetch(url);
    await response.body?.cancel();
    expect(
      await Promise.race([
        closed.promise.then(() => "closed"),
        Bun.sleep(1000).then(() => "unresolved"),
      ])
    ).toBe("closed");
  } finally {
    proxy.closeAllConnections();
    proxy.close();
    upstream.closeAllConnections();
    upstream.close();
  }
});

test("upstream failure before response headers still sends an actionable 502", async () => {
  const upstream = createServer((request) => request.socket.destroy());
  const { proxy, url } = await proxyFor(upstream);
  try {
    const response = await fetch(url);
    expect(response.status).toBe(502);
    expect(await response.text()).toContain("blog dev server is restarting");
  } finally {
    proxy.closeAllConnections();
    proxy.close();
    upstream.closeAllConnections();
    upstream.close();
  }
});

for (const phase of ["metadata", "html", "asset"]) {
  test(`a disconnected Markdown client aborts its upstream ${phase} response`, async () => {
    const entered = Promise.withResolvers<void>();
    const closed = Promise.withResolvers<void>();
    const upstream = createServer((incoming, response) => {
      const metadata = incoming.url === "/blog/notra-pages.json";
      if (metadata && phase !== "metadata") {
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            title: "Blog",
            indexPath: "/blog",
            entries: [{ path: "/blog/post", title: "Post", tags: [] }],
          })
        );
        return;
      }
      response.once("close", () => closed.resolve());
      const contentType = phase === "html" ? "text/html" : "text/markdown";
      response.writeHead(200, {
        "content-type": metadata ? "application/json" : contentType,
      });
      response.write(metadata ? '{"title":' : "partial");
      entered.resolve();
    });
    const { proxy, url } = await proxyFor(upstream);
    const client = request(
      phase === "asset" ? url.replace("/post", "/download.md") : `${url}.md`
    );
    client.on("error", () => undefined);
    client.end();
    try {
      expect(
        await Promise.race([
          entered.promise.then(() => "entered"),
          Bun.sleep(1000).then(() => "unresolved"),
        ])
      ).toBe("entered");
      client.destroy();
      expect(
        await Promise.race([
          closed.promise.then(() => "closed"),
          Bun.sleep(1000).then(() => "unresolved"),
        ])
      ).toBe("closed");
    } finally {
      client.destroy();
      proxy.closeAllConnections();
      proxy.close();
      upstream.closeAllConnections();
      upstream.close();
    }
  });
}

test("HEAD Markdown assets cancel the upstream body without reading it", async () => {
  const closed = Promise.withResolvers<void>();
  const upstream = createServer((incoming, response) => {
    if (incoming.url === "/blog/notra-pages.json") {
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({ title: "Blog", indexPath: "/blog", entries: [] })
      );
      return;
    }
    response.once("close", () => closed.resolve());
    response.writeHead(200, { "content-type": "text/markdown" });
    response.write("partial");
  });
  const { proxy, url } = await proxyFor(upstream);
  try {
    const result = await Promise.race([
      fetch(`${url}.md`, { method: "HEAD" }).then(async (response) => ({
        status: response.status,
        body: await response.text(),
      })),
      Bun.sleep(1000).then(() => "unresolved"),
    ]);
    expect(result).toEqual({ status: 200, body: "" });
    expect(
      await Promise.race([
        closed.promise.then(() => "closed"),
        Bun.sleep(1000).then(() => "unresolved"),
      ])
    ).toBe("closed");
  } finally {
    proxy.closeAllConnections();
    proxy.close();
    upstream.closeAllConnections();
    upstream.close();
  }
});

test("an aborted Markdown asset body returns a 502 instead of committing partial success headers", async () => {
  const upstream = createServer((incoming, response) => {
    if (incoming.url === "/blog/notra-pages.json") {
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({ title: "Blog", indexPath: "/blog", entries: [] })
      );
      return;
    }
    response.writeHead(200, {
      "content-type": "text/markdown",
      "content-length": "1000",
    });
    response.write("partial");
    setTimeout(() => response.destroy(), 20);
  });
  const { proxy, url } = await proxyFor(upstream);
  try {
    const response = await fetch(`${url}.md`);
    expect(response.status).toBe(502);
    expect(await response.text()).toBe(
      "The dev server is restarting, reload in a moment."
    );
  } finally {
    proxy.closeAllConnections();
    proxy.close();
    upstream.closeAllConnections();
    upstream.close();
  }
});
