import { describe, expect, test } from "bun:test";
import { gunzipSync } from "node:zlib";

import { Hono } from "hono";

import { apiCompressionMiddleware } from "../src/middleware/compression";

const payload = {
  posts: Array.from({ length: 80 }, (_, id) => ({
    id,
    title: "Release notes",
    content: "A useful product update with details. ".repeat(8),
  })),
};

function createApp() {
  const app = new Hono();
  app.use(apiCompressionMiddleware);
  app.get("/json", (c) => {
    c.header("Vary", "Origin, Authorization");
    c.header("ETag", '"original"');
    c.header(
      "Content-Length",
      String(Buffer.byteLength(JSON.stringify(payload)))
    );
    return c.json(payload);
  });
  app.get("/small", (c) => c.json({ ok: true }));
  app.get("/unicode", (c) => c.json({ text: "🦄你好".repeat(250) }));
  app.get("/large", (c) => c.json({ text: "x".repeat(1024 * 1024) }));
  app.get("/headers", (c) => {
    const response = c.json(payload);
    for (const [key, value] of new URL(c.req.url).searchParams) {
      response.headers.set(key, value);
    }
    return response;
  });
  app.get("/empty", () => new Response(null, { status: 204 }));
  app.get("/not-modified", () => new Response(null, { status: 304 }));
  app.get("/partial", (c) => c.json(payload, 206));
  app.get(
    "/raw",
    () =>
      new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json" },
      })
  );
  return app;
}

describe("bounded API JSON compression", () => {
  test("roundtrips JSON, preserves status and Vary, removes length and weakens ETag", async () => {
    const response = await createApp().request("/json", {
      headers: { "Accept-Encoding": "gzip" },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Encoding")).toBe("gzip");
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("Content-Length")).toBeNull();
    expect(response.headers.get("Vary")).toBe(
      "Origin, Authorization, Accept-Encoding"
    );
    expect(response.headers.get("ETag")).toBe('W/"original"');
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(bytes.byteLength).toBeLessThan(
      Buffer.byteLength(JSON.stringify(payload)) / 4
    );
    expect(JSON.parse(gunzipSync(bytes).toString())).toEqual(payload);
  });

  for (const encoding of [
    undefined,
    "",
    "br",
    "gzip;q=0",
    "gzip;q=0, *;q=1",
    "*;q=0",
    "gzip;q=invalid",
    "gzip;q=1.1",
    "gzip;q=0.2, identity;q=0.9",
  ]) {
    test(`keeps identity for ${encoding ?? "missing header"}`, async () => {
      const response = await createApp().request("/json", {
        headers: encoding === undefined ? {} : { "Accept-Encoding": encoding },
      });
      expect(response.headers.get("Content-Encoding")).toBeNull();
      expect(response.headers.get("Vary")).toContain("Accept-Encoding");
      expect(await response.json()).toEqual(payload);
    });
  }
  for (const encoding of [
    "gzip",
    "GZip",
    "br, gzip;q=0.5",
    "*;q=0.8",
    "gzip;q=0.5, identity;q=0",
  ]) {
    test(`negotiates ${encoding}`, async () => {
      const response = await createApp().request("/json", {
        headers: { "Accept-Encoding": encoding },
      });
      expect(response.headers.get("Content-Encoding")).toBe("gzip");
      await response.arrayBuffer();
    });
  }
  for (const path of [
    "/small",
    "/large",
    "/empty",
    "/not-modified",
    "/partial",
    "/raw",
  ]) {
    test(`leaves ${path} uncompressed`, async () => {
      const response = await createApp().request(path, {
        headers: { "Accept-Encoding": "gzip" },
      });
      expect(response.headers.get("Content-Encoding")).toBeNull();
      await response.arrayBuffer();
    });
  }
  test("HEAD has no body or compression", async () => {
    const response = await createApp().request("/json", {
      method: "HEAD",
      headers: { "Accept-Encoding": "gzip" },
    });
    expect(response.headers.get("Content-Encoding")).toBeNull();
    expect(await response.text()).toBe("");
  });
  test("uses UTF-8 byte sizes and roundtrips unicode", async () => {
    const response = await createApp().request("/unicode", {
      headers: { "Accept-Encoding": "gzip" },
    });
    expect(response.headers.get("Content-Encoding")).toBe("gzip");
    expect(
      JSON.parse(gunzipSync(await response.arrayBuffer()).toString())
    ).toEqual({ text: "🦄你好".repeat(250) });
  });
  for (const headers of [
    { "Cache-Control": "private, NO-TRANSFORM" },
    { "Content-Encoding": "br" },
    { "Transfer-Encoding": "chunked" },
    { "Content-Range": "bytes 0-100/200" },
    { "Content-Type": "text/event-stream" },
    { "Content-Type": "application/x-ndjson" },
    { "Content-Type": "image/png" },
  ]) {
    test(`preserves excluded headers ${JSON.stringify(headers)}`, async () => {
      const response = await createApp().request(
        `/headers?${new URLSearchParams(headers)}`,
        { headers: { "Accept-Encoding": "gzip" } }
      );
      for (const [key, value] of Object.entries(headers)) {
        expect(response.headers.get(key)).toBe(value);
      }
      expect(response.headers.get("Content-Encoding")).toBe(
        headers["Content-Encoding"] ?? null
      );
      expect(await response.json()).toEqual(payload);
    });
  }
  test("honors request no-transform", async () => {
    const response = await createApp().request("/json", {
      headers: { "Accept-Encoding": "gzip", "Cache-Control": "no-transform" },
    });
    expect(response.headers.get("Content-Encoding")).toBeNull();
    expect(await response.json()).toEqual(payload);
  });
  for (const vary of ["*", "Origin, accept-encoding"]) {
    test(`preserves Vary ${vary}`, async () => {
      const response = await createApp().request(
        `/headers?${new URLSearchParams({ Vary: vary, ETag: 'W/"weak"' })}`,
        { headers: { "Accept-Encoding": "gzip" } }
      );
      expect(response.headers.get("Vary")).toBe(vary);
      expect(response.headers.get("ETag")).toBe('W/"weak"');
      await response.arrayBuffer();
    });
  }
  for (const contentType of [
    "application/json",
    "text/event-stream",
    "application/x-ndjson",
  ]) {
    test(`does not read or replace an open ${contentType} stream`, async () => {
      const app = new Hono();
      app.use(apiCompressionMiddleware);
      let pulls = 0;
      const stream = new ReadableStream(
        {
          pull() {
            pulls += 1;
          },
        },
        { highWaterMark: 0 }
      );
      app.get(
        "/",
        () =>
          new Response(stream, {
            headers: { "Content-Type": contentType, "Content-Length": "10000" },
          })
      );
      const response = await app.request("/", {
        headers: { "Accept-Encoding": "gzip" },
      });
      expect(response.body).toBe(stream);
      expect(response.headers.get("Content-Encoding")).toBeNull();
      expect(pulls).toBe(0);
      await response.body?.cancel();
    });
  }
});
