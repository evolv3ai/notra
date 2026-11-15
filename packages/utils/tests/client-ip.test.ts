import { afterEach, describe, expect, test } from "bun:test";

import { getClientIp, getClientNetworkKey } from "../src/client-ip";

const originalVercel = process.env.VERCEL;
const originalDeployment = process.env.UNKEY_DEPLOYMENT_ID;
const originalProxyHeader = process.env.TRUSTED_PROXY_HEADER;

function restore(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function runOn(platform: "vercel" | "unkey" | "proxy" | "direct") {
  restore("VERCEL", platform === "vercel" ? "1" : undefined);
  restore(
    "UNKEY_DEPLOYMENT_ID",
    platform === "unkey" ? "deployment_test" : undefined
  );
  restore(
    "TRUSTED_PROXY_HEADER",
    platform === "proxy" ? "x-real-ip" : undefined
  );
}

const SPOOFED = {
  "x-vercel-forwarded-for": "198.51.100.1",
  "x-forwarded-for": "198.51.100.2",
  "x-real-ip": "198.51.100.3",
  "cf-connecting-ip": "198.51.100.4",
};

afterEach(() => {
  restore("VERCEL", originalVercel);
  restore("UNKEY_DEPLOYMENT_ID", originalDeployment);
  restore("TRUSTED_PROXY_HEADER", originalProxyHeader);
});

describe("getClientIp", () => {
  test("Vercel trusts only the first x-vercel-forwarded-for entry", () => {
    runOn("vercel");
    expect(
      getClientIp(
        new Headers({
          ...SPOOFED,
          "x-vercel-forwarded-for": " 203.0.113.10 , 198.51.100.9",
        })
      )
    ).toBe("203.0.113.10");
  });

  test("Vercel does not fall back to other headers", () => {
    runOn("vercel");
    const { "x-vercel-forwarded-for": _, ...rest } = SPOOFED;
    expect(getClientIp(new Headers(rest))).toBeNull();
  });

  test("Unkey trusts x-forwarded-for over x-real-ip and Vercel's header", () => {
    runOn("unkey");
    expect(
      getClientIp(
        new Headers({ ...SPOOFED, "x-forwarded-for": "203.0.113.10" })
      )
    ).toBe("203.0.113.10");
  });

  test("Unkey rejects a multi-entry or malformed x-forwarded-for", () => {
    runOn("unkey");
    for (const forwarded of ["203.0.113.10, 198.51.100.1", "invalid", ""]) {
      expect(
        getClientIp(new Headers({ ...SPOOFED, "x-forwarded-for": forwarded }))
      ).toBeNull();
    }
  });

  test("without TRUSTED_PROXY_HEADER a spoofed x-real-ip is ignored", () => {
    runOn("direct");
    expect(getClientIp(new Headers(SPOOFED))).toBeNull();
    expect(
      getClientIp(
        new Headers({
          "x-real-ip": "173.245.48.1",
          "cf-connecting-ip": "203.0.113.10",
        })
      )
    ).toBeNull();
  });

  test("TRUSTED_PROXY_HEADER names the one header that is honoured", () => {
    runOn("direct");
    process.env.TRUSTED_PROXY_HEADER = "x-client-ip";
    expect(
      getClientIp(new Headers({ ...SPOOFED, "x-client-ip": "203.0.113.10" }))
    ).toBe("203.0.113.10");
    expect(getClientIp(new Headers(SPOOFED))).toBeNull();
  });

  test("with TRUSTED_PROXY_HEADER=x-real-ip only the proxy's x-real-ip counts", () => {
    runOn("proxy");
    expect(
      getClientIp(new Headers({ ...SPOOFED, "x-real-ip": "203.0.113.10" }))
    ).toBe("203.0.113.10");
    expect(
      getClientIp(new Headers({ "x-forwarded-for": "203.0.113.10" }))
    ).toBeNull();
  });

  test("cf-connecting-ip counts only behind a Cloudflare edge", () => {
    runOn("unkey");
    expect(
      getClientIp(
        new Headers({
          "x-forwarded-for": "173.245.48.1",
          "cf-connecting-ip": "2001:db8::1",
        })
      )
    ).toBe("2001:db8::1");
    expect(
      getClientIp(
        new Headers({
          "x-forwarded-for": "203.0.113.10",
          "cf-connecting-ip": "2001:db8::1",
        })
      )
    ).toBe("203.0.113.10");
  });

  test("a malformed cf-connecting-ip keeps the Cloudflare peer", () => {
    runOn("proxy");
    expect(
      getClientIp(
        new Headers({ "x-real-ip": "173.245.48.1", "cf-connecting-ip": "nope" })
      )
    ).toBe("173.245.48.1");
  });

  test("Vercel ignores cf-connecting-ip even behind a Cloudflare address", () => {
    runOn("vercel");
    expect(
      getClientIp(
        new Headers({
          "x-vercel-forwarded-for": "173.245.48.1",
          "cf-connecting-ip": "203.0.113.10",
        })
      )
    ).toBe("173.245.48.1");
  });
});

describe("getClientNetworkKey", () => {
  test("groups IPv6 by /64 and keeps IPv4 whole", () => {
    runOn("proxy");
    expect(
      getClientNetworkKey(
        new Headers({ "x-real-ip": "2001:db8:1234:5678:abcd::1" })
      )
    ).toBe("2001:db8:1234:5678::/64");
    expect(
      getClientNetworkKey(new Headers({ "x-real-ip": "203.0.113.10" }))
    ).toBe("203.0.113.10");
    expect(getClientNetworkKey(new Headers())).toBeNull();
  });
});
