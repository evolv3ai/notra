import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";

import { siteIntegrationSchemas } from "@notra/sites-core/schemas/site-integrations";
import { chromium } from "playwright";

import {
  ANALYTICS_PROVIDERS,
  assertProviderEvents,
  providersReported,
  routeThirdParty,
} from "../emulators/browser";
import { ANALYTICS_PAGE, LIVE_PAGE_VIEWS } from "./constants/analytics";

test("every product analytics integration has an E2E provider", () => {
  expect(ANALYTICS_PROVIDERS.map((provider) => provider.name).sort()).toEqual(
    Object.keys(siteIntegrationSchemas).sort()
  );
});

test("live assertions accept every SDK's page view wire format", () => {
  assertProviderEvents(LIVE_PAGE_VIEWS, ANALYTICS_PAGE, "live");
  expect(providersReported(LIVE_PAGE_VIEWS, ANALYTICS_PAGE, "live")).toEqual(
    []
  );
});

test("PostHog's two remote config formats are assets, not collection", () => {
  const provider = ANALYTICS_PROVIDERS.find(
    (entry) => entry.name === "posthog"
  );
  assert.ok(provider);
  for (const suffix of ["config.js", "config"]) {
    expect(
      provider.isLiveAsset(
        new URL(
          `https://us-assets.i.posthog.com/array/${provider.identifier}/${suffix}`
        )
      )
    ).toBe(true);
  }
});

for (const provider of ANALYTICS_PROVIDERS) {
  const event = LIVE_PAGE_VIEWS.find(
    (entry) => entry.provider === provider.name
  );
  if (!event) {
    throw new Error(`Missing live page view fixture for ${provider.name}`);
  }
  test(`${provider.name}: a prefix of the wrong ID must not pass`, () => {
    const wrong = {
      ...event,
      url: event.url.replaceAll(
        provider.identifier,
        `${provider.identifier}-wrong`
      ),
      body:
        event.body?.replaceAll(
          provider.identifier,
          `${provider.identifier}-wrong`
        ) ?? null,
    };
    const events = LIVE_PAGE_VIEWS.map((entry) =>
      entry === event ? wrong : entry
    );
    expect(providersReported(events, ANALYTICS_PAGE, "live")).toEqual([
      provider.name,
    ]);
    expect(() =>
      assertProviderEvents(events, ANALYTICS_PAGE, "live")
    ).toThrow();
  });

  test(`${provider.name}: previous pages and different hosts must not pass`, () => {
    for (const page of [
      ANALYTICS_PAGE.replace("hello-world", "previous-page"),
      ANALYTICS_PAGE.replace("acme.localhost", "other.localhost"),
      `${ANALYTICS_PAGE}?different=query`,
    ]) {
      expect(providersReported([event], page, "live")).toContain(provider.name);
    }
  });

  if (provider.name === "ga4") {
    continue; // GA4's valid page view is entirely in the URL.
  }
  test(`${provider.name}: malformed and missing payloads do not count as page views`, () => {
    for (const body of [null, "{invalid", "null", "[]", "{}", "[null]"]) {
      expect(
        providersReported([{ ...event, body }], ANALYTICS_PAGE, "live")
      ).toContain(provider.name);
    }
  });
}

test("Databuddy vitals and engagement cannot substitute for a page view", () => {
  const event = LIVE_PAGE_VIEWS.find((entry) => entry.provider === "databuddy");
  assert.ok(event);
  for (const endpoint of ["vitals", "engagement"]) {
    expect(
      providersReported(
        [{ ...event, url: event.url.replace("/batch?", `/${endpoint}?`) }],
        ANALYTICS_PAGE,
        "live"
      )
    ).toContain("databuddy");
  }
});

test("PostHog must match ID and URL on the same batch item", () => {
  const event = LIVE_PAGE_VIEWS.find((entry) => entry.provider === "posthog");
  assert.ok(event?.body);
  const view = JSON.parse(event.body);
  expect(
    providersReported(
      [
        {
          ...event,
          body: JSON.stringify({
            batch: [
              { ...view, event: "$autocapture" },
              {
                ...view,
                properties: { ...view.properties, token: "wrong-key" },
              },
            ],
          }),
        },
      ],
      ANALYTICS_PAGE,
      "live"
    )
  ).toContain("posthog");
});

test("custom events cannot substitute for page views", () => {
  for (const event of LIVE_PAGE_VIEWS) {
    let body = event.body;
    let url = event.url;
    switch (event.provider) {
      case "databuddy":
        body = body?.replace("screen_view", "click") ?? null;
        break;
      case "ga4":
        url = url.replace("en=page_view", "en=click");
        break;
      case "plausible":
        body = body?.replace("pageview", "click") ?? null;
        break;
      case "posthog":
        body = body?.replace("$pageview", "$autocapture") ?? null;
        break;
      case "umami":
        body = JSON.stringify({
          ...JSON.parse(body ?? "{}"),
          payload: { ...JSON.parse(body ?? "{}").payload, name: "click" },
        });
        break;
      default:
        throw new Error(`Missing custom-event fixture for ${event.provider}`);
    }
    expect(
      providersReported([{ ...event, url, body }], ANALYTICS_PAGE, "live")
    ).toContain(event.provider);
  }
});

test("live collection stays local and undeclared vendor requests are blocked", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ serviceWorkers: "block" });
    const network = await routeThirdParty(context, {
      root: resolve(import.meta.dirname, "../../.."),
      isSite: () => false,
      vendorScripts: "live",
    });
    const page = await context.newPage();
    await page.goto(
      "data:text/html,<title>Analytics routing regression</title>"
    );
    for (const event of LIVE_PAGE_VIEWS) {
      expect(
        await page.evaluate(async ({ url, body }) => {
          const response = await fetch(url, { method: "POST", body });
          return response.status;
        }, event)
      ).toBe(200);
    }
    expect(network.events.map((event) => event.provider)).toEqual(
      LIVE_PAGE_VIEWS.map((event) => event.provider)
    );
    const unexpected = [
      "https://plausible.io/new-collection",
      "https://us.i.posthog.com/new-collection",
      "https://cdn.databuddy.cc/new-collection",
      "https://us-assets.i.posthog.com/new-collection",
    ];
    for (const url of unexpected) {
      expect(
        await page.evaluate(async (url) => {
          try {
            await fetch(url);
            return false;
          } catch {
            return true;
          }
        }, url)
      ).toBe(true);
    }
    expect(network.unexpected).toEqual(unexpected);
  } finally {
    await browser.close();
  }
}, 30_000);
