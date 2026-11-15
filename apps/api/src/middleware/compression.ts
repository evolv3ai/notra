import { promisify } from "node:util";
import { gzip } from "node:zlib";

import type { MiddlewareHandler } from "hono";

import {
  API_COMPRESSION_LEVEL,
  API_COMPRESSION_MAX_BYTES,
  API_COMPRESSION_MIN_BYTES,
} from "../constants/compression";
import type { JsonResponseFactory } from "../types/compression";
import { acceptsGzip } from "../utils/accepts-gzip";

const gzipAsync = promisify(gzip);

export const apiCompressionMiddleware: MiddlewareHandler = async (c, next) => {
  if (c.req.method === "HEAD") {
    await next();
    return;
  }
  const json = c.json;
  let jsonResponse: Response | undefined;
  c.json = new Proxy(json, {
    apply(target, thisArg, args) {
      const response: Response = Reflect.apply(
        target as JsonResponseFactory,
        thisArg,
        args
      );
      jsonResponse = response;
      return response;
    },
  });
  try {
    await next();
  } finally {
    c.json = json;
  }
  const response = c.res;
  if (
    response !== jsonResponse ||
    !response.body ||
    response.bodyUsed ||
    response.status < 200 ||
    [204, 205, 206, 304].includes(response.status) ||
    response.headers.has("Content-Encoding") ||
    response.headers.has("Transfer-Encoding") ||
    response.headers.has("Content-Range") ||
    !/^application\/(?:[\w.-]+\+)?json(?:\s*;|$)/i.test(
      response.headers.get("Content-Type") ?? ""
    ) ||
    /(?:^|,)\s*no-transform\s*(?:,|$)/i.test(
      response.headers.get("Cache-Control") ?? ""
    ) ||
    /(?:^|,)\s*no-transform\s*(?:,|$)/i.test(
      c.req.header("Cache-Control") ?? ""
    )
  ) {
    return;
  }
  const vary = response.headers.get("Vary");
  if (
    vary !== "*" &&
    !vary
      ?.split(",")
      .some((value) => value.trim().toLowerCase() === "accept-encoding")
  ) {
    response.headers.set(
      "Vary",
      vary ? `${vary}, Accept-Encoding` : "Accept-Encoding"
    );
  }
  if (!acceptsGzip(c.req.header("Accept-Encoding"))) {
    return;
  }
  const bytes = await response.arrayBuffer();
  c.res = new Response(bytes, response);
  if (
    bytes.byteLength < API_COMPRESSION_MIN_BYTES ||
    bytes.byteLength > API_COMPRESSION_MAX_BYTES
  ) {
    return;
  }
  let compressed: Uint8Array;
  try {
    compressed = await gzipAsync(new Uint8Array(bytes), {
      level: API_COMPRESSION_LEVEL,
    });
  } catch {
    return;
  }
  if (compressed.byteLength >= bytes.byteLength) {
    return;
  }
  c.res = new Response(new Uint8Array(compressed), response);
  c.res.headers.set("Content-Encoding", "gzip");
  c.res.headers.delete("Content-Length");
  const etag = c.res.headers.get("ETag");
  if (etag && !etag.startsWith("W/")) {
    c.res.headers.set("ETag", `W/${etag}`);
  }
};
