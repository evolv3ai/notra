import { expect, test } from "bun:test";

import { C15T_SCRIPT_CATEGORIES } from "@notra/sites-core/constants/integrations";
import { siteConfigSchema } from "@notra/sites-core/schemas/site-config";

import { consentDiagnostics, siteConsent } from "../compiler/utils/consent";
import { CONSENT_OPTIONAL_CATEGORIES } from "../src/constants/consent";

const config = (crossSubdomain?: boolean) =>
  siteConfigSchema.parse({
    name: "Acme",
    integrations: {
      c15t: { backendURL: "https://consent.acme.com", crossSubdomain },
    },
  });

const storageConfig = (
  crossSubdomain: boolean | undefined,
  origin: string,
  hostingDomain?: string
) =>
  siteConsent(config(crossSubdomain), [], true, false, origin, hostingDomain)
    ?.options.storageConfig;

const storageKey = (crossSubdomain: boolean | undefined, origin: string) =>
  storageConfig(crossSubdomain, origin)?.storageKey;

test("HTTPS sites keep the consent choice in a host-only cookie another site can't set", () => {
  expect(storageKey(undefined, "https://acme.notra.site")).toBe("__Host-c15t");
  expect(storageKey(false, "https://blog.acme.com")).toBe("__Host-c15t");
});

test("local HTTP and cross-subdomain sharing keep c15t's default cookie", () => {
  expect(storageKey(undefined, "http://localhost:4321")).toBeUndefined();
  expect(storageKey(true, "https://blog.acme.com")).toBeUndefined();
});

test("crossSubdomain is ignored on the hosting domain, where every other site could read it", () => {
  for (const origin of [
    "https://acme.notra.site",
    "https://pr-1--acme.notra.site",
  ]) {
    expect(storageConfig(true, origin, "notra.site")).toMatchObject({
      defaultDomain: undefined,
      storageKey: "__Host-c15t",
    });
    expect(
      consentDiagnostics(config(true), [], origin, "notra.site")
    ).toMatchObject([
      { severity: "warning", code: "consent_cross_subdomain_ignored" },
    ]);
  }
  expect(
    storageConfig(true, "https://blog.acme.com", "notra.site")
  ).toMatchObject({ defaultDomain: ".acme.com", storageKey: undefined });
  expect(
    consentDiagnostics(config(true), [], "https://blog.acme.com", "notra.site")
  ).toEqual([]);
  expect(
    consentDiagnostics(
      config(false),
      [],
      "https://acme.notra.site",
      "notra.site"
    )
  ).toEqual([]);
});

test("a shared choice is pinned to the site's own domain, so its notra.site address can't share it", () => {
  for (const hostingDomain of ["notra.site", undefined]) {
    expect(
      storageConfig(true, "https://blog.acme.com", hostingDomain)
    ).toMatchObject({ defaultDomain: ".acme.com", storageKey: undefined });
  }
  expect(
    storageConfig(false, "https://blog.acme.com", "notra.site")
  ).toMatchObject({
    defaultDomain: undefined,
    storageKey: "__Host-c15t",
  });
});

test("a carried-over refusal covers every category c15t can grant", () => {
  expect([...CONSENT_OPTIONAL_CATEGORIES]).toEqual([...C15T_SCRIPT_CATEGORIES]);
});
