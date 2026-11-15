import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import type { BrowserContext, Request } from "playwright";

import { answerConsentBackend, CONSENT_BACKEND_URL } from "./consent";
import { databuddy } from "./providers/databuddy";
import { ga4 } from "./providers/ga4";
import { plausible } from "./providers/plausible";
import { posthog } from "./providers/posthog";
import { umami } from "./providers/umami";
import type { AnalyticsProvider, CollectedEvent, VendorScripts } from "./types";

// Every analytics integration the fixture site enables. Adding a provider:
// write providers/<name>.ts (and its stand-in script in fixtures/) and list
// it here; the site build, routing, CSP and payload checks pick it up.
export const ANALYTICS_PROVIDERS: AnalyticsProvider[] = [
  databuddy,
  ga4,
  plausible,
  posthog,
  umami,
];

export function analyticsIntegrations() {
  return Object.fromEntries(
    ANALYTICS_PROVIDERS.map((provider) => [provider.name, provider.settings])
  );
}

// Third-party resources the content pages embed, answered locally.
const EMBEDS: {
  matches: (request: Request) => boolean;
  contentType: string;
  body: string;
}[] = [
  {
    matches: (request) =>
      request.url().startsWith("https://www.youtube-nocookie.com/embed/") &&
      request.resourceType() === "document",
    contentType: "text/html",
    body: "<!doctype html><title>Emulated YouTube embed</title>",
  },
  {
    matches: (request) =>
      /^https:\/\/github\.com\/[\w-]+\.png$/.test(request.url()) &&
      request.resourceType() === "image",
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#555"/></svg>',
  },
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function decodeBody(request: Request): string | null {
  const raw = request.postDataBuffer();
  if (!raw) {
    return null;
  }
  // gzip by magic bytes: PostHog compresses without saying so in the URL.
  const bytes = raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw;
  const text = bytes.toString("utf8");
  // PostHog's legacy transport: `data=<base64 JSON>`.
  if (text.startsWith("data=")) {
    return Buffer.from(decodeURIComponent(text.slice(5)), "base64").toString(
      "utf8"
    );
  }
  return text;
}

// Routes every request leaving the site. Analytics scripts get stand-ins
// (emulated) or pass through to the vendor (live); collection requests are
// recorded and answered here in both modes, so no event reaches a vendor.
// Anything else is aborted and reported as unexpected.
export async function routeThirdParty(
  context: BrowserContext,
  options: {
    root: string;
    isSite: (url: URL) => boolean;
    vendorScripts: VendorScripts;
  }
) {
  const events: CollectedEvent[] = [];
  const consent: CollectedEvent[] = [];
  const scripts: { url: string; at: number }[] = [];
  const unexpected: string[] = [];
  const live = options.vendorScripts === "live";
  await context.route(
    (url) => !options.isSite(url),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === CONSENT_BACKEND_URL) {
        await answerConsentBackend(route, options.root, consent);
        return;
      }
      const script = ANALYTICS_PROVIDERS.find(
        (provider) => provider.script === request.url()
      );
      if (script && request.method() === "GET") {
        scripts.push({ url: request.url(), at: performance.now() });
        if (live) {
          await route.continue();
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "text/javascript",
          headers: CORS,
          body: await readFile(
            join(options.root, "apps/sites-e2e/fixtures", script.standIn),
            "utf8"
          ),
        });
        return;
      }
      const collector = ANALYTICS_PROVIDERS.find((provider) =>
        live
          ? provider.isLiveCollect(url)
          : `${url.origin}${url.pathname}` === provider.endpoint
      );
      if (collector) {
        if (request.method() !== "OPTIONS") {
          events.push({
            provider: collector.name,
            url: request.url(),
            method: request.method(),
            body: decodeBody(request),
            at: performance.now(),
          });
        }
        await route.fulfill({
          status: 200,
          headers: CORS,
          contentType: "application/json",
          body: "{}",
        });
        return;
      }
      const answer = live
        ? ANALYTICS_PROVIDERS.map((provider) =>
            provider.answerLive?.(url)
          ).find((body) => body !== undefined)
        : undefined;
      if (answer !== undefined) {
        await route.fulfill({
          status: 200,
          headers: CORS,
          contentType: "application/json",
          body: JSON.stringify(answer),
        });
        return;
      }
      // Only the script and config requests a provider declares; anything
      // else on a vendor host is unexpected, so no event leaves unnoticed.
      if (
        live &&
        request.method() === "GET" &&
        ANALYTICS_PROVIDERS.some((provider) => provider.isLiveAsset(url))
      ) {
        await route.continue();
        return;
      }
      const embed = EMBEDS.find((entry) => entry.matches(request));
      if (embed) {
        await route.fulfill({
          status: 200,
          contentType: embed.contentType,
          body: embed.body,
        });
        return;
      }
      unexpected.push(request.url());
      await route.abort("blockedbyclient");
    }
  );
  return { events, consent, scripts, unexpected };
}

function isLivePageViewOf(
  provider: AnalyticsProvider,
  event: CollectedEvent,
  pageUrl: string
) {
  return provider.isLivePageView(event, new URL(pageUrl));
}

/** Whether every provider has reported `pageUrl` (as a page view when live). */
export function providersReported(
  events: CollectedEvent[],
  pageUrl: string,
  vendorScripts: VendorScripts
) {
  return ANALYTICS_PROVIDERS.filter(
    (provider) =>
      !events.some(
        (event) =>
          event.provider === provider.name &&
          (vendorScripts === "emulated" ||
            isLivePageViewOf(provider, event, pageUrl))
      )
  ).map((provider) => provider.name);
}

export function assertProviderEvents(
  events: CollectedEvent[],
  pageUrl: string,
  vendorScripts: VendorScripts
) {
  const names = ANALYTICS_PROVIDERS.map((provider) => provider.name).sort();
  assert.deepEqual(
    [...new Set(events.map((event) => event.provider))].sort(),
    names,
    `every provider reported ${pageUrl}: ${JSON.stringify(events.map((event) => event.url))}`
  );
  for (const provider of ANALYTICS_PROVIDERS) {
    const own = events.filter((event) => event.provider === provider.name);
    if (vendorScripts === "emulated") {
      assert.equal(own.length, 1, `${provider.name} sent one event`);
      assert.equal(own[0]?.method, "POST");
      provider.assertEmulated(own[0] as CollectedEvent, pageUrl);
      continue;
    }
    // The vendor's own script read the settings Notra rendered and
    // reported this page as a page view.
    assert.ok(
      own.some((event) => isLivePageViewOf(provider, event, pageUrl)),
      `${provider.name}'s real script sent no page view for ${pageUrl}: ${JSON.stringify(own.map((event) => event.url))}`
    );
  }
}
