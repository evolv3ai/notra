import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";

import {
  SITE_ASSETS_DIR,
  SITE_CONFIG_FILENAME,
} from "@notra/sites-core/constants/sites";
import type { SiteConfig } from "@notra/sites-core/types/site-config";

import {
  FONT_CSS_MAX_BYTES,
  FONT_DOWNLOAD_CONCURRENCY,
  FONT_FETCH_TIMEOUT_MS,
  FONT_FILE_MAX_BYTES,
  FONT_LICENSE_LOCATIONS,
  FONT_PATH_RE,
  FONT_URL_RE,
  FONT_USER_AGENT,
  FONT_COMMON_WEIGHTS,
  FONT_WEIGHT_RANGES,
  DEFAULT_HEADING_WEIGHT,
  GOOGLE_FONTS_CSS_URL,
  GOOGLE_FONTS_LICENSE_URL,
} from "../constants/fonts";
import type { SiteFontsResult } from "../types/fonts";
import { exists, writeFileEnsured } from "./fs";

class FontRequestError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Font download failed (${status})`);
    this.status = status;
  }
}

function discreteWeights(weights: number[]): string {
  return [...new Set(weights)].sort((a, b) => a - b).join(";");
}

/**
 * Weight specs to try per family, best first: ranges for variable fonts, then
 * the exact weights, which static fonts like Lato only serve one by one.
 */
function weightCandidates(weights: (number | undefined)[]): string[] {
  const explicit = weights.filter((weight) => weight !== undefined);
  if (!weights.includes(undefined)) {
    return [discreteWeights(explicit)];
  }
  const ranges = FONT_WEIGHT_RANGES.map(([min, max]) => {
    const low = Math.min(min, ...explicit);
    const high = Math.max(max, ...explicit);
    return low === high ? `${low}` : `${low}..${high}`;
  });
  return [
    ...new Set([
      ...ranges,
      discreteWeights([...FONT_COMMON_WEIGHTS, ...explicit]),
      discreteWeights([400, ...explicit]),
      "400",
    ]),
  ];
}

function requestedWeights(
  fonts: SiteConfig["fonts"]
): Map<string, (number | undefined)[]> {
  const headingWeight = fonts?.heading?.weight;
  const uses = [
    {
      spec: fonts?.body?.family ? fonts.body : fonts,
      weights: [fonts?.body?.weight ?? fonts?.weight],
    },
    {
      spec: fonts?.heading?.family
        ? fonts.heading
        : fonts?.family
          ? fonts
          : fonts?.body,
      weights:
        headingWeight === undefined
          ? [undefined, DEFAULT_HEADING_WEIGHT]
          : [headingWeight],
    },
  ];
  const families = new Map<string, (number | undefined)[]>();
  for (const { spec, weights } of uses) {
    if (spec?.family && !spec.source) {
      families.set(spec.family, [
        ...(families.get(spec.family) ?? []),
        ...weights,
      ]);
    }
  }
  return families;
}

function googleFontsUrl(specs: Map<string, string>): URL {
  const url = new URL(GOOGLE_FONTS_CSS_URL);
  for (const [family, spec] of [...specs].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    url.searchParams.append("family", `${family}:wght@${spec}`);
  }
  url.searchParams.set("display", "swap");
  return url;
}

async function firstSupportedSpec(
  family: string,
  options: string[]
): Promise<string> {
  for (const spec of options) {
    try {
      await fetchFontAsset(
        googleFontsUrl(new Map([[family, spec]])).toString(),
        FONT_CSS_MAX_BYTES
      );
      return spec;
    } catch (error) {
      if (!(error instanceof FontRequestError && error.status === 400)) {
        throw error;
      }
    }
  }
  throw new Error(`Google Fonts has no ${family} in the requested weights`);
}

async function supportedFontsUrl(
  candidates: Map<string, string[]>
): Promise<URL> {
  const specs = await Promise.all(
    [...candidates].map(
      async ([family, options]) =>
        [family, await firstSupportedSpec(family, options)] as const
    )
  );
  return googleFontsUrl(new Map(specs));
}

async function fetchFontAsset(url: string, maxBytes: number): Promise<Buffer> {
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(FONT_FETCH_TIMEOUT_MS),
    headers: { "User-Agent": FONT_USER_AGENT },
  });
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new FontRequestError(response.status);
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      size += value.byteLength;
      if (size > maxBytes) {
        throw new Error("Font download exceeded its size limit");
      }
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks);
}

async function fetchFontLicense(family: string): Promise<Buffer> {
  const directory = family.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const [category, name] of FONT_LICENSE_LOCATIONS) {
    try {
      return await fetchFontAsset(
        `${GOOGLE_FONTS_LICENSE_URL}/${category}/${directory}/${name}`,
        FONT_CSS_MAX_BYTES
      );
    } catch {
      // Older fonts use Apache or Ubuntu licenses instead of OFL.
    }
  }
  throw new Error(
    `Could not retrieve the redistribution license for ${family}`
  );
}

export async function prepareSiteFonts(
  config: SiteConfig,
  workDir: string
): Promise<SiteFontsResult> {
  const families = requestedWeights(config.fonts);
  if (families.size === 0) {
    return { publicFiles: [], diagnostics: [] };
  }

  let stagingDir: string | undefined;
  let publicDir: string | undefined;
  try {
    const candidates = new Map(
      [...families].map(([family, weights]) => [
        family,
        weightCandidates(weights),
      ])
    );
    const url = googleFontsUrl(
      new Map(
        [...candidates].map(([family, specs]) => [family, specs[0] ?? ""])
      )
    );
    const key = createHash("sha256")
      .update(url.toString())
      .update(JSON.stringify([...candidates]))
      .digest("hex");
    const cacheRoot = join(workDir, "font-cache");
    const cacheDir = join(cacheRoot, key);
    const publicPath = `/${SITE_ASSETS_DIR}/fonts/${key}`;
    publicDir = join(workDir, "site", "public", publicPath);
    if (!(await exists(cacheDir))) {
      await mkdir(cacheRoot, { recursive: true });
      stagingDir = await mkdtemp(join(cacheRoot, "batch-"));
      try {
        await downloadSiteFonts(url, [...families.keys()], stagingDir, true);
      } catch (error) {
        if (!(error instanceof FontRequestError && error.status === 400)) {
          throw error;
        }
        // A font without the full default range: retry with ranges it has.
        await rm(stagingDir, { recursive: true, force: true });
        stagingDir = await mkdtemp(join(cacheRoot, "batch-"));
        await downloadSiteFonts(
          await supportedFontsUrl(candidates),
          [...families.keys()],
          stagingDir,
          false
        );
      }
      await rename(stagingDir, cacheDir);
      stagingDir = undefined;
    }
    const names = await readdir(cacheDir);
    const stylesheet = names.find((name) => name.endsWith(".css"));
    if (!stylesheet) {
      throw new Error("Cached font stylesheet is missing");
    }
    await cp(cacheDir, publicDir, { recursive: true });
    return {
      stylesheet: `${publicPath}/${stylesheet}`,
      publicFiles: names.map((name) => `${publicPath}/${name}`),
      diagnostics: [],
    };
  } catch (error) {
    await Promise.all(
      [stagingDir, publicDir]
        .filter((path) => path !== undefined)
        .map((path) => rm(path, { recursive: true, force: true }))
    );
    return {
      publicFiles: [],
      diagnostics: [
        {
          severity: "warning",
          file: SITE_CONFIG_FILENAME,
          code: "font_download",
          message: `Could not bundle site fonts; system fonts will be used. ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}

async function downloadSiteFonts(
  url: URL,
  families: string[],
  stagingDir: string,
  requireEveryFamily: boolean
): Promise<void> {
  const css = (
    await fetchFontAsset(url.toString(), FONT_CSS_MAX_BYTES)
  ).toString("utf8");
  const urls = [
    ...new Set(
      [...css.matchAll(FONT_URL_RE)].flatMap((match) =>
        match[1] ? [match[1]] : []
      )
    ),
  ];
  if (urls.length === 0) {
    throw new Error("Font stylesheet contains no font files");
  }
  // With several families, Google answers 200 and silently drops a family
  // whose weights don't exist, so treat that like the single-family 400.
  const served = css.toLowerCase();
  if (
    requireEveryFamily &&
    families.some(
      (family) => !served.includes(`font-family: '${family.toLowerCase()}'`)
    )
  ) {
    throw new FontRequestError(400);
  }
  const sources = urls.map((source) => {
    const parsed = new URL(source);
    if (
      parsed.protocol !== "https:" ||
      parsed.host !== "fonts.gstatic.com" ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      !FONT_PATH_RE.test(parsed.pathname)
    ) {
      throw new Error("Unsupported font file URL");
    }
    return { source, extension: parsed.pathname.split(".").at(-1) };
  });
  const replacements = new Map<string, string>();
  const downloads = families.map((family) => async () => {
    const license = await fetchFontLicense(family);
    const hash = createHash("sha256")
      .update(license)
      .digest("hex")
      .slice(0, 16);
    await writeFileEnsured(
      join(stagingDir, `font-license-${hash}.txt`),
      license
    );
  });
  downloads.push(
    ...sources.map(({ source, extension }) => async () => {
      const bytes = await fetchFontAsset(source, FONT_FILE_MAX_BYTES);
      const hash = createHash("sha256")
        .update(bytes)
        .digest("hex")
        .slice(0, 16);
      const name = `font-${hash}.${extension}`;
      await writeFileEnsured(join(stagingDir, name), bytes);
      replacements.set(source, `./${name}`);
    })
  );
  const results = await Promise.allSettled(
    Array.from({ length: FONT_DOWNLOAD_CONCURRENCY }, async () => {
      let download = downloads.shift();
      while (download) {
        await download();
        download = downloads.shift();
      }
    })
  );
  for (const result of results) {
    if (result.status === "rejected") {
      throw result.reason;
    }
  }
  const localCss = css.replace(
    FONT_URL_RE,
    (_, source: string) => `url("${replacements.get(source)}")`
  );
  if (/https?:\/\//i.test(localCss) || /@import/i.test(localCss)) {
    throw new Error("Unsupported external font stylesheet reference");
  }
  const hash = createHash("sha256").update(localCss).digest("hex").slice(0, 16);
  const stylesheet = `fonts-${hash}.css`;
  await writeFileEnsured(join(stagingDir, stylesheet), localCss);
}
