import { expect, test } from "bun:test";

import {
  SITE_FAVICON_DIR,
  SITE_FAVICON_HOST,
} from "@notra/sites-core/constants/sites";
import { siteConfigSchema } from "@notra/sites-core/schemas/site-config";

import { FAVICON_DIR, FAVICON_HOST } from "../src/constants/favicons";
import { footerFaviconHost } from "../src/utils/favicons";

test("the theme links favicons where the worker serves them", () => {
  expect(FAVICON_DIR).toBe(SITE_FAVICON_DIR);
  expect(FAVICON_HOST.source).toBe(SITE_FAVICON_HOST.source);
});

test("only website socials with a usable host get a favicon", () => {
  const config = siteConfigSchema.parse({
    name: "Acme",
    footer: {
      socials: {
        github: "https://github.com/acme",
        website: "https://Podcast.Acme.com/episodes",
      },
    },
  });
  expect(footerFaviconHost(config)).toBe("podcast.acme.com");
  expect(
    footerFaviconHost(
      siteConfigSchema.parse({
        name: "Acme",
        footer: { socials: { website: "http://localhost:3000" } },
      })
    )
  ).toBeUndefined();
});

test("social links only accept http and https URLs", () => {
  for (const url of [
    ["java", "script:alert(1)"].join(""),
    "data:text/html,hi",
  ]) {
    expect(
      siteConfigSchema.safeParse({
        name: "Acme",
        footer: { socials: { website: url } },
      }).success
    ).toBe(false);
  }
});
