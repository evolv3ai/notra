import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";

/** Exercise the production S3 upload client without accessing any real bucket. */
export async function createOgTestStorage() {
  const objects = new Map<string, Buffer>();
  const server = createServer(async (request, response) => {
    const path = (request.url ?? "").split("?")[0] ?? "";
    try {
      if (request.method === "PUT") {
        assert.ok(
          request.headers.authorization?.startsWith("AWS4-HMAC-SHA256 ")
        );
        assert.equal(request.headers["content-type"], "image/png");
        const chunks: Buffer[] = [];
        for await (const chunk of request) {
          chunks.push(Buffer.from(chunk));
        }
        objects.set(path, Buffer.concat(chunks));
        response.writeHead(200, { etag: '"local-og-test"' }).end();
        return;
      }
      const bytes = objects.get(path);
      response
        .writeHead(bytes ? 200 : 404, { "content-type": "image/png" })
        .end(bytes);
    } catch {
      response.writeHead(400).end();
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}`;
  process.env.CLOUDFLARE_ACCESS_KEY_ID = "local-test-access-key";
  process.env.CLOUDFLARE_SECRET_ACCESS_KEY = "local-test-secret-key";
  process.env.CLOUDFLARE_BUCKET_NAME = "og-test";
  process.env.CLOUDFLARE_S3_ENDPOINT = url;
  process.env.CLOUDFLARE_PUBLIC_URL = `${url}/og-test`;
  return server;
}
