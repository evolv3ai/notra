import { expect, test } from "bun:test";

import { cspAllowsOrigin } from "../src/utils/csp";

test("CSP checks match an exact source in the effective directive", () => {
  const source = "https://www.googletagmanager.com";
  expect(
    cspAllowsOrigin(
      `default-src 'self'; script-src 'self' ${source};`,
      "script-src",
      source
    )
  ).toBe(true);
  for (const policy of [
    null,
    "",
    `connect-src ${source}; script-src 'self'`,
    `script-src ${source}.evil.example`,
    `script-src https://evil.example/${source}`,
    `script-src https://evil.example?redirect=${source}`,
    `script-src 'none'; script-src ${source}`,
  ]) {
    expect(cspAllowsOrigin(policy, "script-src", source)).toBe(false);
  }
});

test("CSP origin checks accept a host wildcard but nothing broader", () => {
  const origin = "https://us-assets.i.posthog.com";
  for (const source of [origin, "https://*.posthog.com"]) {
    expect(cspAllowsOrigin(`script-src ${source}`, "script-src", origin)).toBe(
      true
    );
  }
  for (const source of [
    "https://*.evil.example",
    "http://*.posthog.com",
    "https://*.us-assets.i.posthog.com",
    "*",
    "https:",
  ]) {
    expect(cspAllowsOrigin(`script-src ${source}`, "script-src", origin)).toBe(
      false
    );
  }
  expect(
    cspAllowsOrigin("connect-src https://*.posthog.com", "script-src", origin)
  ).toBe(false);
});
