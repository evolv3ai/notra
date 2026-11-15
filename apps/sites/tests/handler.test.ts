import { beforeEach, describe, expect, test } from "bun:test";

import type {
  SiteManifest,
  SiteServingState,
} from "@notra/sites-core/types/deployment";
import { signSitePreviewToken } from "@notra/sites-core/utils/preview-token";

import { LOOKUP_CACHE_LIMIT } from "../src/constants/cache";
import { PREVIEW_SECURE_COOKIE } from "../src/constants/preview-auth";
import { handleSiteRequest } from "../src/handler";
import {
  loadHost,
  loadManifest,
  loadState,
  resetCachesForTests,
} from "../src/loaders";
import type { SitesDeps } from "../src/types/worker";

const SECRET = "test-secret";
const DOMAIN = "notra.site";
const SITE = "site_a";

function contentTypeFor(path: string): string {
  if (path.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }
  return path.endsWith(".md") ? "text/markdown; charset=utf-8" : "text/css";
}

function manifest(
  deploymentId: string,
  publicOrigin: string,
  paths: string[]
): SiteManifest {
  return {
    version: 1,
    siteId: SITE,
    deploymentId,
    commitSha: "abc",
    toolchainVersion: "t",
    target: {
      publicOrigin,
      mounts: { blog: "/blog", changelog: "/changelog" },
      noindex: false,
      branding: true,
    },
    configHash: "h",
    createdAt: "2026-10-03T00:00:00Z",
    totalBytes: 1,
    files: paths.map((path) => ({
      path,
      size: 1,
      sha256: path
        .replace(/[^a-z0-9]/g, "")
        .padEnd(64, "0")
        .slice(0, 64),
      contentType: contentTypeFor(path),
    })),
    redirects: [
      { source: "/blog/old", destination: "/blog/new", status: 308 },
      { source: "/blog/archive/*", destination: "/blog/*", status: 301 },
    ],
  };
}

function setup(
  state: Partial<SiteServingState> = {},
  generated404 = false,
  agentFiles = false
) {
  const objects = new Map<string, string>();
  const put = (key: string, value: unknown) =>
    objects.set(key, typeof value === "string" ? value : JSON.stringify(value));
  put("hosts/acme.notra.site.json", {
    version: 1,
    siteId: SITE,
    kind: "alias",
  });
  put("hosts/blog.acme.com.json", { version: 1, siteId: SITE, kind: "custom" });
  put(`sites/${SITE}/state.json`, {
    version: 1,
    siteId: SITE,
    slug: "acme",
    status: "active",
    production: { deploymentId: "dep_live", generation: 3, activatedAt: "x" },
    previews: {
      "pr-7": {
        deploymentId: "dep_pr",
        visibility: "protected",
        sequence: 4,
        activatedAt: "x",
        expiresAt: null,
      },
    },
    updatedAt: "x",
    ...state,
  });
  const files = [
    "/blog/index.html",
    "/blog/post/index.html",
    "/blog/post/index.md",
    "/blog/404.html",
    "/changelog/index.html",
    "/blog/_notra/assets/app.css",
    ...(generated404 ? ["/blog/404.md", "/changelog/404.md"] : []),
    ...(agentFiles
      ? ["", "/blog", "/changelog"].flatMap((mount) => [
          `${mount}/llms.txt`,
          `${mount}/llms-full.txt`,
        ])
      : []),
  ];
  put(
    `deployments/${SITE}/dep_live/manifest.json`,
    manifest("dep_live", "https://acme.com", files)
  );
  put(
    `deployments/${SITE}/dep_pr/manifest.json`,
    manifest("dep_pr", "https://pr-7--acme.notra.site", files)
  );
  for (const deployment of ["dep_live", "dep_pr"]) {
    for (const file of files) {
      put(
        `deployments/${SITE}/${deployment}/files${file}`,
        `${deployment}:${file}`
      );
    }
  }
  const reports: { url: string; init: RequestInit }[] = [];
  const pending: Promise<unknown>[] = [];
  const deps: SitesDeps = {
    bucket: {
      get: async (key) => {
        const value = objects.get(key);
        if (value === undefined) {
          return null;
        }
        return { body: new Response(value).body, text: async () => value };
      },
    },
    cache: null,
    hostingDomain: DOMAIN,
    dashboardUrl: "https://app.example.com",
    previewSecret: SECRET,
    devHostOverrideToken: null,
    passwordAttemptLimiter: null,
    sitePasswordAttemptLimiter: null,
    trafficIngestUrl: "https://ingest.example.com/api/geo/ingest",
    fetch: async (url, init) => {
      reports.push({ url, init });
      return new Response(null, { status: 202 });
    },
    waitUntil: (promise) => {
      pending.push(promise);
    },
    now: () => new Date("2026-10-03T12:00:00Z"),
  };
  const request = (url: string, headers: Record<string, string> = {}) =>
    handleSiteRequest(new Request(url, { headers }), deps);
  const settle = () => Promise.all(pending);
  return { objects, put, deps, request, reports, settle };
}

function withConsentBanner(
  objects: Map<string, string>,
  put: (key: string, value: unknown) => void,
  manifest: Record<string, unknown> = {}
) {
  const key = `deployments/${SITE}/dep_live/manifest.json`;
  put(key, {
    ...JSON.parse(objects.get(key) ?? "{}"),
    analyticsConsent: true,
    ...manifest,
  });
  put(
    `deployments/${SITE}/dep_live/files/blog/post/index.html`,
    "<html><body><p>Hi</p></body></html>"
  );
}

function consentCookie(measurement: boolean, name = "c15t"): string {
  return `${name}=${encodeURIComponent(
    JSON.stringify({
      consents: { necessary: true, measurement },
      consentInfo: {
        time: Date.now(),
        type: measurement ? "all" : "necessary",
      },
    })
  )}`;
}

beforeEach(() => resetCachesForTests());

describe("AI resource discovery", () => {
  test("advertises existing resources on pages, Markdown, assets, redirects and 404s", async () => {
    for (const generated404 of [false, true]) {
      resetCachesForTests();
      const { request, deps } = setup({}, generated404, true);
      for (const path of [
        "/blog/post",
        "/blog/post.md",
        "/blog/_notra/assets/app.css",
        "/blog/old",
        "/blog/missing",
        "/blog/missing.md",
        "/changelog/missing",
        "/changelog/missing.md",
        "/outside",
        "/outside.md",
      ]) {
        const mount =
          ["/blog", "/changelog"].find((prefix) =>
            path.startsWith(`${prefix}/`)
          ) ?? "";
        for (const method of ["GET", "HEAD"]) {
          const response = await handleSiteRequest(
            new Request(`https://acme.notra.site${path}`, { method }),
            deps
          );
          expect(response.headers.get("X-Llms-Txt")).toBe(`${mount}/llms.txt`);
          const link = response.headers.get("Link");
          expect(link).toContain(`<${mount}/llms.txt>; rel="llms-txt"`);
          expect(link).toContain(
            `<${mount}/llms-full.txt>; rel="llms-full-txt"`
          );
          expect(link?.match(/rel="llms-txt"/g)).toHaveLength(1);
          if (method === "HEAD") {
            expect(await response.text()).toBe("");
          }
        }
      }
      const page = await request("https://acme.notra.site/blog/post");
      expect(page.headers.get("Link")).toContain('rel="alternate"');
      const markdown = await request("https://acme.notra.site/blog/post.md");
      expect(markdown.headers.get("Link")).toContain('rel="canonical"');
      const cached = await request("https://acme.notra.site/blog/post", {
        "If-None-Match": page.headers.get("ETag") ?? "",
      });
      expect(cached.status).toBe(304);
      expect(cached.headers.get("X-Llms-Txt")).toBe("/blog/llms.txt");
    }
  });

  test("both well-known aliases redirect at the root and section mounts", async () => {
    const { request } = setup({}, false, true);
    for (const mount of ["", "/blog", "/changelog"]) {
      for (const file of ["llms.txt", "llms-full.txt"]) {
        const alias = await request(
          `https://acme.notra.site${mount}/.well-known/${file}`
        );
        expect(alias.status).toBe(301);
        expect(alias.headers.get("Location")).toBe(`${mount}/${file}`);
        const target = await request(`https://acme.notra.site${mount}/${file}`);
        expect(target.status).toBe(200);
        expect(await target.text()).toBe(`dep_live:${mount}/${file}`);
      }
    }
  });

  test("legacy deployments do not advertise or redirect to absent resources", async () => {
    const { request } = setup();
    for (const path of ["/blog/post", "/outside", "/blog/missing.md"]) {
      const response = await request(`https://acme.notra.site${path}`);
      expect(response.headers.get("X-Llms-Txt")).toBeNull();
      expect(response.headers.get("Link") ?? "").not.toContain(
        'rel="llms-txt"'
      );
    }
    for (const file of ["llms.txt", "llms-full.txt"]) {
      const response = await request(
        `https://acme.notra.site/.well-known/${file}`
      );
      expect(response.status).toBe(404);
      expect(response.headers.get("Location")).toBeNull();
    }
  });

  test("protected previews still authorize before exposing discovery resources", async () => {
    const { request } = setup({}, false, true);
    for (const path of [
      "/blog/post",
      "/blog/missing",
      "/llms.txt",
      "/llms-full.txt",
      "/.well-known/llms-full.txt",
    ]) {
      const response = await request(`https://pr-7--acme.notra.site${path}`);
      expect(response.status).not.toBe(200);
      expect(response.headers.get("X-Llms-Txt")).toBeNull();
      expect(response.headers.get("Link")).toBeNull();
    }
  });

  test("only available resources are advertised when a deployment has a partial index", async () => {
    const { put, request } = setup();
    put(
      `deployments/${SITE}/dep_live/manifest.json`,
      manifest("dep_live", "https://acme.com", [
        "/blog/index.html",
        "/blog/llms-full.txt",
      ])
    );
    const response = await request("https://acme.notra.site/blog");
    expect(response.headers.get("Link")).toBe(
      '</blog/llms-full.txt>; rel="llms-full-txt"'
    );
    expect(response.headers.get("X-Llms-Txt")).toBeNull();
    const missing = await request(
      "https://acme.notra.site/blog/.well-known/llms.txt"
    );
    expect(missing.status).toBe(404);
    expect(missing.headers.get("Location")).toBeNull();
  });
});

describe("production serving", () => {
  test("generated Markdown 404s stay errors for negotiation, direct paths and HEAD", async () => {
    const { deps } = setup({}, true);
    for (const path of [
      "/blog/missing",
      "/blog/missing.md",
      "/blog/404.md",
      "/changelog/404.md",
    ]) {
      for (const method of ["GET", "HEAD"]) {
        const response = await handleSiteRequest(
          new Request(`https://acme.notra.site${path}`, {
            method,
            headers: {
              Accept: "text/markdown",
              "If-None-Match": `"${"blog404md".padEnd(64, "0")}"`,
            },
          }),
          deps
        );
        expect(response.status).toBe(404);
        expect(response.headers.get("Content-Type")).toBe(
          "text/markdown; charset=utf-8"
        );
        expect(response.headers.get("Cache-Control")).toBe("no-store");
        expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
        expect(response.headers.get("Vary")).toBe("Accept");
        expect(await response.text()).toBe(
          method === "HEAD"
            ? ""
            : `dep_live:/${path.startsWith("/blog/") ? "blog" : "changelog"}/404.md`
        );
      }
    }
    const direct = await handleSiteRequest(
      new Request("https://acme.notra.site/blog/404.md", {
        headers: { Accept: "text/html" },
      }),
      deps
    );
    expect(direct.status).toBe(404);
    expect(await direct.text()).toBe("dep_live:/blog/404.md");
    const browser = await handleSiteRequest(
      new Request("https://acme.notra.site/blog/missing", {
        headers: { Accept: "text/html, text/markdown;q=0.5" },
      }),
      deps
    );
    expect(await browser.text()).toBe("dep_live:/blog/404.html");
  });

  test("legacy Markdown 404s have empty HEAD bodies", async () => {
    const { deps } = setup();
    const response = await handleSiteRequest(
      new Request("https://acme.notra.site/blog/404.md", { method: "HEAD" }),
      deps
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toBe(
      "text/markdown; charset=utf-8"
    );
    expect(await response.text()).toBe("");
  });

  test("root and nested mounted Markdown 404s resolve to their own artifacts", async () => {
    const { deps, put } = setup();
    const deployed = manifest("dep_live", "https://acme.com", [
      "/404.md",
      "/product/changes/404.md",
    ]);
    deployed.target.mounts = { blog: "/", changelog: "/product/changes" };
    put(`deployments/${SITE}/dep_live/manifest.json`, deployed);
    put(`deployments/${SITE}/dep_live/files/404.md`, "root missing");
    put(
      `deployments/${SITE}/dep_live/files/product/changes/404.md`,
      "changes missing"
    );
    for (const [path, body] of [
      ["/404.md", "root missing"],
      ["/missing.md", "root missing"],
      ["/product/changes/404.md", "changes missing"],
      ["/product/changes/missing", "changes missing"],
    ] as const) {
      const response = await handleSiteRequest(
        new Request(`https://acme.notra.site${path}`, {
          headers: { Accept: "text/markdown" },
        }),
        deps
      );
      expect(response.status).toBe(404);
      expect(await response.text()).toBe(body);
    }
  });
  test("serves both mounts with directory indexes and per-area 404s", async () => {
    const { request } = setup();
    expect(await (await request("https://acme.notra.site/blog")).text()).toBe(
      "dep_live:/blog/index.html"
    );
    const slashed = await request("https://acme.notra.site/blog/post/?a=1");
    expect([slashed.status, slashed.headers.get("Location")]).toEqual([
      308,
      "/blog/post?a=1",
    ]);
    expect(
      await (await request("https://acme.notra.site/changelog")).text()
    ).toBe("dep_live:/changelog/index.html");
    const missing = await request("https://acme.notra.site/blog/nope");
    expect(missing.status).toBe(404);
    expect(await missing.text()).toBe("dep_live:/blog/404.html");
    expect((await request("https://acme.notra.site/outside")).status).toBe(404);
  });

  test("hashed assets are immutable, HTML revalidates, ETag gives 304", async () => {
    const { request } = setup();
    const asset = await request(
      "https://acme.notra.site/blog/_notra/assets/app.css"
    );
    expect(asset.headers.get("Cache-Control")).toContain("immutable");
    const page = await request("https://acme.notra.site/blog");
    expect(page.headers.get("Cache-Control")).toBe(
      "public, max-age=0, must-revalidate"
    );
    const etag = page.headers.get("ETag") ?? "";
    expect(
      (await request("https://acme.notra.site/blog", { "If-None-Match": etag }))
        .status
    ).toBe(304);
  });

  test("agents get every page as Markdown, browsers keep HTML", async () => {
    const { request } = setup();
    const page = await request("https://acme.notra.site/blog/post");
    expect(await page.text()).toBe("dep_live:/blog/post/index.html");
    expect(page.headers.get("Vary")).toBe("Accept");
    expect(page.headers.get("Link")).toContain("</blog/post.md>");

    const negotiated = await request("https://acme.notra.site/blog/post", {
      Accept: "text/markdown, text/html;q=0.9, */*;q=0.8",
    });
    expect(negotiated.headers.get("Content-Type")).toBe(
      "text/markdown; charset=utf-8"
    );
    expect(await negotiated.text()).toBe("dep_live:/blog/post/index.md");

    const browser = await request("https://acme.notra.site/blog/post", {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    });
    expect(await browser.text()).toBe("dep_live:/blog/post/index.html");

    expect(
      await (await request("https://acme.notra.site/blog/post.md")).text()
    ).toBe("dep_live:/blog/post/index.md");
    const missing = await request("https://acme.notra.site/blog/nope.md");
    expect([missing.status, missing.headers.get("Content-Type")]).toEqual([
      404,
      "text/markdown; charset=utf-8",
    ]);
  });

  test("Markdown twins name their HTML page as canonical", async () => {
    const { request } = setup();
    const direct = await request("https://acme.notra.site/blog/post.md");
    expect(direct.headers.get("Link")).toBe(
      '<https://acme.com/blog/post>; rel="canonical"'
    );
    const negotiated = await request("https://acme.notra.site/blog/post", {
      Accept: "text/markdown",
    });
    expect(negotiated.headers.get("Link")).toBe(
      '<https://acme.com/blog/post>; rel="canonical"'
    );
  });

  test("a missing page tells agents where to look, in Markdown", async () => {
    const { request } = setup();
    const missing = await request("https://acme.notra.site/blog/nope", {
      Accept: "text/markdown",
    });
    expect(missing.status).toBe(404);
    expect(missing.headers.get("X-Robots-Tag")).toBe("noindex");
    const body = await missing.text();
    expect(body).toContain("There is no page at `/blog/nope`");
    expect(body).toContain("(/blog/index.md)");
    expect(body).toContain("(/blog/llms.txt)");

    const page = await request("https://acme.notra.site/blog/nope");
    expect([page.status, page.headers.get("Vary")]).toEqual([404, "Accept"]);
    expect(await page.text()).toBe("dep_live:/blog/404.html");
  });

  test("redirects from blog.json, including wildcards", async () => {
    const { request } = setup();
    const exact = await request("https://acme.notra.site/blog/old/");
    expect([exact.status, exact.headers.get("Location")]).toEqual([
      308,
      "/blog/new",
    ]);
    const wildcard = await request(
      "https://acme.notra.site/blog/archive/2024/post"
    );
    expect([wildcard.status, wildcard.headers.get("Location")]).toEqual([
      301,
      "/blog/2024/post",
    ]);
    const encodedCases: [string, string][] = [
      ["%0d%0a", "/blog/%0D%0A"],
      ["%E2%82%AC/a%20b", "/blog/%E2%82%AC/a%20b"],
    ];
    for (const [remainder, location] of encodedCases) {
      const encoded = await request(
        `https://acme.notra.site/blog/archive/${remainder}`
      );
      expect([encoded.status, encoded.headers.get("Location")]).toEqual([
        301,
        location,
      ]);
    }
  });

  test("path traversal and unknown hosts never reach the bucket", async () => {
    const { request } = setup();
    expect(
      (
        await request(
          "https://acme.notra.site/blog/%2e%2e/%2e%2e/sites/site_a/state.json"
        )
      ).status
    ).toBe(404);
    expect(
      (
        await request(
          "https://acme.notra.site/blog/..%2f..%2fsites%2fsite_a%2fstate.json"
        )
      ).status
    ).toBe(400);
    expect((await request("https://other.notra.site/blog")).status).toBe(404);
    expect((await request("https://unknown.example.com/blog")).status).toBe(
      404
    );
  });

  test("only the canonical host is crawlable", async () => {
    const { request } = setup();
    expect(
      await (await request("https://acme.notra.site/robots.txt")).text()
    ).toContain("Disallow: /");
    resetCachesForTests();
    const { request: customRequest, put } = setup();
    put(
      `deployments/${SITE}/dep_live/manifest.json`,
      manifest("dep_live", "https://blog.acme.com", ["/blog/index.html"])
    );
    const robots = await (
      await customRequest("https://blog.acme.com/robots.txt")
    ).text();
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Sitemap: https://blog.acme.com/blog/sitemap.xml");
  });

  test("production pages are reported as traffic under the public origin", async () => {
    const { request, reports, settle } = setup({
      trafficToken: "nst.site_a.sig",
    });
    await request("https://acme.notra.site/blog/post?ref=x", {
      "user-agent": "GPTBot/1.2",
      "x-forwarded-for": "203.0.113.9, 10.0.0.1",
    });
    await request("https://acme.notra.site/blog/_notra/assets/app.css");
    await request("https://pr-7--acme.notra.site/blog/");
    await settle();

    expect(reports).toHaveLength(1);
    const [report] = reports;
    expect(report?.url).toBe("https://ingest.example.com/api/geo/ingest");
    expect(new Headers(report?.init.headers).get("authorization")).toBe(
      "Bearer nst.site_a.sig"
    );
    const payload = JSON.parse(String(report?.init.body));
    expect(payload.url).toBe("https://acme.com/blog/post?ref=x");
    expect(payload.userAgent).toBe("GPTBot/1.2");
    expect(payload.ip).toBe("203.0.113.9");
  });

  test("visitor address and country behind each kind of proxy", async () => {
    const { put, deps, reports, settle } = setup({
      trafficToken: "nst.site_a.sig",
    });
    const berlin = { country: "DE", city: "Berlin", latitude: "52.52" };
    const cases: {
      name: string;
      url: string;
      headers: Record<string, string>;
      cf: Record<string, string>;
      ip: string;
      geo: Record<string, string | undefined>;
    }[] = [
      {
        name: "nginx overwriting X-Forwarded-For, server in Germany",
        url: "https://acme.notra.site/blog/post",
        headers: {
          "x-forwarded-for": "198.51.100.7, 192.0.2.10",
          "cf-connecting-ip": "192.0.2.10",
          "cf-ipcountry": "DE",
        },
        cf: berlin,
        ip: "198.51.100.7",
        geo: { country: undefined },
      },
      {
        name: "appending proxy, visitor sent a fake address",
        url: "https://acme.notra.site/blog/post",
        headers: {
          "x-forwarded-for": "1.1.1.1, 198.51.100.7, 192.0.2.10",
          "cf-connecting-ip": "192.0.2.10",
        },
        cf: berlin,
        ip: "198.51.100.7",
        geo: { country: undefined },
      },
      {
        name: "proxy with internal hops",
        url: "https://acme.notra.site/blog/post",
        headers: {
          "x-forwarded-for": "198.51.100.7, 100.64.0.12, 192.0.2.10",
          "cf-connecting-ip": "192.0.2.10",
        },
        cf: berlin,
        ip: "198.51.100.7",
        geo: { country: undefined },
      },
      {
        name: "Vercel rewrite",
        url: "https://acme.notra.site/blog/post",
        headers: {
          "x-forwarded-for": "198.51.100.7, 192.0.2.20",
          "cf-connecting-ip": "192.0.2.20",
          "x-vercel-ip-country": "FR",
        },
        cf: { country: "US", city: "Ashburn" },
        ip: "198.51.100.7",
        geo: { country: "FR" },
      },
      {
        name: "Cloudflare Worker on the customer's zone",
        url: "https://acme.notra.site/blog/post",
        headers: {
          "x-forwarded-for": "198.51.100.7, 2a06:98c0:3600::103",
          "cf-connecting-ip": "2a06:98c0:3600::103",
        },
        cf: berlin,
        ip: "198.51.100.7",
        geo: { country: "DE" },
      },
      {
        name: "visitor opening the Notra address directly",
        url: "https://acme.notra.site/blog/post",
        headers: {
          "x-forwarded-for": "198.51.100.7",
          "cf-connecting-ip": "198.51.100.7",
          "x-vercel-ip-country": "FR",
        },
        cf: { country: "JP" },
        ip: "198.51.100.7",
        geo: { country: "JP" },
      },
      {
        name: "visitor on the public domain sending X-Forwarded-For",
        url: "https://acme.com/blog/post",
        headers: {
          "x-forwarded-for": "1.1.1.1, 198.51.100.7",
          "cf-connecting-ip": "198.51.100.7",
          "x-vercel-ip-country": "FR",
        },
        cf: { country: "JP" },
        ip: "198.51.100.7",
        geo: { country: "JP" },
      },
    ];
    put("hosts/acme.com.json", { version: 1, siteId: SITE, kind: "custom" });
    for (const { url, headers, cf } of cases) {
      const response = await handleSiteRequest(
        Object.assign(new Request(url, { headers }), { cf }),
        deps
      );
      expect(response.status).toBe(200);
    }
    await settle();
    const payloads = reports.map((report) =>
      JSON.parse(String(report.init.body))
    );
    expect(payloads).toHaveLength(cases.length);
    for (const [index, { name, ip, geo }] of cases.entries()) {
      expect({ name, ip: payloads[index].ip }).toEqual({ name, ip });
      expect({ name, ...payloads[index].geo }).toEqual({ name, ...geo });
    }
  });

  test("the dashboard's own preview frame is not a visit", async () => {
    const { request, reports, settle } = setup({
      trafficToken: "nst.site_a.sig",
    });
    await request("https://acme.notra.site/blog/", {
      referer: "https://app.example.com/acme/sites/site_a",
    });
    await request("https://acme.notra.site/blog/post", {
      referer: "https://acme.notra.site/blog/",
      "sec-fetch-dest": "iframe",
    });
    await settle();
    expect(reports).toHaveLength(0);
  });

  test("a click on the alias host stays internal under the public origin", async () => {
    const { request, reports, settle } = setup({
      trafficToken: "nst.site_a.sig",
    });
    await request("https://acme.notra.site/blog/post", {
      referer: "https://acme.notra.site/blog/?page=2",
    });
    await request("https://acme.notra.site/blog", {
      referer: "https://news.ycombinator.com/",
    });
    await settle();
    const referers = reports.map(
      (report) => JSON.parse(String(report.init.body)).referer
    );
    expect(referers).toEqual([
      "https://acme.com/blog/?page=2",
      "https://news.ycombinator.com/",
    ]);
  });

  test("no traffic token, no report", async () => {
    const { request, reports, settle } = setup();
    await request("https://blog.acme.com/blog/");
    await settle();
    expect(reports).toHaveLength(0);
  });

  test("analytics on: pages carry the script, its beacon reaches ingest", async () => {
    const { deps, put, request, reports, settle } = setup({
      trafficToken: "nst.site_a.sig",
    });
    put(
      `deployments/${SITE}/dep_live/files/blog/post/index.html`,
      "<html><body><p>Hi</p></body></html>"
    );
    const page = await request("https://blog.acme.com/blog/post");
    const html = await page.text();
    expect(html).toContain(
      '<script src="/blog/_notra/insights.js" data-endpoint="/blog/_notra/e" defer></script>'
    );
    expect(page.headers.get("etag")).toEndWith('-a"');
    const script = await request(
      "https://blog.acme.com/blog/_notra/insights.js"
    );
    expect(script.headers.get("content-type")).toStartWith("text/javascript");
    expect(await script.text()).toContain("sendBeacon");

    const beacon = await handleSiteRequest(
      new Request("https://blog.acme.com/blog/_notra/e", {
        method: "POST",
        body: JSON.stringify({
          v: "a1b2c3d4e5f6a7b8c9d0e1f2",
          p: "/blog/post",
          ms: 12_345.6,
          sd: 140,
        }),
      }),
      deps
    );
    expect(beacon.status).toBe(204);
    await settle();
    const engagement = reports
      .map((report) => JSON.parse(String(report.init.body)))
      .find((body) => body.type === "engagement");
    expect(engagement).toMatchObject({
      url: "https://acme.com/blog/post",
      viewId: "a1b2c3d4e5f6a7b8c9d0e1f2",
      visibleMs: 12_346,
      scrollDepth: 100,
    });
  });

  test("analytics off: no script, beacons are swallowed", async () => {
    const { deps, request, reports, settle } = setup();
    const page = await request("https://blog.acme.com/blog/post");
    expect(await page.text()).not.toContain("insights.js");
    const script = await request(
      "https://blog.acme.com/blog/_notra/insights.js"
    );
    expect(script.status).toBe(404);
    const beacon = await handleSiteRequest(
      new Request("https://blog.acme.com/blog/_notra/e", {
        method: "POST",
        body: JSON.stringify({
          v: "a1b2c3d4e5f6a7b8",
          p: "/blog/",
          ms: 5,
          sd: 0,
        }),
      }),
      deps
    );
    expect(beacon.status).toBe(204);
    await settle();
    expect(reports).toHaveLength(0);
  });

  test("malformed beacons and previews never reach ingest", async () => {
    const { deps, reports, settle } = setup({
      trafficToken: "nst.site_a.sig",
    });
    const post = (url: string, body: string) =>
      handleSiteRequest(new Request(url, { method: "POST", body }), deps);
    expect(
      (await post("https://blog.acme.com/blog/_notra/e", "{")).status
    ).toBe(204);
    expect(
      (
        await post(
          "https://blog.acme.com/blog/_notra/e",
          JSON.stringify({ v: "short", p: "/blog/", ms: 5, sd: 0 })
        )
      ).status
    ).toBe(204);
    expect((await post("https://blog.acme.com/blog/post", "{}")).status).toBe(
      405
    );
    await settle();
    expect(reports).toHaveLength(0);
  });

  test("beacons from other sites are rejected, proxied origins are not", async () => {
    const { deps, reports, settle } = setup({
      trafficToken: "nst.site_a.sig",
    });
    const beacon = (headers: Record<string, string>) =>
      handleSiteRequest(
        new Request("https://blog.acme.com/blog/_notra/e", {
          method: "POST",
          headers,
          body: JSON.stringify({
            v: "a1b2c3d4e5f6a7b8c9d0e1f2",
            p: "/blog/post",
            ms: 5,
            sd: 0,
          }),
        }),
        deps
      );
    const forged: Record<string, string>[] = [
      { "Sec-Fetch-Site": "cross-site" },
      { "Sec-Fetch-Site": "same-site" },
      { Origin: "https://evil.notra.site" },
    ];
    for (const headers of forged) {
      expect((await beacon(headers)).status).toBe(403);
    }
    await settle();
    expect(reports).toHaveLength(0);
    for (const origin of ["https://blog.acme.com", "https://acme.com"]) {
      expect(
        (await beacon({ Origin: origin, "Sec-Fetch-Site": "same-origin" }))
          .status
      ).toBe(204);
    }
    await settle();
    expect(reports).toHaveLength(2);
  });

  test("consent banner: the server counts only a stored grant, other visits are left to the page", async () => {
    const { objects, put, request, reports, settle } = setup({
      trafficToken: "nst.site_a.sig",
    });
    withConsentBanner(objects, put);
    const views = [
      [consentCookie(true), false, '-a"'],
      [consentCookie(false), true, '-av"'],
      [null, true, '-av"'],
    ] as const;
    for (const [cookie, reportsView, etag] of views) {
      const page = await request(
        "https://blog.acme.com/blog/post",
        cookie ? { cookie } : {}
      );
      expect(page.headers.get("etag")).toEndWith(etag);
      expect((await page.text()).includes(" data-view ")).toBe(reportsView);
    }
    await settle();
    expect(
      reports.map(
        (report) => JSON.parse(String(report.init.body)).visitorConsent
      )
    ).toEqual([true, false, false]);
  });

  test("consent banner: a host-only consent cookie ignores one another site set on the shared domain", async () => {
    const { objects, put, request, reports, settle } = setup({
      trafficToken: "nst.site_a.sig",
    });
    withConsentBanner(objects, put, { consentStorageKey: "__Host-c15t" });
    for (const cookie of [
      consentCookie(true),
      `${consentCookie(true)}; ${consentCookie(false, "__Host-c15t")}`,
      consentCookie(true, "__Host-c15t"),
    ]) {
      await request("https://acme.notra.site/blog/post", { cookie });
    }
    await settle();
    expect(
      reports.map(
        (report) => JSON.parse(String(report.init.body)).visitorConsent
      )
    ).toEqual([false, false, true]);
  });

  test("consent banner: a shared consent cookie doesn't count on the site's notra.site address", async () => {
    const { objects, put, request, reports, settle } = setup({
      trafficToken: "nst.site_a.sig",
    });
    withConsentBanner(objects, put);
    await request("https://blog.acme.com/blog/post", {
      cookie: consentCookie(true),
    });
    await request("https://acme.notra.site/blog/post", {
      cookie: consentCookie(true),
    });
    await settle();
    expect(
      reports.map(
        (report) => JSON.parse(String(report.init.body)).visitorConsent
      )
    ).toEqual([true, false]);
  });

  test("consent banner: the page's view beacon counts with its landing referrer", async () => {
    const { objects, put, deps, reports, settle } = setup({
      trafficToken: "nst.site_a.sig",
    });
    withConsentBanner(objects, put);
    const view = (referrer: string) =>
      handleSiteRequest(
        new Request("https://blog.acme.com/blog/_notra/e", {
          method: "POST",
          headers: {
            "sec-fetch-site": "same-origin",
            "user-agent": "Mozilla/5.0 Chrome/141.0",
            "x-forwarded-for": "203.0.113.9",
            referer: "https://blog.acme.com/blog/post?utm_source=news",
          },
          body: JSON.stringify({
            k: "view",
            p: "/blog/post?utm_source=news",
            r: referrer,
          }),
        }),
        deps
      );
    for (const referrer of [
      "https://www.google.com/",
      "https://blog.acme.com/blog/",
      "",
      "https://app.example.com/acme/sites/site_a",
    ]) {
      expect((await view(referrer)).status).toBe(204);
    }
    await settle();
    const payloads = reports.map((report) =>
      JSON.parse(String(report.init.body))
    );
    expect(payloads.map((payload) => payload.referer)).toEqual([
      "https://www.google.com/",
      "https://acme.com/blog/",
      undefined,
    ]);
    for (const payload of payloads) {
      expect(payload).toMatchObject({
        method: "GET",
        url: "https://acme.com/blog/post?utm_source=news",
        status: 200,
        ip: "203.0.113.9",
        visitorConsent: true,
      });
    }
  });

  test("view beacons are ignored without a consent banner", async () => {
    const { deps, request, reports, settle } = setup({
      trafficToken: "nst.site_a.sig",
    });
    const page = await request("https://blog.acme.com/blog/post");
    expect(await page.text()).not.toContain("data-view");
    const post = (body: unknown) =>
      handleSiteRequest(
        new Request("https://blog.acme.com/blog/_notra/e", {
          method: "POST",
          body: JSON.stringify(body),
        }),
        deps
      );
    expect((await post({ k: "view", p: "/blog/", r: "" })).status).toBe(204);
    await settle();
    expect(reports).toHaveLength(1);
    expect(JSON.parse(String(reports[0]?.init.body)).visitorConsent).toBe(
      undefined
    );
  });

  test("a page revalidated from the browser cache still counts as a view", async () => {
    const { request, reports, settle } = setup({
      trafficToken: "nst.site_a.sig",
    });
    const page = await request("https://acme.notra.site/blog");
    const revalidated = await request("https://acme.notra.site/blog", {
      "If-None-Match": page.headers.get("ETag") ?? "",
    });
    expect(revalidated.status).toBe(304);
    await settle();
    expect(
      reports.map((report) => JSON.parse(String(report.init.body)).status)
    ).toEqual([200, 200]);
  });

  test("the bare hosting domain names an abuse contact", async () => {
    const { request } = setup();
    const home = await request("https://notra.site/");
    expect(home.status).toBe(200);
    expect(await home.text()).toContain("mailto:abuse@usenotra.com");
    const security = await request(
      "https://notra.site/.well-known/security.txt"
    );
    expect(await security.text()).toContain(
      "Contact: mailto:security@usenotra.com"
    );
  });

  test("takedown wins over everything and the state is re-read", async () => {
    const { request, put, deps } = setup();
    expect((await request("https://acme.notra.site/blog")).status).toBe(200);
    put(`sites/${SITE}/state.json`, {
      ...JSON.parse('{"version":1}'),
      siteId: SITE,
      slug: "acme",
      status: "suspended",
      production: { deploymentId: "dep_live", generation: 3, activatedAt: "x" },
      previews: {},
      updatedAt: "x",
    });
    deps.now = () => new Date("2026-10-03T12:00:06Z");
    expect((await request("https://acme.notra.site/blog")).status).toBe(410);
    expect(
      (await request("https://acme.notra.site/blog/_notra/assets/app.css"))
        .status
    ).toBe(410);
  });

  test("a broken or unreadable state fails closed", async () => {
    const { request, put } = setup();
    put(`sites/${SITE}/state.json`, "{not json");
    expect((await request("https://acme.notra.site/blog")).status).toBe(503);
  });

  test("an invalid manifest schema fails closed and is retried after repair", async () => {
    const { request, put, objects } = setup();
    const key = `deployments/${SITE}/dep_live/manifest.json`;
    const valid = objects.get(key);
    put(key, { version: 1 });
    const response = await request("https://acme.notra.site/blog");
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("5");
    put(key, valid);
    expect((await request("https://acme.notra.site/blog")).status).toBe(200);
  });
});

describe("loader coalescing", () => {
  test("lookup caches retain only the bounded newest positive and negative entries", async () => {
    for (const kind of ["host", "state"]) {
      resetCachesForTests();
      const { deps } = setup();
      const get = deps.bucket.get;
      let reads = 0;
      deps.bucket.get = (key) => {
        reads += 1;
        return get(key);
      };
      const load = (key: string) =>
        kind === "host" ? loadHost(deps, key) : loadState(deps, key);
      const positive = kind === "host" ? "acme.notra.site" : SITE;
      expect(await load(positive)).not.toBeNull();
      expect(await load("first-missing.notra.site")).toBeNull();
      const keys = Array.from(
        { length: LOOKUP_CACHE_LIMIT },
        (_, index) => `missing-${index}.notra.site`
      );
      for (const key of keys) {
        expect(await load(key)).toBeNull();
      }
      expect(reads).toBe(LOOKUP_CACHE_LIMIT + 2);
      for (const key of keys) {
        expect(await load(key)).toBeNull();
      }
      expect(reads).toBe(LOOKUP_CACHE_LIMIT + 2);
      expect(await load(positive)).not.toBeNull();
      expect(reads).toBe(LOOKUP_CACHE_LIMIT + 3);
      expect(await load("first-missing.notra.site")).toBeNull();
      expect(reads).toBe(LOOKUP_CACHE_LIMIT + 4);
    }
  });

  test("cold bursts share one read per host, state and manifest", async () => {
    const { deps } = setup();
    const reads = new Map<string, number>();
    const get = deps.bucket.get;
    deps.bucket.get = (key) => {
      reads.set(key, (reads.get(key) ?? 0) + 1);
      return get(key);
    };
    const hosts = await Promise.all(
      Array.from({ length: 100 }, () => loadHost(deps, "acme.notra.site"))
    );
    const states = await Promise.all(
      Array.from({ length: 100 }, () => loadState(deps, SITE))
    );
    const manifests = await Promise.all(
      Array.from({ length: 100 }, () => loadManifest(deps, SITE, "dep_live"))
    );
    expect(hosts.every((host) => host === hosts[0])).toBe(true);
    expect(states.every((state) => state === states[0])).toBe(true);
    expect(manifests.every((entry) => entry === manifests[0])).toBe(true);
    expect([...reads.values()]).toEqual([1, 1, 1]);
  });

  test("failed bursts share the error but the next call retries", async () => {
    for (const kind of ["host", "state", "manifest"]) {
      resetCachesForTests();
      const { deps } = setup();
      const get = deps.bucket.get;
      let reads = 0;
      let fail = true;
      deps.bucket.get = (key) => {
        reads += 1;
        return fail
          ? Promise.reject(new Error("bucket unavailable"))
          : get(key);
      };
      const load = () => {
        if (kind === "host") {
          return loadHost(deps, "acme.notra.site");
        }
        return kind === "state"
          ? loadState(deps, SITE)
          : loadManifest(deps, SITE, "dep_live");
      };
      const failed = await Promise.allSettled(
        Array.from({ length: 100 }, load)
      );
      expect(failed.every((result) => result.status === "rejected")).toBe(true);
      expect(reads).toBe(1);
      fail = false;
      expect(await load()).not.toBeNull();
      expect(reads).toBe(2);
      expect(await load()).not.toBeNull();
      expect(reads).toBe(2);
    }
  });

  test("reset detaches pending reads so they cannot repopulate or evict new loads", async () => {
    for (const kind of ["host", "state", "manifest"]) {
      resetCachesForTests();
      const { deps } = setup();
      const get = deps.bucket.get;
      let release = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      deps.bucket.get = async (key) => {
        await gate;
        return await get(key);
      };
      const load = (source: SitesDeps) => {
        if (kind === "host") {
          return loadHost(source, "acme.notra.site");
        }
        return kind === "state"
          ? loadState(source, SITE)
          : loadManifest(source, SITE, "dep_live");
      };
      const pending = load(deps);
      resetCachesForTests();
      const { deps: fresh } = setup();
      let reads = 0;
      const freshGet = fresh.bucket.get;
      fresh.bucket.get = (key) => {
        reads += 1;
        return freshGet(key);
      };
      const current = await load(fresh);
      release();
      expect(await pending).not.toBe(current);
      expect(await load(fresh)).toBe(current);
      expect(reads).toBe(1);
    }
  });

  test("state expiry coalesces without extending the five-second takedown window", async () => {
    const { deps, request, put, objects } = setup();
    const key = `sites/${SITE}/state.json`;
    let reads = 0;
    const get = deps.bucket.get;
    deps.bucket.get = (path) => {
      if (path === key) {
        reads += 1;
      }
      return get(path);
    };
    expect((await request("https://acme.notra.site/blog")).status).toBe(200);
    put(key, { ...JSON.parse(objects.get(key) ?? "{}"), status: "suspended" });
    deps.now = () => new Date("2026-10-03T12:00:04.999Z");
    expect((await request("https://acme.notra.site/blog")).status).toBe(200);
    expect(reads).toBe(1);
    deps.now = () => new Date("2026-10-03T12:00:05Z");
    const responses = await Promise.all(
      Array.from({ length: 100 }, () => request("https://acme.notra.site/blog"))
    );
    expect(responses.every((response) => response.status === 410)).toBe(true);
    expect(reads).toBe(2);
  });
});

describe("previews", () => {
  test("private missing paths and Markdown 404s authorize before any deployment lookup", async () => {
    const { deps } = setup({}, true);
    const reads: string[] = [];
    const get = deps.bucket.get;
    deps.bucket.get = (key) => {
      reads.push(key);
      return get(key);
    };
    for (const path of ["/blog/missing", "/blog/missing.md", "/blog/404.md"]) {
      for (const method of ["GET", "HEAD"]) {
        const response = await handleSiteRequest(
          new Request(`https://pr-7--acme.notra.site${path}`, {
            method,
            headers: { Accept: "text/markdown" },
          }),
          deps
        );
        expect(response.status).toBe(401);
        const text = await response.text();
        expect(text).not.toContain("dep_pr:");
        if (method === "HEAD") {
          expect(text).toBe("");
        }
      }
    }
    expect(reads.some((key) => key.startsWith("deployments/"))).toBe(false);
    const token = await signSitePreviewToken(
      {
        siteId: SITE,
        previewKey: "pr-7",
        exp: Math.floor(Date.parse("2026-10-03T13:00:00Z") / 1000),
        kind: "share",
      },
      SECRET
    );
    for (const method of ["GET", "HEAD"]) {
      const response = await handleSiteRequest(
        new Request("https://pr-7--acme.notra.site/blog/404.md", {
          method,
          headers: { Cookie: `${PREVIEW_SECURE_COOKIE}=${token}` },
        }),
        deps
      );
      expect(response.status).toBe(404);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(await response.text()).toBe(
        method === "HEAD" ? "" : "dep_pr:/blog/404.md"
      );
    }
  });
  test("protected previews need a valid token for exactly that preview", async () => {
    const { request } = setup();
    const locked = await request("https://pr-7--acme.notra.site/blog");
    expect(locked.status).toBe(401);
    expect(await locked.text()).toContain(
      "app.example.com/sites/preview-access"
    );

    const exp = Math.floor(new Date("2026-10-03T13:00:00Z").getTime() / 1000);
    const token = await signSitePreviewToken(
      { siteId: SITE, previewKey: "pr-7", exp, kind: "share" },
      SECRET
    );
    const login = await request(
      `https://pr-7--acme.notra.site/_notra/auth?token=${token}&next=/blog/post`
    );
    expect(login.status).toBe(302);
    expect(login.headers.get("Location")).toBe("/blog/post");
    expect(login.headers.get("Set-Cookie")).toContain("HttpOnly");

    const page = await request("https://pr-7--acme.notra.site/blog/post", {
      Cookie: `${PREVIEW_SECURE_COOKIE}=${token}`,
    });
    expect(page.status).toBe(200);
    expect(await page.text()).toBe("dep_pr:/blog/post/index.html");
    expect(page.headers.get("X-Robots-Tag")).toContain("noindex");
    expect(page.headers.get("Cache-Control")).toBe("private, no-store");

    const otherPreview = await signSitePreviewToken(
      { siteId: SITE, previewKey: "pr-8", exp, kind: "share" },
      SECRET
    );
    expect(
      (
        await request("https://pr-7--acme.notra.site/blog", {
          Cookie: `${PREVIEW_SECURE_COOKIE}=${otherPreview}`,
        })
      ).status
    ).toBe(401);
    const expired = await signSitePreviewToken(
      { siteId: SITE, previewKey: "pr-7", exp: exp - 7200, kind: "share" },
      SECRET
    );
    expect(
      (
        await request("https://pr-7--acme.notra.site/blog", {
          Cookie: `${PREVIEW_SECURE_COOKIE}=${expired}`,
        })
      ).status
    ).toBe(401);
  });

  test("auth redirect never leaves the preview host", async () => {
    const { request } = setup();
    const exp = Math.floor(new Date("2026-10-03T13:00:00Z").getTime() / 1000);
    const token = await signSitePreviewToken(
      {
        siteId: SITE,
        previewKey: null,
        exp,
        kind: "member",
        userId: "user_1",
        issuedAt: Date.parse("2026-10-03T11:59:00Z"),
      },
      SECRET
    );
    const login = await request(
      `https://pr-7--acme.notra.site/_notra/auth?token=${token}&next=//evil.example.com`
    );
    expect(login.headers.get("Location")).toBe("/");
  });

  test("public previews are open but noindex; unknown previews 404", async () => {
    const { request, put } = setup();
    put(`sites/${SITE}/state.json`, {
      version: 1,
      siteId: SITE,
      slug: "acme",
      status: "active",
      production: null,
      previews: {
        "br-docs": {
          deploymentId: "dep_pr",
          visibility: "public",
          sequence: 1,
          activatedAt: "x",
          expiresAt: null,
        },
      },
      updatedAt: "x",
    });
    const page = await request("https://br-docs--acme.notra.site/blog");
    expect(page.status).toBe(200);
    expect(page.headers.get("X-Robots-Tag")).toContain("noindex");
    expect(
      (await request("https://br-nope--acme.notra.site/blog")).status
    ).toBe(404);
    expect((await request("https://acme.notra.site/blog")).status).toBe(404);
  });

  test("the dev host override only works with its secret", async () => {
    const { request, deps } = setup();
    const headers = {
      "x-notra-host": "acme.notra.site",
      "x-notra-dev-token": "dev",
    };
    expect(
      (await request("https://notra-sites-dev.workers.dev/blog", headers))
        .status
    ).toBe(404);
    deps.devHostOverrideToken = "dev";
    expect(
      (await request("https://notra-sites-dev.workers.dev/blog", headers))
        .status
    ).toBe(200);
  });
});

describe("footer favicons", () => {
  function withFaviconHost(host: string) {
    const context = setup();
    const key = `deployments/${SITE}/dep_live/manifest.json`;
    const current = JSON.parse(context.objects.get(key) ?? "{}");
    context.put(key, { ...current, faviconHost: host });
    const upstream: string[] = [];
    context.deps.fetch = async (url) => {
      upstream.push(url);
      if (url.includes("domain=acme.com")) {
        return new Response(new Uint8Array([137, 80, 78, 71]), {
          headers: { "Content-Type": "image/png" },
        });
      }
      return url.includes("domain=down.dev")
        ? new Response("unavailable", { status: 503 })
        : new Response("missing", {
            status: 404,
            headers: { "Content-Type": "image/png" },
          });
    };
    return { ...context, upstream };
  }

  test("serves the favicon of the host the footer links to", async () => {
    const { request, upstream } = withFaviconHost("acme.com");
    const response = await request(
      "https://acme.notra.site/blog/_notra/favicon/acme.com"
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toContain("max-age=86400");
    expect(upstream).toEqual([
      "https://www.google.com/s2/favicons?domain=acme.com&sz=128",
    ]);
  });

  test("a host without a favicon gets a globe for a day", async () => {
    const { request } = withFaviconHost("unknown.dev");
    const response = await request(
      "https://acme.notra.site/blog/_notra/favicon/unknown.dev"
    );
    expect(response.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(response.headers.get("Cache-Control")).toContain("max-age=86400");
  });

  test("a failed lookup is retried soon instead of cached for a day", async () => {
    const { request } = withFaviconHost("down.dev");
    const response = await request(
      "https://acme.notra.site/blog/_notra/favicon/down.dev"
    );
    expect(response.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
  });

  test("does not proxy hosts the deployment never linked", async () => {
    const { request, upstream } = withFaviconHost("acme.com");
    const response = await request(
      "https://acme.notra.site/blog/_notra/favicon/evil.example"
    );
    expect(response.status).toBe(404);
    expect(upstream).toEqual([]);
  });
});
