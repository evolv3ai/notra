import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import {
  requireCloudflareTestAccountId,
  requireCloudflareTestProfile,
} from "./utils/cloudflare-account";

test("cloud tests require an explicit account instead of local R2 defaults", () => {
  for (const value of [
    undefined,
    "",
    "company",
    "a".repeat(31),
    "A".repeat(32),
  ]) {
    expect(() => requireCloudflareTestAccountId(value)).toThrow(
      "explicit SITES_E2E_CLOUDFLARE_ACCOUNT_ID"
    );
  }
  expect(
    requireCloudflareTestAccountId("42c6313caca1b1ca404152304a463d64")
  ).toBe("42c6313caca1b1ca404152304a463d64");
});

test("cloud tests require a named profile rather than directory inheritance", () => {
  for (const value of [
    undefined,
    "",
    "../default",
    "--profile",
    "two profiles",
  ]) {
    expect(() => requireCloudflareTestProfile(value)).toThrow(
      "explicit SITES_E2E_WRANGLER_PROFILE"
    );
  }
  expect(requireCloudflareTestProfile("notra-company")).toBe("notra-company");
  expect(requireCloudflareTestProfile("default")).toBe("default");
});

test("the full runner rejects inherited account defaults before provider operations", () => {
  for (const [explicitAccount, expected] of [
    ["", "explicit SITES_E2E_CLOUDFLARE_ACCOUNT_ID"],
    ["42c6313caca1b1ca404152304a463d64", "explicit SITES_E2E_WRANGLER_PROFILE"],
  ] as const) {
    const result = spawnSync(
      process.execPath,
      ["--no-env-file", join(import.meta.dirname, "run.ts")],
      {
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          SITES_R2_ACCOUNT_ID: "61b62f129c4b6ebaa1bf3a97f1c86a66",
          SITES_E2E_CLOUDFLARE_ACCOUNT_ID: explicitAccount,
        },
        encoding: "utf8",
        timeout: 30_000,
      }
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(expected);
  }
});
