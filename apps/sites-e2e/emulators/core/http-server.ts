import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

// A loopback HTTP server around a fetch-style handler, on Node's http module
// so lifecycle code type-checks without Bun globals.
export async function serveFetch(
  handler: (request: Request) => Promise<Response> | Response
) {
  const server = createServer(async (incoming, outgoing) => {
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) {
      chunks.push(chunk as Buffer);
    }
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (typeof value === "string") {
        headers.set(name, value);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          headers.append(name, item);
        }
      }
    }
    const method = incoming.method ?? "GET";
    let response: Response;
    try {
      response = await handler(
        new Request(`http://${incoming.headers.host}${incoming.url ?? "/"}`, {
          method,
          headers,
          body: ["GET", "HEAD"].includes(method)
            ? undefined
            : Buffer.concat(chunks),
        })
      );
    } catch (error) {
      console.error("Loopback handler failed", error);
      response = Response.json({ error: String(error) }, { status: 500 });
    }
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise<void>((resolveListen) =>
    server.listen(0, "127.0.0.1", resolveListen)
  );
  return {
    port: (server.address() as AddressInfo).port,
    stop: () =>
      new Promise<void>((resolveClose) => {
        server.closeAllConnections();
        server.close(() => resolveClose());
      }),
  };
}
