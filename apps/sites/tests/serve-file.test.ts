import { describe, expect, test } from "bun:test";

import type { SiteManifestFile } from "@notra/sites-core/types/deployment";

import { serveFile } from "../src/serve-file";
import type { SitesDeps } from "../src/types/worker";

const POLICY = "script-src 'self' 'sha256-abc='; object-src 'none'";

const deps = {
  bucket: {
    get: async () => ({
      body: new Response("body").body,
      text: async () => "body",
    }),
  },
  cache: null,
  waitUntil: () => undefined,
} as unknown as SitesDeps;

// sha256("body")
const BODY_SHA256 =
  "230d8358dc8e8890b4c58deeb62912ee2f20357ae92a5cc861b98e68fe31acb5";

const file = (path: string, contentType: string): SiteManifestFile => ({
  path,
  size: 4,
  sha256: BODY_SHA256,
  contentType,
});

const serve = (served: SiteManifestFile, contentSecurityPolicy?: string) =>
  serveFile({
    deps,
    request: new Request(`https://acme.notra.site${served.path}`),
    siteId: "site_a",
    deploymentId: "dep_a",
    file: served,
    status: 200,
    isPreview: false,
    contentSecurityPolicy,
  });

describe("content security policy", () => {
  test("is sent with customer HTML only", async () => {
    const page = await serve(
      file("/blog/index.html", "text/html; charset=utf-8"),
      POLICY
    );
    expect(page.headers.get("Content-Security-Policy")).toBe(POLICY);
    const css = await serve(
      file("/blog/_notra/assets/a.css", "text/css"),
      POLICY
    );
    expect(css.headers.get("Content-Security-Policy")).toBeNull();
  });

  test("deployments without a policy send none", async () => {
    const page = await serve(
      file("/blog/index.html", "text/html; charset=utf-8")
    );
    expect(page.headers.get("Content-Security-Policy")).toBeNull();
  });
});

describe("caching", () => {
  test("content-hashed uploads are immutable, other public files revalidate", async () => {
    const image = file("/blog/images/hero-0123456789.webp", "image/webp");
    expect(
      (await serve({ ...image, immutable: true })).headers.get("Cache-Control")
    ).toBe("public, max-age=31536000, immutable");
    expect((await serve(image)).headers.get("Cache-Control")).toBe(
      "public, max-age=0, must-revalidate"
    );
  });

  test("the edge cache is keyed by content, so redeploys reuse it", async () => {
    const stored = new Map<string, Response>();
    let reads = 0;
    const cachingDeps = {
      bucket: {
        get: async () => {
          reads += 1;
          return { body: new Response("body").body };
        },
      },
      cache: {
        match: async (key: string) => stored.get(key)?.clone(),
        put: async (key: string, response: Response) => {
          stored.set(key, new Response(await response.text(), response));
        },
      },
      waitUntil: (promise: Promise<unknown>) => promise,
    } as unknown as SitesDeps;
    const pending: Promise<unknown>[] = [];
    const request = (deploymentId: string, path: string) =>
      serveFile({
        deps: {
          ...cachingDeps,
          waitUntil: (promise: Promise<unknown>) => pending.push(promise),
        },
        request: new Request(`https://acme.notra.site${path}`),
        siteId: "site_a",
        deploymentId,
        file: file(path, "image/webp"),
        status: 200,
        isPreview: false,
      }).then((response) => response.text());
    expect(await request("dep_a", "/blog/images/a.webp")).toBe("body");
    await Promise.all(pending);
    expect(await request("dep_b", "/changelog/images/a.webp")).toBe("body");
    expect(reads).toBe(1);
  });

  test("bodies that don't match the manifest hash are served but not cached", async () => {
    const stored = new Map<string, Response>();
    const pending: Promise<unknown>[] = [];
    const response = await serveFile({
      deps: {
        bucket: {
          get: async () => ({ body: new Response("evil").body }),
        },
        cache: {
          match: async () => undefined,
          put: async (key: string, value: Response) => {
            stored.set(key, value);
          },
        },
        waitUntil: (promise: Promise<unknown>) => pending.push(promise),
      } as unknown as SitesDeps,
      request: new Request("https://acme.notra.site/blog/index.html"),
      siteId: "site_a",
      deploymentId: "dep_a",
      file: file("/blog/index.html", "text/html"),
      status: 200,
      isPreview: false,
    });
    expect(await response.text()).toBe("evil");
    await Promise.all(pending);
    expect(stored.size).toBe(0);
  });
});
