import { expect, test } from "bun:test";
import { createServer, request } from "node:http";
import type { Server } from "node:http";

import { DEV_PROXY_MAX_ATTEMPTS } from "../compiler/constants/cli";
import { startDevProxy } from "../compiler/dev-server";
import type { DevAreaServer } from "../compiler/types/dev-server";

async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("The upstream did not allocate a TCP port");
  }
  return address.port;
}

async function proxyFor(
  area: DevAreaServer,
  waitForReady: () => Promise<void>
) {
  const proxy = await startDevProxy(0, { blog: "/blog" }, [area], waitForReady);
  const address = proxy.address();
  if (!address || typeof address === "string") {
    throw new Error("The proxy did not allocate a TCP port");
  }
  return { proxy, url: `http://127.0.0.1:${address.port}/blog/post` };
}

for (const method of ["GET", "HEAD"]) {
  test(`${method} retries a connection lost after readiness using the replacement port`, async () => {
    const before = createServer();
    let replacementCalls = 0;
    const after = createServer((_incoming, response) => {
      replacementCalls += 1;
      response.setHeader("x-preview-generation", "replacement");
      response.end("<html>New snapshot</html>");
    });
    const area: DevAreaServer = {
      area: "blog",
      mount: "/blog",
      port: await listen(before),
      paramsPath: "unused",
    };
    const replacementPort = await listen(after);
    const entered = Promise.withResolvers<void>();
    const ready = Promise.withResolvers<void>();
    let readyCalls = 0;
    const { proxy, url } = await proxyFor(area, async () => {
      readyCalls += 1;
      if (readyCalls === 1) {
        await new Promise<void>((resolve) => before.close(() => resolve()));
        return;
      }
      entered.resolve();
      await ready.promise;
      area.port = replacementPort;
    });
    try {
      let completed = false;
      const pending = fetch(url, { method }).then((response) => {
        completed = true;
        return response;
      });
      expect(
        await Promise.race([
          entered.promise.then(() => "waiting"),
          Bun.sleep(1000).then(() => "unresolved"),
        ])
      ).toBe("waiting");
      expect(completed).toBe(false);
      expect(replacementCalls).toBe(0);
      ready.resolve();
      const response = await pending;
      expect(response.status).toBe(200);
      expect(response.headers.get("x-preview-generation")).toBe("replacement");
      expect(await response.text()).toBe(
        method === "HEAD" ? "" : "<html>New snapshot</html>"
      );
      expect(readyCalls).toBe(2);
      expect(replacementCalls).toBe(1);
    } finally {
      ready.resolve();
      proxy.closeAllConnections();
      proxy.close();
      before.close();
      after.closeAllConnections();
      after.close();
    }
  });
}

test("permanent connection failures exhaust exactly three attempts and return an actionable 502", async () => {
  let upstreamCalls = 0;
  const upstream = createServer((incoming) => {
    upstreamCalls += 1;
    incoming.socket.destroy();
  });
  const area: DevAreaServer = {
    area: "blog",
    mount: "/blog",
    port: await listen(upstream),
    paramsPath: "unused",
  };
  let readyCalls = 0;
  const { proxy, url } = await proxyFor(area, async () => {
    readyCalls += 1;
  });
  try {
    const response = await fetch(url);
    expect(response.status).toBe(502);
    expect(await response.text()).toContain("blog dev server is restarting");
    expect(DEV_PROXY_MAX_ATTEMPTS).toBe(3);
    expect(upstreamCalls).toBe(DEV_PROXY_MAX_ATTEMPTS);
    expect(readyCalls).toBe(DEV_PROXY_MAX_ATTEMPTS);
  } finally {
    proxy.closeAllConnections();
    proxy.close();
    upstream.closeAllConnections();
    upstream.close();
  }
});

for (const method of ["POST", "GET"]) {
  test(`${method} requests carrying bodies are forwarded once and never replayed`, async () => {
    const bodies: string[] = [];
    const upstream = createServer((incoming) => {
      let body = "";
      incoming.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      incoming.on("end", () => {
        bodies.push(body);
        incoming.socket.destroy();
      });
    });
    const area: DevAreaServer = {
      area: "blog",
      mount: "/blog",
      port: await listen(upstream),
      paramsPath: "unused",
    };
    let readyCalls = 0;
    const { proxy, url } = await proxyFor(area, async () => {
      readyCalls += 1;
    });
    try {
      let body = "";
      const status = await new Promise<number | undefined>(
        (resolve, reject) => {
          const client = request(
            url,
            { method, headers: { "content-length": "7" } },
            (response) => {
              response.on("data", (chunk: Buffer) => {
                body += chunk.toString();
              });
              response.on("end", () => resolve(response.statusCode));
              response.on("error", reject);
            }
          );
          client.on("error", reject);
          client.end("payload");
        }
      );
      expect(status).toBe(502);
      expect(body).toContain("blog dev server is restarting");
      expect(bodies).toEqual(["payload"]);
      expect(readyCalls).toBe(1);
    } finally {
      proxy.closeAllConnections();
      proxy.close();
      upstream.closeAllConnections();
      upstream.close();
    }
  });
}

test("disconnecting while retry readiness is pending prevents a replacement connection", async () => {
  let upstreamCalls = 0;
  const upstream = createServer((incoming) => {
    upstreamCalls += 1;
    incoming.socket.destroy();
  });
  const area: DevAreaServer = {
    area: "blog",
    mount: "/blog",
    port: await listen(upstream),
    paramsPath: "unused",
  };
  const entered = Promise.withResolvers<void>();
  const ready = Promise.withResolvers<void>();
  let readyCalls = 0;
  const { proxy, url } = await proxyFor(area, async () => {
    readyCalls += 1;
    if (readyCalls > 1) {
      entered.resolve();
      await ready.promise;
    }
  });
  const closed = Promise.withResolvers<void>();
  proxy.on("connection", (socket) =>
    socket.once("close", () => closed.resolve())
  );
  const client = request(url);
  client.on("error", () => undefined);
  client.end();
  try {
    expect(
      await Promise.race([
        entered.promise.then(() => "waiting"),
        Bun.sleep(1000).then(() => "unresolved"),
      ])
    ).toBe("waiting");
    client.destroy();
    await closed.promise;
    ready.resolve();
    await Bun.sleep(100);
    expect(upstreamCalls).toBe(1);
    expect(readyCalls).toBe(2);
  } finally {
    client.destroy();
    ready.resolve();
    proxy.closeAllConnections();
    proxy.close();
    upstream.closeAllConnections();
    upstream.close();
  }
});
