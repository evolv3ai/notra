import { expect, test } from "bun:test";

import {
  isAvailableSiteSlug,
  isValidSiteSlug,
} from "@notra/sites-core/utils/hosts";

test("infrastructure and sign-in addresses are unavailable for new sites", () => {
  for (const slug of ["auth", "sso", "webmail", "postmaster", "staging"]) {
    expect(isAvailableSiteSlug(slug)).toBe(false);
  }
  expect(isAvailableSiteSlug("acme")).toBe(true);
});

test("unavailable addresses still parse as valid hosts for existing sites", () => {
  expect(isValidSiteSlug("auth")).toBe(true);
  expect(isValidSiteSlug("www")).toBe(false);
});
