import assert from "node:assert/strict";

import { SITE_ANALYTICS_EVENT_FILE } from "@notra/sites-core/constants/sites";
import type { BrowserContext, Page } from "playwright";

import type { IngestRequest } from "../types/harness";
import { isEngagement } from "./ingest";

const SEARCH_REFERRER = "https://www.google.com/";
const INSIGHTS_SCRIPT = 'script[src$="/_notra/insights.js"]';

function isViewBeacon(url: string, method: string, body: string | null) {
  return (
    url.endsWith(`/${SITE_ANALYTICS_EVENT_FILE}`) &&
    method === "POST" &&
    body?.includes('"k":"view"') === true
  );
}

// A site with the c15t banner, visited by a browser that accepts and one that
// rejects. Only a stored measurement grant lets the Worker count a request;
// otherwise the page's own script reports the view once the banner grants it,
// with the referrer the landing request carried.
export async function assertConsentVisits(options: {
  page: Page;
  context: BrowserContext;
  origin: string;
  ingest: IngestRequest[];
  settle: () => Promise<void>;
}) {
  const { page, context, origin, ingest, settle } = options;
  const landing = `${origin}/blog/hello-world?utm_source=newsletter`;
  const next = `${origin}/blog`;
  const viewBeacons: string[] = [];
  page.on("request", (request) => {
    if (isViewBeacon(request.url(), request.method(), request.postData())) {
      viewBeacons.push(request.postData() ?? "");
    }
  });
  const views = (from: number) =>
    ingest
      .slice(from)
      .filter((event) => !isEngagement(event))
      .map((event) => [
        event.body.url,
        event.body.visitorConsent,
        event.body.referer,
      ]);

  let from = ingest.length;
  const accepted = page.waitForRequest((request) =>
    isViewBeacon(request.url(), request.method(), request.postData())
  );
  const first = await page.goto(landing, { referer: SEARCH_REFERRER });
  assert.equal(first?.status(), 200);
  assert.match(
    (await first?.text()) ?? "",
    /<script type="text\/plain" data-c15t-category="measurement" src="\/blog\/_notra\/insights\.js" data-endpoint="\/blog\/_notra\/e" data-view defer><\/script>/,
    "a visitor without a stored grant gets the gated view reporter"
  );
  await page
    .getByRole("button", { name: /accept/i })
    .first()
    .click();
  const beacon = await accepted;
  assert.equal((await beacon.response())?.status(), 204);
  assert.ok(
    (await context.cookies(origin)).some((cookie) => cookie.name === "c15t"),
    "c15t stores the choice in a cookie"
  );
  const second = await page.goto(next, { referer: landing });
  assert.equal(second?.status(), 200);
  assert.ok(!((await second?.text()) ?? "").includes(" data-view "));
  await page.waitForSelector(`${INSIGHTS_SCRIPT}[data-c15t-activated="true"]`, {
    state: "attached",
  });
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await settle();
  assert.deepEqual(views(from), [
    [landing, false, SEARCH_REFERRER],
    [landing, true, SEARCH_REFERRER],
    [next, true, landing],
  ]);
  assert.equal(viewBeacons.length, 1, "the granted page is not reported twice");
  assert.ok(
    ingest.slice(from).some((event) => isEngagement(event)),
    "time on page is measured after the grant"
  );

  await context.clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  from = ingest.length;
  const beaconsBefore = viewBeacons.length;
  await page.goto(landing, { referer: SEARCH_REFERRER });
  await page
    .getByRole("button", { name: /reject/i })
    .first()
    .click();
  await page.waitForFunction(() => document.cookie.includes("c15t="));
  await page.goto(next, { referer: landing });
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await settle();
  assert.deepEqual(views(from), [
    [landing, false, SEARCH_REFERRER],
    [next, false, landing],
  ]);
  assert.equal(viewBeacons.length, beaconsBefore, "a rejection sends no view");
  assert.equal(
    ingest.slice(from).filter((event) => isEngagement(event)).length,
    0,
    "a rejection measures no time on page"
  );
  assert.equal(
    await page.locator(`${INSIGHTS_SCRIPT}[data-c15t-activated]`).count(),
    0
  );
  return "consent banner: without a stored grant the page reports its own view; accept counts the landing view once with its search referrer and later pages server-side; reject sends no view or engagement and every server report carries no consent";
}

// The same banner served over HTTPS, as in production: the choice lives in a
// host-only `__Host-c15t` cookie, so a `c15t` cookie another site sets on the
// shared hosting domain neither grants consent nor counts the visit.
export async function assertHostOnlyConsent(options: {
  page: Page;
  context: BrowserContext;
  origin: string;
  ingest: IngestRequest[];
  settle: () => Promise<void>;
}) {
  const { page, context, origin, ingest, settle } = options;
  const { hostname } = new URL(origin);
  const parentDomain = hostname.slice(hostname.indexOf("."));
  const landing = `${origin}/blog/hello-world`;
  const next = `${origin}/blog`;
  const views = (from: number) =>
    ingest
      .slice(from)
      .filter((event) => !isEngagement(event))
      .map((event) => [event.body.url, event.body.visitorConsent]);

  await context.clearCookies();
  await page.goto(landing);
  await page
    .getByRole("button", { name: /accept/i })
    .first()
    .click();
  await page.waitForFunction(() => document.cookie.includes("__Host-c15t="));
  const cookies = await context.cookies(origin);
  const stored = cookies.find((cookie) => cookie.name === "__Host-c15t");
  assert.ok(stored, "c15t stores the choice in __Host-c15t over HTTPS");
  assert.equal(stored.domain, hostname, "the consent cookie is host-only");
  assert.equal(stored.secure, true);
  assert.equal(stored.path, "/");
  assert.ok(!cookies.some((cookie) => cookie.name === "c15t"));

  let from = ingest.length;
  const granted = await page.goto(next);
  assert.ok(!((await granted?.text()) ?? "").includes(" data-view "));
  await settle();
  assert.deepEqual(
    views(from).filter(([url]) => url === next),
    [[next, true]],
    "the Worker reads the grant"
  );

  await page.evaluate((domain) => {
    document.cookie = `__Host-c15t=forged; Domain=${domain}; Path=/; Secure`;
  }, parentDomain);
  assert.ok(
    !(await context.cookies(origin)).some(
      (cookie) => cookie.name === "__Host-c15t" && cookie.domain.startsWith(".")
    ),
    "the browser refuses a __Host- consent cookie for the shared domain"
  );

  await context.clearCookies();
  await page.evaluate(() => localStorage.clear());
  await context.addCookies([
    { name: "c15t", value: stored.value, domain: parentDomain, path: "/" },
  ]);
  from = ingest.length;
  const forged = await page.goto(next);
  assert.match(
    (await forged?.text()) ?? "",
    / data-view /,
    "a grant another site set on the shared domain is not the visitor's"
  );
  await page
    .getByRole("button", { name: /accept/i })
    .first()
    .waitFor({ state: "visible" });
  await settle();
  assert.deepEqual(views(from), [[next, false]]);

  // A refusal stored before the switch, under the old name, still holds.
  await context.clearCookies();
  await page.evaluate(() => localStorage.clear());
  const refusal = encodeURIComponent(
    JSON.stringify({
      consents: { necessary: true, measurement: false },
      consentInfo: { time: Date.now(), type: "necessary" },
    })
  );
  await context.addCookies([
    { name: "c15t", value: refusal, domain: parentDomain, path: "/" },
  ]);
  let beacons = 0;
  const countBeacon = (request: {
    url: () => string;
    method: () => string;
    postData: () => string | null;
  }) => {
    if (isViewBeacon(request.url(), request.method(), request.postData())) {
      beacons += 1;
    }
  };
  page.on("request", countBeacon);
  from = ingest.length;
  await page.goto(landing);
  await page.waitForLoadState("networkidle");
  const migrated = (await context.cookies(origin)).find(
    (cookie) => cookie.name === "__Host-c15t"
  );
  assert.ok(migrated, "the old refusal moves to __Host-c15t");
  assert.equal(migrated.domain, hostname);
  assert.equal(
    await page.getByRole("button", { name: /accept/i }).count(),
    0,
    "a carried-over refusal does not ask again"
  );
  await page.goto(next);
  await page.waitForLoadState("networkidle");
  page.off("request", countBeacon);
  await settle();
  assert.deepEqual(views(from), [
    [landing, false],
    [next, false],
  ]);
  assert.equal(beacons, 0, "a carried-over refusal sends no view");
  assert.equal(
    await page
      .locator(`${INSIGHTS_SCRIPT}[data-c15t-activated="true"]`)
      .count(),
    0
  );
  await context.clearCookies();
  await page.evaluate(() => localStorage.clear());
  return "consent banner over HTTPS: the choice is a host-only Secure __Host-c15t cookie the Worker reads; the browser refuses a shared-domain __Host- cookie; a c15t grant set on the shared domain neither counts the visit nor skips the banner, while a refusal under the old name is carried over and still holds";
}
