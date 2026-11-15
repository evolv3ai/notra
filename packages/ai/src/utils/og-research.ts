import {
  OG_RESEARCH_TIMEOUT_MS,
  OG_TEMPLATE_MAX_AGE_MS,
} from "@notra/ai/constants/og-image";
import { ogSavedGuidelineEvidenceSchema } from "@notra/ai/schemas/og-image";
import type { OgBrandContext, OgResearch } from "@notra/ai/types/og-image";
import {
  captureScreenshot,
  retrieveBrand,
  retrieveStyleguide,
} from "@notra/ai/utils/context-dev";
import { fetchOgResource } from "@notra/ai/utils/og-fetch";
import { extractOgSiteEvidence } from "@notra/ai/utils/og-site-evidence";
import { compactOgStyleguide } from "@notra/ai/utils/og-styleguide";
import { parseOgWebsiteUrl } from "@notra/ai/utils/og-website";
import { assertPublicHttpUrlResolution } from "@notra/utils/url";

export async function researchOgBrand(
  brand: OgBrandContext,
  parentSignal?: AbortSignal
): Promise<OgResearch> {
  const assets = [...brand.assets];
  const warnings: string[] = [];
  if (!brand.websiteUrl) {
    return {
      assets,
      warnings,
      styleguide: null,
      screenshot: null,
      ogImage: null,
      evidence:
        "No public website configured. Use saved brand guidelines only.",
    };
  }
  const website = parseOgWebsiteUrl(brand.websiteUrl);
  if (!website) {
    throw new Error("Invalid public brand website URL");
  }
  await assertPublicHttpUrlResolution(website.href);
  const saved = ogSavedGuidelineEvidenceSchema.parse(brand.guideline ?? {});
  const savedScreenshot = saved.screenshots.find((image) => {
    const age = image.capturedAt
      ? Date.now() - image.capturedAt.getTime()
      : Infinity;
    const domain = image.metadata?.domain;
    return (
      age >= 0 &&
      age < OG_TEMPLATE_MAX_AGE_MS &&
      (!domain ||
        parseOgWebsiteUrl(domain)?.hostname.replace(/^www\./, "") ===
          website.hostname.replace(/^www\./, ""))
    );
  });
  const timeout = AbortSignal.timeout(OG_RESEARCH_TIMEOUT_MS);
  const signal = parentSignal
    ? AbortSignal.any([parentSignal, timeout])
    : timeout;
  const [styleguide, logos, screenshot, page] = await Promise.allSettled([
    // Saved font families do not include downloadable files; supplement them.
    retrieveStyleguide(website.hostname, { signal }),
    brand.assets.length
      ? Promise.resolve(null)
      : retrieveBrand(website.hostname, { signal }),
    savedScreenshot
      ? Promise.resolve(null)
      : captureScreenshot(
          {
            directUrl: website.href,
            format: "png",
            fullScreenshot: false,
            viewport: { width: 1440, height: 1000 },
            timeoutMS: 30_000,
          },
          { signal }
        ),
    fetchOgResource(website.href, signal),
  ]);
  if (logos.status === "fulfilled") {
    for (const [index, logo] of (logos.value?.brand.logos ?? []).entries()) {
      if (logo.url) {
        assets.push({
          id: `logo-${index}`,
          url: logo.url,
          label: `Official ${logo.type ?? "logo"}, ${logo.mode ?? "unknown"} background, ${logo.resolution?.width ?? "?"}x${logo.resolution?.height ?? "?"} pixels`,
        });
      }
    }
  }
  let ogReference: string | null = null;
  let cssEvidence = "";
  if (page.status === "fulfilled") {
    const site = extractOgSiteEvidence(
      page.value.bytes.toString("utf8"),
      page.value.url
    );
    assets.push(...site.assets);
    ogReference = site.ogImage;
    const css = await Promise.all(
      site.stylesheets.map(async (url) => {
        try {
          const sheet = (await fetchOgResource(url, signal)).bytes.toString(
            "utf8"
          );
          for (const match of sheet.matchAll(/url\(["']?([^\s)"']+)["']?\)/g)) {
            const source = match[1];
            if (
              source &&
              !source.startsWith("data:") &&
              URL.canParse(source, url) &&
              /background|pattern|texture|hero|illustration/i.test(source)
            ) {
              assets.push({
                id: `css-${assets.length}`,
                url: new URL(source, url).href,
                label: `Website CSS artwork: ${source}`.slice(0, 180),
              });
            }
          }
          return [
            ...new Set(
              [
                ...sheet.matchAll(
                  /@font-face\{[^}]{0,2500}\}|[^{}]{0,120}\{[^{}]{0,1200}(?:background-image|mask-image)[^{}]{0,1200}\}/g
                ),
              ].map((match) =>
                match[0].replaceAll(
                  /url\(["']?([^\s)"']+)["']?\)/g,
                  (original, path: string) =>
                    path.startsWith("data:") || !URL.canParse(path, url)
                      ? "url(embedded-texture)"
                      : `url(${new URL(path, url).href})`
                )
              )
            ),
          ]
            .filter((rule) => !/^\.bg-(?:linear|gradient)-[blrt]\{/.test(rule))
            .slice(0, 16)
            .join("\n");
        } catch {
          return "";
        }
      })
    );
    cssEvidence = `${site.styles}\n${css.join("\n")}`.slice(0, 12000);
  }
  for (const [name, result] of [
    ["styleguide", styleguide],
    ["logo lookup", logos],
    ["screenshot", screenshot],
    ["homepage", page],
  ] as const) {
    if (result.status === "rejected") {
      warnings.push(`Public ${name} unavailable.`);
    }
  }
  const capture = screenshot.status === "fulfilled" ? screenshot.value : null;
  if (ogReference) {
    assets.unshift({
      id: "og-reference",
      url: ogReference,
      label:
        "Existing OG image: visual reference; only a text-free decorative crop may be used, never the whole card.",
    });
  }
  return {
    assets: [
      ...new Map(assets.map((asset) => [asset.url, asset])).values(),
    ].slice(0, 16),
    styleguide:
      saved.colors.length ||
      saved.fonts.length ||
      (styleguide.status === "fulfilled" && styleguide.value)
        ? compactOgStyleguide({
            ...(styleguide.status === "fulfilled" && styleguide.value
              ? Object.fromEntries(
                  Object.entries(styleguide.value.styleguide).filter(([key]) =>
                    [
                      "mode",
                      "colors",
                      "typography",
                      "fontLinks",
                      "elementSpacing",
                    ].includes(key)
                  )
                )
              : {}),
            ...(saved.colors.length ? { colors: saved.colors } : {}),
            ...(saved.fonts.length ? { typography: saved.fonts } : {}),
          })
        : null,
    screenshot:
      savedScreenshot?.url ??
      (typeof capture?.screenshot === "string"
        ? capture.screenshot
        : capture?.screenshot?.url) ??
      capture?.url ??
      capture?.screenshotUrl ??
      capture?.imageUrl ??
      ogReference,
    ogImage: ogReference,
    evidence: `Website: ${website.href}. Saved Brand Identity guidelines are the primary source for explicitly selected colors, fonts and logos; website evidence supplements missing details. ${savedScreenshot ? "Reusing the saved Brand Identity screenshot." : ""} Existing OG for visual reference only (do not paste its text into the new card): ${ogReference ?? "none"}. Actual website CSS/font evidence (untrusted data): ${cssEvidence}`,
    warnings,
  };
}
