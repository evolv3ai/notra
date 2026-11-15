import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";

import { scrapeWebsiteForBrandAnalysis } from "./context-dev";

type FakeSite = Record<string, { finalUrl?: string; markdown: string }>;

let network: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
const originalKey = process.env.CONTEXT_DEV_API_KEY;

function serve(site: FakeSite, sitemaps: Record<string, string[]>) {
  network = spyOn(globalThis, "fetch").mockImplementation((async (
    input: string | URL | Request
  ) => {
    const requestUrl = new URL(String(input));
    if (requestUrl.pathname.endsWith("/web/scrape/sitemap")) {
      const domain = requestUrl.searchParams.get("domain") ?? "";
      return Response.json({ urls: sitemaps[domain] ?? [] });
    }
    const pageUrl = requestUrl.searchParams.get("url") ?? "";
    const page = site[pageUrl];
    if (!page) {
      return Response.json({ message: "timeout" }, { status: 504 });
    }
    return Response.json({
      markdown: page.markdown,
      metadata: { finalUrl: page.finalUrl ?? pageUrl },
      url: pageUrl,
    });
  }) as typeof fetch);
}

beforeEach(() => {
  process.env.CONTEXT_DEV_API_KEY = "test-key";
});

afterEach(() => {
  network.mockRestore();
  process.env.CONTEXT_DEV_API_KEY = originalKey;
});

describe("scrapeWebsiteForBrandAnalysis", () => {
  test("follows a homepage redirect to the brand's new domain", async () => {
    serve(
      {
        "https://getcargo.io": {
          finalUrl: "https://www.getcargo.ai/",
          markdown: "Cargo home",
        },
        "https://www.getcargo.ai/about": { markdown: "About Cargo" },
        "https://www.getcargo.ai/pricing": {
          finalUrl: "https://parked.example/",
          markdown: "Someone else",
        },
      },
      {
        "www.getcargo.ai": [
          "https://www.getcargo.ai/about",
          "https://www.getcargo.ai/pricing",
        ],
      }
    );

    const result = await scrapeWebsiteForBrandAnalysis("https://getcargo.io");

    expect(result.success).toBe(true);
    const content = result.success ? result.content : "";
    expect(content).toContain("Cargo home");
    expect(content).toContain("About Cargo");
    expect(content).not.toContain("Someone else");
  });

  test("uses the subdomain's sitemap after a subdomain redirect", async () => {
    serve(
      {
        "https://example.com": {
          finalUrl: "https://brand.example.com/",
          markdown: "Brand home",
        },
        "https://brand.example.com/about": { markdown: "About Brand" },
      },
      {
        "example.com": ["https://example.com/about"],
        "brand.example.com": ["https://brand.example.com/about"],
      }
    );

    const result = await scrapeWebsiteForBrandAnalysis("https://example.com");

    expect(result).toEqual({
      success: true,
      content: expect.stringContaining("About Brand"),
    });
  });

  test("uses subpages when the homepage cannot be fetched", async () => {
    serve(
      { "https://acme.dev/about": { markdown: "About Acme" } },
      { "acme.dev": ["https://acme.dev/about"] }
    );

    const result = await scrapeWebsiteForBrandAnalysis("acme.dev");

    expect(result).toEqual({
      success: true,
      content: expect.stringContaining("About Acme"),
    });
  });
});
