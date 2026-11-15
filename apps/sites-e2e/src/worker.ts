import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { cpus, platform, release } from "node:os";
import { join, resolve } from "node:path";

import {
  SITE_ABUSE_EMAIL,
  SITE_ANALYTICS_EVENT_FILE,
  SITE_ANALYTICS_SCRIPT_FILE,
  SITE_PREVIEW_AUTH_PATH,
  SITE_PREVIEW_COOKIE,
  SITE_PREVIEW_SIGN_OUT_PATH,
} from "@notra/sites-core/constants/sites";
import { siteServingStateSchema } from "@notra/sites-core/schemas/deployment";
import { hashPreviewPassword } from "@notra/sites-core/utils/preview-password";
import { signSitePreviewToken } from "@notra/sites-core/utils/preview-token";
import {
  chromium,
  type Page,
  type Request as PlaywrightRequest,
} from "playwright";

import {
  ANALYTICS_PROVIDERS,
  analyticsIntegrations,
  assertProviderEvents,
  providersReported,
  routeThirdParty,
} from "../emulators/browser";
import { consentIntegrations } from "../emulators/browser/consent";
import type { VendorScripts } from "../emulators/browser/types";
import {
  ACME_TEXT,
  CONSENT_HOST,
  CONSENT_SITE_ID,
  CONSENT_TLS_HOST,
  CONSENT_TLS_SITE_ID,
  HOSTING_DOMAIN,
  LIVE_HOST,
  OTHER_CUSTOM_HOST,
  OTHER_HOST,
  PREVIEW_HOST,
  PREVIEW_PASSWORD,
  PREVIEW_SECRET,
  SITE_ID,
  STALE_ALIAS_HOST,
  SUSPENDED_HOST,
  TRAFFIC_TOKEN,
  UNKNOWN_HOST,
} from "./constants/fixtures";
import type { Measurement } from "./types/harness";
import { compileFixtures } from "./utils/compiler";
import { assertConsentVisits, assertHostOnlyConsent } from "./utils/consent";
import { assertContentFeatures } from "./utils/content";
import { cspAllowsOrigin } from "./utils/csp";
import { countByUrl, isEngagement } from "./utils/ingest";
import { createSiteResourceWaiter } from "./utils/resources";
import { freePort, startSitesWorker } from "./utils/sites-worker";
import { seedOtherTenant, seedSuspendedTenant } from "./utils/tenants";
import { startTlsProxy } from "./utils/tls-proxy";

const [temp, repetitionsText, executablePath, mode, vendorScriptsText] =
  process.argv.slice(2);
const vendorScripts: VendorScripts =
  vendorScriptsText === "live" ? "live" : "emulated";
const providerLabel = vendorScripts === "live" ? "live" : "simulated";
assert.ok(temp);
const root = resolve(import.meta.dir, "../../..");
const repetitions = Number(repetitionsText);
const measurements: Measurement[] = [];
const checks: string[] = [];
const objects = new Map<string, Uint8Array>();
const diagnostics: Record<string, unknown> = {};
// Fixed before compiling: the build bakes the public origin into its output.
const port = await freePort();
await writeFile(join(temp, "server.json"), JSON.stringify({ port }));
let sites: Awaited<ReturnType<typeof startSitesWorker>> | undefined;
const origin = `http://${LIVE_HOST}:${port}`;
const previewOrigin = `http://${PREVIEW_HOST}:${port}`;
const consentOrigin = `http://${CONSENT_HOST}:${port}`;
const tls = await startTlsProxy(temp, port);
const consentTlsOrigin = `https://${CONSENT_TLS_HOST}:${tls.port}`;
let browser:
  | Awaited<ReturnType<typeof chromium.launchPersistentContext>>
  | undefined;
// Kept outside the try block for the failure screenshot.
let activePage: Page | undefined;
let stopping = false;
const cleanup = async () => {
  if (stopping) {
    return;
  }
  stopping = true;
  const errors: string[] = [];
  for (const close of [
    () => browser?.close(),
    () => sites?.stop(),
    () => tls.stop(),
  ]) {
    try {
      await close();
    } catch (error) {
      errors.push(String(error));
    }
  }
  await writeFile(
    join(temp, "worker-cleanup.json"),
    JSON.stringify({ passed: errors.length === 0, errors })
  );
  if (errors.length) {
    throw new Error(errors.join("; "));
  }
};
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    cleanup()
      .then(() => process.exit(130))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  });
}

try {
  const compiled = await compileFixtures(
    root,
    temp,
    [
      {
        siteId: SITE_ID,
        deploymentId: "dep_live",
        publicOrigin: origin,
        preview: false,
        integrations: analyticsIntegrations(),
      },
      {
        siteId: SITE_ID,
        deploymentId: "dep_preview",
        publicOrigin: previewOrigin,
        preview: true,
        integrations: analyticsIntegrations(),
      },
      {
        siteId: CONSENT_SITE_ID,
        deploymentId: "dep_consent",
        publicOrigin: consentOrigin,
        preview: false,
        integrations: consentIntegrations(),
      },
      {
        siteId: CONSENT_TLS_SITE_ID,
        deploymentId: "dep_consent_tls",
        publicOrigin: consentTlsOrigin,
        preview: false,
        integrations: consentIntegrations(),
      },
    ],
    measurements
  );
  for (const [key, value] of compiled.objects) {
    objects.set(key, value);
  }
  objects.set(
    `hosts/${LIVE_HOST}.json`,
    new TextEncoder().encode(
      JSON.stringify({ version: 1, siteId: SITE_ID, kind: "alias" })
    )
  );
  const state = siteServingStateSchema.parse({
    version: 1,
    siteId: SITE_ID,
    slug: "acme",
    status: "active",
    production: {
      deploymentId: "dep_live",
      generation: 1,
      activatedAt: new Date().toISOString(),
    },
    previews: {
      "pr-7": {
        deploymentId: "dep_preview",
        visibility: "protected",
        sequence: 1,
        activatedAt: new Date().toISOString(),
        expiresAt: null,
      },
    },
    previewPassword: await hashPreviewPassword(PREVIEW_PASSWORD),
    trafficToken: TRAFFIC_TOKEN,
    updatedAt: new Date().toISOString(),
  });
  objects.set(
    `sites/${SITE_ID}/state.json`,
    new TextEncoder().encode(JSON.stringify(state))
  );
  objects.set(
    `hosts/${CONSENT_HOST}.json`,
    new TextEncoder().encode(
      JSON.stringify({ version: 1, siteId: CONSENT_SITE_ID, kind: "alias" })
    )
  );
  objects.set(
    `sites/${CONSENT_SITE_ID}/state.json`,
    new TextEncoder().encode(
      JSON.stringify(
        siteServingStateSchema.parse({
          version: 1,
          siteId: CONSENT_SITE_ID,
          slug: "consent",
          status: "active",
          production: {
            deploymentId: "dep_consent",
            generation: 1,
            activatedAt: new Date().toISOString(),
          },
          previews: {},
          trafficToken: TRAFFIC_TOKEN,
          updatedAt: new Date().toISOString(),
        })
      )
    )
  );
  objects.set(
    `hosts/${CONSENT_TLS_HOST}.json`,
    new TextEncoder().encode(
      JSON.stringify({ version: 1, siteId: CONSENT_TLS_SITE_ID, kind: "alias" })
    )
  );
  objects.set(
    `sites/${CONSENT_TLS_SITE_ID}/state.json`,
    new TextEncoder().encode(
      JSON.stringify(
        siteServingStateSchema.parse({
          version: 1,
          siteId: CONSENT_TLS_SITE_ID,
          slug: "consent-tls",
          status: "active",
          production: {
            deploymentId: "dep_consent_tls",
            generation: 1,
            activatedAt: new Date().toISOString(),
          },
          previews: {},
          trafficToken: TRAFFIC_TOKEN,
          updatedAt: new Date().toISOString(),
        })
      )
    )
  );
  const [liveManifest, previewManifest] = compiled.manifests;
  const previewDraft = previewManifest.files.find(
    (file) => file.path === "/blog/draft-idea/index.html"
  );
  assert.ok(previewDraft, "the preview build contains the draft page");
  const otherTenantPages = seedOtherTenant(objects, {
    port,
    acmeFiles: liveManifest.files,
    borrowed: previewDraft,
  });
  seedSuspendedTenant(objects);
  sites = await startSitesWorker({
    root,
    temp,
    port,
    objects,
    previewSecret: PREVIEW_SECRET,
  });
  const { ingest } = sites;
  // This Chromium's own user agent without the "HeadlessChrome" marker.
  const visitorUserAgent = async () => {
    const probe = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
    });
    try {
      const agent = await (
        await probe.newPage()
      ).evaluate(() => navigator.userAgent);
      return agent.replace("HeadlessChrome", "Chrome");
    } finally {
      await probe.close();
    }
  };
  browser = await chromium.launchPersistentContext(join(temp, "browser"), {
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: [
      `--host-resolver-rules=MAP *.${HOSTING_DOMAIN} 127.0.0.1`,
      // Plain HTTP on a real domain is not a secure context; localhost was.
      // Keep parity (crypto.randomUUID, cookies) for both site origins.
      `--unsafely-treat-insecure-origin-as-secure=${origin},${previewOrigin},${consentOrigin}`,
      "--disable-background-networking",
      // Real vendor scripts drop events from automated browsers
      // (navigator.webdriver, HeadlessChrome); live mode looks like a visitor.
      ...(vendorScripts === "live"
        ? ["--disable-blink-features=AutomationControlled"]
        : []),
    ],
    ...(vendorScripts === "live"
      ? { userAgent: await visitorUserAgent() }
      : {}),
    locale: "en-US",
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: "block",
    // The HTTPS consent site uses a throwaway self-signed certificate.
    ignoreHTTPSErrors: true,
    env: { PATH: process.env.PATH ?? "", HOME: temp, TMPDIR: temp },
  });
  const network = await routeThirdParty(browser, {
    root,
    vendorScripts,
    isSite: (url) =>
      ([LIVE_HOST, PREVIEW_HOST, CONSENT_HOST].includes(url.hostname) &&
        url.port === String(port)) ||
      (url.hostname === CONSENT_TLS_HOST && url.port === String(tls.port)),
  });
  // Vendors may batch; wait until every provider reported this page.
  const waitForProviders = async (from: number, pageUrl: string) => {
    const deadline =
      performance.now() + (vendorScripts === "live" ? 20_000 : 10_000);
    for (;;) {
      const missing = providersReported(
        network.events.slice(from),
        pageUrl,
        vendorScripts
      );
      if (missing.length === 0) {
        return;
      }
      assert.ok(
        performance.now() < deadline,
        `providers without a page view for ${pageUrl}: ${missing.join(", ")}`
      );
      await page.waitForTimeout(100);
    }
  };
  diagnostics.network = network;
  const page = browser.pages()[0] ?? (await browser.newPage());
  activePage = page;
  page.setDefaultTimeout(10_000);
  const pageErrors: string[] = [];
  diagnostics.pageErrors = pageErrors;
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  const requestFailures: string[] = [];
  diagnostics.requestFailures = requestFailures;
  const isSiteSubresource = (request: PlaywrightRequest) => {
    const url = new URL(request.url());
    return (
      (([LIVE_HOST, PREVIEW_HOST, CONSENT_HOST].includes(url.hostname) &&
        url.port === String(port)) ||
        (url.hostname === CONSENT_TLS_HOST && url.port === String(tls.port))) &&
      !(request.isNavigationRequest() && request.frame() === page.mainFrame())
    );
  };
  const waitForResources = createSiteResourceWaiter(page, isSiteSubresource);
  page.on("requestfailed", (request) => {
    if (!isSiteSubresource(request)) {
      console.error("Browser request failed", request.url(), request.failure());
      return;
    }
    if (
      new URL(request.url()).pathname.endsWith(
        `/${SITE_ANALYTICS_EVENT_FILE}`
      ) &&
      request.failure()?.errorText === "net::ERR_ABORTED"
    ) {
      return;
    }
    requestFailures.push(
      `${request.method()} ${request.url()}: ${request.failure()?.errorText}`
    );
  });
  page.on("response", (response) => {
    if (isSiteSubresource(response.request()) && response.status() >= 400) {
      requestFailures.push(
        `${response.request().method()} ${response.url()}: HTTP ${response.status()}`
      );
    }
  });
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message
        .text()
        .includes(
          "Failed to load resource: the server responded with a status of"
        )
    ) {
      pageErrors.push(message.text());
    }
  });
  process.stdout.write("E2E_READY\n");
  if (mode === "fail") {
    assert.fail(
      "Deliberate E2E assertion failure after browser/server startup"
    );
  }
  if (mode === "hold") {
    await new Promise(() => {});
  }
  const livePages = [
    ["/blog", "Acme Blog"],
    ["/changelog", "Changelog"],
    ["/changelog/2026-09-28-flow", "Acme Flow is live"],
    ["/blog/hello-world", "Hello world"],
    ["/blog/2026/launch", "Introducing Acme Flow"],
  ] as const;
  for (let repetition = 1; repetition <= repetitions; repetition += 1) {
    for (const [path, heading] of livePages) {
      const fromEvent = network.events.length;
      diagnostics.navigation = `${origin}${path}`;
      const fromScript = network.scripts.length;
      const started = performance.now();
      const response = await page.goto(`${origin}${path}`, {
        waitUntil: "domcontentloaded",
      });
      await waitForProviders(fromEvent, `${origin}${path}`);
      assert.equal(response?.status(), 200);
      assert.equal(
        await page.getByRole("heading", { name: heading, exact: true }).count(),
        1
      );
      const events = network.events.slice(fromEvent);
      assertProviderEvents(events, `${origin}${path}`, vendorScripts);
      assert.deepEqual(
        network.scripts
          .slice(fromScript)
          .map((script) => script.url)
          .sort(),
        ANALYTICS_PROVIDERS.map((provider) => provider.script).sort()
      );
      const policy = await response?.headerValue("content-security-policy");
      for (const provider of ANALYTICS_PROVIDERS) {
        assert.ok(
          cspAllowsOrigin(
            policy,
            "script-src",
            new URL(provider.script).origin
          ),
          `script-src allows ${provider.script}`
        );
        assert.ok(
          cspAllowsOrigin(
            policy,
            "connect-src",
            new URL(provider.endpoint).origin
          ),
          `connect-src allows ${provider.endpoint}`
        );
      }
      measurements.push({
        name: `navigation${path}`,
        repetition,
        durationMs: performance.now() - started,
      });
      for (const event of events) {
        measurements.push({
          name: `${providerLabel}.${event.provider}.navigation_to_request${path}`,
          repetition,
          durationMs: event.at - started,
        });
      }
      if (path === "/blog/2026/launch") {
        // Astro drops `ssr` once an island hydrated; a click before that is lost.
        await page.waitForFunction(() =>
          [...document.querySelectorAll("astro-island")].every(
            (island) => !island.hasAttribute("ssr")
          )
        );
        await page.getByRole("button", { name: "Clicks: 3" }).click();
        await page.getByRole("button", { name: "Clicks: 4" }).waitFor();
        await page.getByTestId("inline-toggle").click();
        assert.equal(
          await page.getByTestId("inline-toggle").textContent(),
          "Inline toggle: on"
        );
        const report = page.getByRole("link", {
          name: "Report abuse",
          exact: true,
        });
        assert.equal(await report.count(), 1, "the footer links to a report");
        const reportHref = (await report.getAttribute("href")) ?? "";
        assert.ok(
          reportHref.startsWith(`mailto:${SITE_ABUSE_EMAIL}?subject=`),
          reportHref
        );
        assert.ok(
          reportHref.includes(encodeURIComponent(`${origin}${path}`)),
          `the report names the page: ${reportHref}`
        );
        await page.screenshot({ path: join(temp, "live.png"), fullPage: true });
      }
      const beaconStarted = performance.now();
      const beacon = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/${SITE_ANALYTICS_EVENT_FILE}`) &&
          response.request().method() === "POST"
      );
      await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
      const accepted = await beacon;
      assert.equal(accepted.status(), 204);
      assert.equal(await accepted.finished(), null);
      measurements.push({
        name: `notra.synthetic_pagehide_to_beacon${path}`,
        repetition,
        durationMs: performance.now() - beaconStarted,
      });
      // Idle/visible islands and lazy images can start during the beacon wait.
      await waitForResources();
      checks.push(
        `live ${path} repetition ${repetition}: render, CSP, ${ANALYTICS_PROVIDERS.length} ${providerLabel} provider payloads, actual Notra beacon after synthetic pagehide`
      );
    }
  }
  await sites.settle();
  assert.deepEqual(
    (await browser.cookies())
      .filter((cookie) => cookie.domain === `.${HOSTING_DOMAIN}`)
      .map((cookie) => cookie.name),
    [],
    `no cookie is shared with every site on .${HOSTING_DOMAIN}`
  );
  checks.push(
    `every cookie the sites and their ${providerLabel} analytics set stays on its own host, none on .${HOSTING_DOMAIN}`
  );
  const expectedPerPage = Object.fromEntries(
    livePages
      .map(([path]) => [`${origin}${path}`, repetitions] as const)
      .sort(([a], [b]) => a.localeCompare(b))
  );
  assert.deepEqual(
    countByUrl(ingest.filter((event) => !isEngagement(event))),
    expectedPerPage,
    "one traffic event per live page view"
  );
  assert.deepEqual(
    countByUrl(ingest.filter(isEngagement)),
    expectedPerPage,
    "one engagement event per live page view, reported against that page"
  );
  for (const event of ingest) {
    if (!isEngagement(event)) {
      assert.equal(event.body.method, "GET");
      assert.equal(event.body.status, 200, String(event.body.url));
      continue;
    }
    assert.match(String(event.body.viewId), /^[a-f0-9]{24}$/);
    assert.equal(typeof event.body.visibleMs, "number");
    assert.ok(Number(event.body.visibleMs) > 0);
    assert.ok(
      Number(event.body.scrollDepth) >= 0 &&
        Number(event.body.scrollDepth) <= 100
    );
  }
  assert.equal(
    new Set(ingest.filter(isEngagement).map((event) => event.body.viewId)).size,
    livePages.length * repetitions,
    "every page view has its own view ID"
  );
  assert.ok(
    ingest.every((event) => event.authorization === `Bearer ${TRAFFIC_TOKEN}`)
  );
  checks.push(
    "actual Notra browser beacon and traffic handler → simulated ingest payloads"
  );

  const request = async (
    path: string,
    init: RequestInit = {},
    host = LIVE_HOST
  ) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      ...init,
      redirect: "manual",
      headers: {
        host: `${host}:${port}`,
        ...Object.fromEntries(new Headers(init.headers)),
      },
    });
    return response;
  };
  const ingestBeforeRequests = ingest.length;
  const rootRedirect = await request("/?source=e2e");
  const excludedDraft = await request("/blog/draft-idea");
  assert.equal(excludedDraft.status, 404);
  assert.equal(rootRedirect.status, 302);
  assert.equal(rootRedirect.headers.get("location"), "/blog?source=e2e");
  const redirect = await request("/blog/old-launch");
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get("location"), "/blog/2026/launch");
  const slash = await request("/blog/hello-world/");
  assert.equal(slash.status, 308);
  assert.equal(slash.headers.get("location"), "/blog/hello-world");
  for (const path of [
    "/blog/images/logo.svg",
    "/changelog/images/cover-flow.svg",
  ]) {
    const asset = await request(path);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get("content-type") ?? "", /image\/svg\+xml/);
    assert.match(await asset.text(), /<svg/);
  }
  const assetFile = compiled.manifests[0].files.find(
    (file) => file.path.includes("/_notra/assets/") && file.path.endsWith(".js")
  );
  assert.ok(assetFile);
  const assetResponse = await request(assetFile.path);
  assert.equal(assetResponse.status, 200);
  assert.match(assetResponse.headers.get("cache-control") ?? "", /immutable/);
  assert.equal(
    createHash("sha256")
      .update(new Uint8Array(await assetResponse.arrayBuffer()))
      .digest("hex"),
    assetFile.sha256
  );
  for (const path of ["/blog/hello-world.md", "/blog/hello-world"]) {
    const markdown = await request(path, {
      headers: { accept: "text/markdown" },
    });
    assert.equal(markdown.status, 200);
    assert.match(markdown.headers.get("content-type") ?? "", /text\/markdown/);
    assert.match(await markdown.text(), /plain \*\*Markdown\*\*/);
    assert.match(markdown.headers.get("link") ?? "", /llms\.txt/);
  }
  for (const area of ["blog", "changelog"]) {
    const missing = await request(`/${area}/missing`, {
      headers: { accept: "text/html" },
    });
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get("cache-control") ?? "", /must-revalidate/);
    const missingHtml = await missing.text();
    assert.match(missingHtml, /404/);
    assert.match(missingHtml, /name="robots"[^>]*content="noindex/);
    const missingMarkdown = await request(`/${area}/missing.md`);
    assert.equal(missingMarkdown.status, 404);
    assert.match(
      missingMarkdown.headers.get("content-type") ?? "",
      /text\/markdown/
    );
    assert.ok((await missingMarkdown.text()).length > 0);
    const head = await request(`/${area}/missing.md`, { method: "HEAD" });
    assert.equal(head.status, 404);
    assert.equal(await head.text(), "");
    for (const file of [
      "sitemap.xml",
      "feed.xml",
      "llms.txt",
      "llms-full.txt",
    ]) {
      const seo = await request(`/${area}/${file}`);
      assert.equal(seo.status, 200, `/${area}/${file}`);
      assert.ok((await seo.text()).includes(origin));
    }
  }
  const robots = await request("/robots.txt");
  assert.match(await robots.text(), /Allow: \/[\s\S]*Sitemap:/);
  const sitemap = await request("/sitemap.xml");
  assert.equal(sitemap.status, 200);
  assert.match(
    await sitemap.text(),
    /sitemapindex[\s\S]*\/blog\/sitemap.xml[\s\S]*\/changelog\/sitemap.xml/
  );
  assert.equal(
    await page.locator('link[rel="canonical"]').getAttribute("href"),
    `${origin}/blog/2026/launch`
  );
  assert.ok(
    await page.locator('meta[property="og:image"]').getAttribute("content")
  );
  assert.equal(
    await page.locator('meta[property="og:title"]').getAttribute("content"),
    "Introducing Acme Flow · Acme"
  );
  const structured = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  assert.ok(
    structured.some((text) =>
      JSON.stringify(JSON.parse(text)).includes("Introducing Acme Flow")
    )
  );
  const htmlResponse = await request("/blog/hello-world");
  const etag = htmlResponse.headers.get("etag");
  assert.ok(etag);
  const notModified = await request("/blog/hello-world", {
    headers: { "if-none-match": etag },
  });
  assert.equal(notModified.status, 304);
  assert.equal(await notModified.text(), "");
  await sites.settle();
  const requested = ingest.slice(ingestBeforeRequests);
  const reported = countByUrl(requested);
  for (const [path, count, status] of [
    ["/blog/hello-world", 3, 200],
    ["/blog/hello-world.md", 1, 200],
    ["/blog/draft-idea", 1, 404],
    ["/blog/missing", 1, 404],
    ["/blog/missing.md", 1, 404],
    ["/changelog/missing", 1, 404],
    ["/changelog/missing.md", 1, 404],
    ["/?source=e2e", 0, null],
    ["/blog/old-launch", 0, null],
    ["/blog/hello-world/", 0, null],
    ["/blog/images/logo.svg", 0, null],
    ["/changelog/images/cover-flow.svg", 0, null],
    [assetFile.path, 0, null],
    ["/sitemap.xml", 0, null],
    ["/blog/feed.xml", 0, null],
  ] as const) {
    const url = `${origin}${path}`;
    assert.equal(reported[url] ?? 0, count, `traffic events for ${path}`);
    for (const event of requested.filter((item) => item.body.url === url)) {
      assert.equal(event.body.status, status, `reported status of ${path}`);
    }
  }
  checks.push(
    "assets + integrity, root/manifest/slash redirects, HTML/Markdown/HEAD 404s and noindex meta, Markdown twins, SEO feeds/maps/canonical/OG/JSON-LD, ETag"
  );
  for (const check of await assertContentFeatures(
    page,
    origin,
    waitForResources
  )) {
    checks.push(`content: ${check}`);
  }

  await page.goto("about:blank");
  await sites.settle();
  const ingestBefore = ingest.length;
  const eventsBefore = network.events.length;
  const scriptsBefore = network.scripts.length;
  const gate = await page.goto(`${previewOrigin}/blog/hello-world`);
  assert.equal(gate?.status(), 401);
  assert.equal(
    await page
      .getByRole("heading", { name: "This preview is private" })
      .count(),
    1
  );
  const gatedPaths = new Set([
    "/blog/hello-world.md",
    "/blog/draft-idea.md",
    "/blog/llms.txt",
    "/blog/llms-full.txt",
    "/changelog/llms.txt",
    "/blog/feed.xml",
    "/changelog/feed.xml",
    "/blog/sitemap.xml",
    "/changelog/sitemap.xml",
  ]);
  for (const path of gatedPaths) {
    const filePath = path.endsWith(".md")
      ? `${path.slice(0, -".md".length)}/index.md`
      : path;
    assert.ok(
      previewManifest.files.some((file) => file.path === filePath),
      `the preview build contains ${filePath}`
    );
  }
  for (const file of previewManifest.files) {
    const extension = file.path.slice(file.path.lastIndexOf("."));
    if (
      extension !== ".html" &&
      ![...gatedPaths].some((path) => path.endsWith(extension))
    ) {
      gatedPaths.add(file.path);
    }
  }
  const previewAsset = previewManifest.files.find((file) =>
    file.path.includes("/_notra/assets/")
  );
  assert.ok(previewAsset, "the preview build has /_notra/assets/ files");
  for (const path of [
    previewAsset.path,
    "/sitemap.xml",
    "/.well-known/llms.txt",
  ]) {
    gatedPaths.add(path);
  }
  for (const path of gatedPaths) {
    for (const accept of ["*/*", "text/markdown"]) {
      const anonymous = await request(
        path,
        { headers: { accept } },
        PREVIEW_HOST
      );
      const body = await anonymous.text();
      assert.equal(
        anonymous.status,
        401,
        `anonymous ${path} (${accept}) on the protected preview must get the gate`
      );
      assert.match(anonymous.headers.get("content-type") ?? "", /text\/html/);
      assert.equal(anonymous.headers.get("cache-control"), "no-store");
      assert.equal(anonymous.headers.get("set-cookie"), null);
      assert.ok(body.includes("This preview is private"), path);
      for (const text of ACME_TEXT) {
        assert.ok(!body.includes(text), `gate for ${path} leaks "${text}"`);
      }
    }
  }
  checks.push(
    `protected preview gates ${gatedPaths.size} non-HTML files (Markdown twins, LLMS, feeds, sitemaps, assets) for anonymous requests`
  );
  await page.getByLabel("Preview password").fill("deliberately-wrong");
  const [wrongPassword] = await Promise.all([
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === SITE_PREVIEW_AUTH_PATH &&
        response.request().method() === "POST"
    ),
    page.waitForNavigation(),
    page.getByRole("button", { name: "Continue with password" }).click(),
  ]);
  assert.equal(wrongPassword.status(), 401, "a wrong password is refused");
  assert.equal(await wrongPassword.headerValue("set-cookie"), null);
  assert.deepEqual(
    (await browser.cookies()).filter((cookie) =>
      cookie.name.includes(SITE_PREVIEW_COOKIE)
    ),
    [],
    "a wrong password sets no preview cookie"
  );
  assert.match(
    await page.locator("body").innerText(),
    /wrong|incorrect|try again/i
  );
  await page.getByLabel("Preview password").fill(PREVIEW_PASSWORD);
  await Promise.all([
    page.waitForNavigation(),
    page.getByRole("button", { name: "Continue with password" }).click(),
  ]);
  assert.equal(page.url(), `${previewOrigin}/blog/hello-world`);
  assert.equal(
    await page
      .getByRole("heading", { name: "Hello world", exact: true })
      .count(),
    1
  );
  const cookie = (await browser.cookies()).find(
    (cookie) => cookie.name === SITE_PREVIEW_COOKIE
  );
  assert.ok(cookie?.httpOnly);
  assert.equal(cookie.sameSite, "Lax");
  await waitForResources();
  for (const path of [
    "/blog",
    "/changelog",
    "/changelog/2026-09-28-flow",
    "/blog/2026/launch",
    "/blog/draft-idea",
  ]) {
    const preview = await page.goto(`${previewOrigin}${path}`, {
      waitUntil: "networkidle",
    });
    assert.equal(preview?.status(), 200);
    assert.match(preview?.headers()["x-robots-tag"] ?? "", /noindex/);
    assert.match(preview?.headers()["cache-control"] ?? "", /no-store/);
    assert.equal(
      await page
        .locator(`script[src$="${SITE_ANALYTICS_SCRIPT_FILE}"]`)
        .count(),
      0
    );
    assert.equal(
      await page.locator('link[rel="canonical"]').getAttribute("href"),
      `${previewOrigin}${path}`
    );
    assert.match(
      (await page.locator('meta[name="robots"]').getAttribute("content")) ?? "",
      /noindex/
    );
    if (path === "/blog/draft-idea") {
      assert.equal(
        await page
          .getByRole("heading", { name: "A draft idea", exact: true })
          .count(),
        1
      );
    }
  }
  const previewRobots = await request("/robots.txt", {}, PREVIEW_HOST);
  assert.equal(
    (await previewRobots.text()).trim(),
    "User-agent: *\nDisallow: /"
  );
  const signedOut = await page.goto(
    `${previewOrigin}${SITE_PREVIEW_SIGN_OUT_PATH}`
  );
  assert.equal(signedOut?.status(), 401);
  assert.equal(
    (await browser.cookies()).some(
      (cookie) => cookie.name === SITE_PREVIEW_COOKIE
    ),
    false
  );
  const invalidLink = await page.goto(
    `${previewOrigin}${SITE_PREVIEW_AUTH_PATH}?token=invalid&next=/blog`
  );
  assert.equal(invalidLink?.status(), 401);
  const share = await signSitePreviewToken(
    {
      siteId: SITE_ID,
      previewKey: "pr-7",
      kind: "share",
      exp: Math.floor(Date.now() / 1000) + 60,
    },
    PREVIEW_SECRET
  );
  const sharePage = await page.goto(
    `${previewOrigin}${SITE_PREVIEW_AUTH_PATH}?token=${share}&next=/blog/hello-world`,
    { waitUntil: "networkidle" }
  );
  assert.equal(sharePage?.status(), 200);
  assert.equal(page.url(), `${previewOrigin}/blog/hello-world`);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await sites.settle();
  assert.equal(
    network.events.length,
    eventsBefore,
    "Previews must not send provider events"
  );
  assert.equal(
    network.scripts.length,
    scriptsBefore,
    "Previews must not load external analytics scripts"
  );
  assert.equal(
    ingest.length,
    ingestBefore,
    "Previews must not send internal traffic or engagement"
  );
  assert.deepEqual(network.unexpected, []);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(requestFailures, [], "same-origin subresources must load");
  // The real rate-limit binding (10 attempts a minute per site, preview and
  // client) locks out password guessing; earlier browser attempts count too.
  const attempts: number[] = [];
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await request(
      SITE_PREVIEW_AUTH_PATH,
      {
        method: "POST",
        headers: {
          origin: previewOrigin,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: "password=guess&next=%2Fblog",
      },
      PREVIEW_HOST
    );
    attempts.push(response.status);
  }
  const firstLocked = attempts.indexOf(429);
  assert.ok(firstLocked > 0, `password attempts: ${attempts.join(",")}`);
  assert.ok(attempts.slice(firstLocked).every((status) => status === 429));
  assert.deepEqual(sites.errors(), []);
  checks.push(
    "protected preview: unauthenticated/wrong-password denial, password cookie, noindex/no-store, sign-out, invalid token, signed share link, zero analytics scripts/provider events/internal ingest, real password rate limit"
  );
  for (const host of [OTHER_HOST, OTHER_CUSTOM_HOST]) {
    for (const [path, expected] of otherTenantPages) {
      const response = await request(
        path,
        { headers: { accept: path.endsWith(".md") ? "*/*" : "text/html" } },
        host
      );
      assert.equal(response.status, 200, `${host}${path}`);
      assert.equal(
        await response.text(),
        expected,
        `${host}${path} must serve Globex's own bytes, never another site's`
      );
    }
  }
  const acmePost = await request("/blog/hello-world", {
    headers: { accept: "text/html" },
  });
  const acmeHtml = await acmePost.text();
  assert.ok(acmeHtml.includes("Hello world"));
  assert.ok(!acmeHtml.includes("Globex"), "Acme serves no Globex content");
  for (const host of [STALE_ALIAS_HOST, UNKNOWN_HOST]) {
    for (const path of ["/blog", "/blog/hello-world.md"]) {
      const response = await request(path, {}, host);
      const body = await response.text();
      assert.equal(response.status, 404, `${host}${path} is not a site`);
      assert.ok(body.includes("Page not found"), `${host}${path}`);
      for (const text of [...ACME_TEXT, "Globex"]) {
        assert.ok(!body.includes(text), `${host}${path} leaks "${text}"`);
      }
    }
  }
  checks.push(
    "second tenant: alias and custom-domain hosts serve only their own files on shared paths and content hashes; stale alias and unknown host get the 404 page"
  );
  for (const path of ["/blog", "/blog/hello-world.md"]) {
    const response = await request(path, {}, SUSPENDED_HOST);
    const body = await response.text();
    assert.equal(response.status, 410, `${SUSPENDED_HOST}${path} is suspended`);
    assert.ok(body.includes("Reason: Phishing or credential harvesting"), body);
    assert.ok(
      body.includes(
        `mailto:${SITE_ABUSE_EMAIL}?subject=${encodeURIComponent(`Abuse report: ${SUSPENDED_HOST}:${port}`)}`
      ),
      "the 410 page links to a prefilled abuse report"
    );
    assert.ok(body.includes(">Report abuse<"), body);
    assert.ok(body.includes(">Request a review<"), body);
    for (const text of [...ACME_TEXT, "Globex"]) {
      assert.ok(
        !body.includes(text),
        `${SUSPENDED_HOST}${path} leaks "${text}"`
      );
    }
  }
  checks.push(
    "suspended tenant: 410 page with the neutral reason, a prefilled abuse report and an appeal link, no site content"
  );
  checks.push(
    await assertConsentVisits({
      page,
      context: browser,
      origin: consentOrigin,
      ingest,
      settle: () => sites?.settle() ?? Promise.resolve(),
    })
  );
  checks.push(
    await assertHostOnlyConsent({
      page,
      context: browser,
      origin: consentTlsOrigin,
      ingest,
      settle: () => sites?.settle() ?? Promise.resolve(),
    })
  );
  assert.ok(
    network.consent.some((event) => new URL(event.url).pathname === "/init"),
    "the banner resolved its policy from the c15t backend"
  );
  assert.deepEqual(network.unexpected, []);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(requestFailures, [], "same-origin subresources must load");
  assert.deepEqual(sites.errors(), []);
  const report = {
    schemaVersion: 1,
    status: "passed",
    metadata: {
      timestamp: new Date().toISOString(),
      commit: execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
      }).trim(),
      runtime: `bun ${Bun.version}`,
      playwright: (await import("playwright/package.json")).version,
      browser: browser.browser()?.version(),
      executablePath: executablePath || "Playwright managed Chromium",
      os: `${platform()} ${release()}`,
      cpu: cpus()[0]?.model,
      logicalCpus: cpus().length,
      repetitions,
      browserState:
        "one isolated persistent profile; warm process; HTTP cache disabled by request routing; sequential navigations",
      serving:
        "production Worker entry in workerd via wrangler dev --local; local R2 seeded with the compiler output, Cache API and rate limiter; no Cloudflare edge, DNS or TLS",
      analytics:
        vendorScripts === "live"
          ? "real vendor scripts from their CDNs; collection requests intercepted and answered locally (no vendor reception)"
          : "stand-in scripts (emulators/browser) with exact payload contracts; NOT vendor SDK execution or vendor reception",
      boundaries: [
        "R2 map populated from actual compiler artifacts",
        "Notra ingest fetch stub",
        `analytics scripts: ${vendorScripts}; collection responses answered locally`,
        "GitHub avatar image fixtures",
        "password limiter is the local workerd rate limiter (10/min)",
      ],
      deployments: compiled.manifests.map((manifest) => ({
        deploymentId: manifest.deploymentId,
        fileCount: manifest.files.length,
        totalBytes: manifest.totalBytes,
        configHash: manifest.configHash,
      })),
    },
    checks,
    vendorScripts,
    providerRequests: network.events,
    internalIngestCounts: {
      traffic: ingest.filter((event) => event.body.type !== "engagement")
        .length,
      engagement: ingest.filter((event) => event.body.type === "engagement")
        .length,
    },
    measurements,
    summary: Object.fromEntries(
      [...new Set(measurements.map((measurement) => measurement.name))].map(
        (name) => {
          const samples = measurements
            .filter((measurement) => measurement.name === name)
            .map((measurement) => measurement.durationMs)
            .sort((a, b) => a - b);
          const middle = Math.floor(samples.length / 2);
          return [
            name,
            {
              count: samples.length,
              minMs: samples[0],
              medianMs:
                samples.length % 2
                  ? samples[middle]
                  : (samples[middle - 1] + samples[middle]) / 2,
              p95Ms: samples[Math.ceil(samples.length * 0.95) - 1],
              maxMs: samples.at(-1),
            },
          ];
        }
      )
    ),
  };
  await writeFile(join(temp, "report.json"), JSON.stringify(report));
} catch (error) {
  console.error(error);
  // What the browser showed when the assertion failed; the runner keeps it.
  let failureScreenshot = false;
  try {
    await activePage?.screenshot({
      path: join(temp, "failure.png"),
      fullPage: true,
      timeout: 10_000,
    });
    failureScreenshot = activePage !== undefined;
  } catch {
    // The page or browser may be what failed.
  }
  await writeFile(
    join(temp, "report.json"),
    JSON.stringify({
      status: "failed",
      error: String(error),
      failedAfter: checks.at(-1) ?? "startup",
      failedUrl: activePage?.url(),
      failureScreenshot,
      workerErrors: sites?.errors() ?? [],
      diagnostics,
      checks,
      measurements,
    })
  );
  process.exitCode = 1;
} finally {
  try {
    await cleanup();
  } catch (error) {
    console.error("Cleanup failed", error);
    process.exitCode = 1;
  }
}
