import { afterEach, expect, test } from "bun:test";

import { getDemoClientIp } from "./demo-ip-hash";

const originalDeployment = process.env.UNKEY_DEPLOYMENT_ID;
const originalVercel = process.env.VERCEL;
const originalProxyHeader = process.env.TRUSTED_PROXY_HEADER;

afterEach(() => {
  if (originalDeployment === undefined) {
    delete process.env.UNKEY_DEPLOYMENT_ID;
  } else {
    process.env.UNKEY_DEPLOYMENT_ID = originalDeployment;
  }
  if (originalVercel === undefined) {
    delete process.env.VERCEL;
  } else {
    process.env.VERCEL = originalVercel;
  }
  if (originalProxyHeader === undefined) {
    delete process.env.TRUSTED_PROXY_HEADER;
  } else {
    process.env.TRUSTED_PROXY_HEADER = originalProxyHeader;
  }
});

test("Unkey uses its overwritten forwarded IP, not a spoofed real IP", () => {
  process.env.UNKEY_DEPLOYMENT_ID = "deployment_test";
  delete process.env.VERCEL;
  expect(
    getDemoClientIp(
      new Headers({
        "x-forwarded-for": "203.0.113.10",
        "x-real-ip": "198.51.100.1",
        "x-vercel-forwarded-for": "198.51.100.2",
        "cf-connecting-ip": "198.51.100.3",
      })
    )
  ).toBe("203.0.113.10");
});

test("Unkey trusts Cloudflare's client header only behind a Cloudflare peer", () => {
  process.env.UNKEY_DEPLOYMENT_ID = "deployment_test";
  delete process.env.VERCEL;
  expect(
    getDemoClientIp(
      new Headers({
        "x-forwarded-for": "173.245.48.1",
        "cf-connecting-ip": "2001:db8:1234:5678:abcd::1",
      })
    )
  ).toBe("2001:db8:1234:5678::/64");
});

test("forwarded IP is not trusted merely because a request claims to be from Unkey", () => {
  delete process.env.UNKEY_DEPLOYMENT_ID;
  delete process.env.VERCEL;
  process.env.TRUSTED_PROXY_HEADER = "x-real-ip";
  expect(
    getDemoClientIp(
      new Headers({
        "x-unkey-request-id": "forged",
        "x-forwarded-for": "198.51.100.1",
        "x-real-ip": "203.0.113.10",
      })
    )
  ).toBe("203.0.113.10");
});

test("missing or invalid Unkey peer fails closed instead of trusting other headers", () => {
  process.env.UNKEY_DEPLOYMENT_ID = "deployment_test";
  delete process.env.VERCEL;
  for (const forwarded of ["", "198.51.100.1, 203.0.113.10", "invalid"]) {
    expect(
      getDemoClientIp(
        new Headers({
          "x-forwarded-for": forwarded,
          "x-real-ip": "198.51.100.1",
          "cf-connecting-ip": "198.51.100.2",
        })
      )
    ).toBe("unknown");
  }
});
