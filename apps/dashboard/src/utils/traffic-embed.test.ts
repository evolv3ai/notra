import { describe, expect, test } from "bun:test";

import { getTrafficEmbedSecurityHeaders } from "./framework-request";
import {
  normalizeTrafficEmbedOrigin,
  trafficEmbedFrameAncestors,
  trafficEmbedIdFromPath,
} from "./traffic-embed";

describe("traffic embed origins", () => {
  test("normalizes what users type into CSP host sources", () => {
    expect(normalizeTrafficEmbedOrigin(" Example.com ")).toEqual({
      ok: true,
      origin: "https://example.com",
    });
    expect(normalizeTrafficEmbedOrigin("https://blog.example.com/")).toEqual({
      ok: true,
      origin: "https://blog.example.com",
    });
    expect(normalizeTrafficEmbedOrigin("*.example.com")).toEqual({
      ok: true,
      origin: "https://*.example.com",
    });
    expect(normalizeTrafficEmbedOrigin("http://localhost:3000")).toEqual({
      ok: true,
      origin: "http://localhost:3000",
    });
  });

  test("rejects anything that would widen or break frame-ancestors", () => {
    for (const value of [
      "*",
      "",
      "http://example.com",
      "https://example.com/path",
      "https://example.com?x=1",
      "https://user:pass@example.com",
      "example.com 'self'",
      "example.com; script-src *",
      "*.com",
      "ftp://example.com",
      "https://example.com;script-src",
      "https://exa mple.com",
    ]) {
      expect(normalizeTrafficEmbedOrigin(value).ok).toBe(false);
    }
  });

  test("embed pages allow only their origins and drop X-Frame-Options", () => {
    const headers = getTrafficEmbedSecurityHeaders(
      trafficEmbedFrameAncestors(["https://example.com"])
    );
    expect(headers["Content-Security-Policy"]).toBe(
      "frame-ancestors 'self' https://example.com"
    );
    expect("X-Frame-Options" in headers).toBe(false);
  });

  test("only well-formed ids are looked up", () => {
    const id = "a".repeat(24);
    expect(trafficEmbedIdFromPath(`/embed/ai-traffic/${id}`)).toBe(id);
    expect(trafficEmbedIdFromPath("/embed/ai-traffic/short")).toBeNull();
    expect(trafficEmbedIdFromPath(`/geo/${id}`)).toBeNull();
  });
});
