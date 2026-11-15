import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { extname, join } from "node:path";

import { parseEntryFrontmatter } from "@notra/sites-compiler/frontmatter";
import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";
import type { SiteDiagnostic } from "@notra/sites-core/types/build";
import type { SiteArea } from "@notra/sites-core/types/deployment";
import { Resvg } from "@resvg/resvg-js";
import type { ReactElement } from "react";
import satori from "satori";

import { AREA_DEFAULT_TITLES } from "../src/constants/areas";
import { OG_MANIFEST_FILE } from "../src/constants/og";
import { configuredAreaTitle, withSiteName } from "../src/utils/area-titles";
import { OgArticleCard } from "./components/og-article-card";
import { OgAuthorCard } from "./components/og-author-card";
import { OgCard } from "./components/og-card";
import {
  OG_BACKGROUND_MIME_TYPES,
  OG_FONT_SUBSETS,
  OG_FONT_WEIGHTS,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  OG_IMAGES_DIR,
} from "./constants/og-images";
import type {
  FrontmatterAuthor,
  OgAuthor,
  OgCardStyle,
  OgBackgroundResult,
  OgImagesResult,
  OgManifest,
  SatoriFont,
  WriteOgImagesParams,
} from "./types/og-images";
import { writeFileEnsured } from "./utils/fs";

let fontsPromise: Promise<SatoriFont[]> | null = null;

function loadFonts(): Promise<SatoriFont[]> {
  fontsPromise ??= (async () => {
    const require = createRequire(import.meta.url);
    const specs = OG_FONT_SUBSETS.flatMap((subset) =>
      OG_FONT_WEIGHTS.map((weight) => ({ subset, weight }))
    );
    return Promise.all(
      specs.map(async ({ subset, weight }) => ({
        name: `Inter ${subset}`,
        weight,
        style: "normal" as const,
        data: await readFile(
          require.resolve(
            `@fontsource/inter/files/inter-${subset}-${weight}-normal.woff`
          )
        ),
      }))
    );
  })();
  return fontsPromise;
}

function formatShortDate(date: Date, now: Date): string {
  const sameYear = date.getUTCFullYear() === now.getUTCFullYear();
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  }).format(date);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

async function loadBackground(
  params: WriteOgImagesParams
): Promise<OgBackgroundResult> {
  const path = params.config.thumbnails.background;
  if (!path) {
    return {};
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const mimeType = OG_BACKGROUND_MIME_TYPES[extname(normalized).toLowerCase()];
  if (!(mimeType && params.publicFiles.includes(normalized))) {
    return {
      diagnostic: {
        severity: "warning",
        file: SITE_CONFIG_FILENAME,
        code: "thumbnail_background",
        message: `thumbnails.background: ${path} is not a PNG, JPEG or SVG file in public/. Share images are generated without it.`,
      },
    };
  }
  const bytes = await readFile(
    join(params.workDir, "site", "public", normalized)
  );
  return { dataUri: `data:${mimeType};base64,${bytes.toString("base64")}` };
}

async function publicImage(
  params: WriteOgImagesParams,
  path: string | undefined
): Promise<string | undefined> {
  if (!path || /^https?:\/\//.test(path)) {
    return undefined;
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const mimeType = OG_BACKGROUND_MIME_TYPES[extname(normalized).toLowerCase()];
  if (!(mimeType && params.publicFiles.includes(normalized))) {
    return undefined;
  }
  const bytes = await readFile(
    join(params.workDir, "site", "public", normalized)
  );
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

async function resolveAuthor(
  params: WriteOgImagesParams,
  ref: FrontmatterAuthor
): Promise<OgAuthor | undefined> {
  const id = typeof ref === "string" ? ref : ref.id;
  const configured =
    id && Object.hasOwn(params.config.authors, id)
      ? params.config.authors[id]
      : undefined;
  const inline = typeof ref === "string" ? undefined : ref;
  const name =
    configured?.name ??
    inline?.name ??
    (typeof ref === "string" ? ref : undefined);
  if (!name) {
    return undefined;
  }
  return {
    name,
    title: configured?.title ?? inline?.title,
    avatar: await publicImage(params, configured?.avatar ?? inline?.avatar),
  };
}

async function resolveAuthors(
  params: WriteOgImagesParams,
  value: FrontmatterAuthor | FrontmatterAuthor[] | undefined
): Promise<OgAuthor[]> {
  const refs = value === undefined ? [] : [value].flat();
  const authors = await Promise.all(
    refs.map((ref) => resolveAuthor(params, ref))
  );
  return authors.filter((author) => author !== undefined);
}

function authorWithFallback(
  author: OgAuthor | undefined,
  logo: string | undefined
): OgAuthor | undefined {
  return author && !author.avatar && logo
    ? { ...author, avatar: logo }
    : author;
}

function siteLogo(config: WriteOgImagesParams["config"]): string | undefined {
  const { logo, favicon } = config;
  const path = typeof logo === "string" ? logo : logo?.light;
  return path ?? (typeof favicon === "string" ? favicon : favicon?.light);
}

async function renderPng(
  card: ReactElement,
  fonts: SatoriFont[]
): Promise<Buffer> {
  const svg = await satori(card, {
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    fonts,
  });
  return new Resvg(svg, {
    fitTo: { mode: "width", value: OG_IMAGE_WIDTH },
  })
    .render()
    .asPng();
}

/** The share image of a section's index, also used by its tag and author pages. */
function areaCard(
  params: WriteOgImagesParams,
  area: SiteArea,
  style: OgCardStyle
): ReactElement {
  const { config } = params;
  const title = configuredAreaTitle(config, area);
  const section = config.thumbnails.label ?? AREA_DEFAULT_TITLES[area];
  if (config.thumbnails.layout === "article") {
    return OgArticleCard({
      ...style,
      date: config.name,
      category: section === title ? "" : section,
      title,
      description: config[area]?.description ?? config.description,
      authors: [],
    });
  }
  if (config.thumbnails.layout === "author") {
    return OgAuthorCard({ ...style, label: section, title });
  }
  return OgCard({
    ...style,
    eyebrow: config.name,
    title,
    footer: style.domain,
  });
}

async function writeCard(
  params: WriteOgImagesParams,
  card: ReactElement,
  fonts: SatoriFont[],
  urlPath: string
): Promise<void> {
  await writeFileEnsured(
    join(params.workDir, "site", "public", urlPath),
    await renderPng(card, fonts)
  );
}

export async function writeOgImages(
  params: WriteOgImagesParams
): Promise<OgImagesResult> {
  const started = Date.now();
  const manifest: OgManifest = {};
  const diagnostics: SiteDiagnostic[] = [];
  const { config } = params;
  if (config.thumbnails.enabled) {
    const [fonts, background] = await Promise.all([
      loadFonts(),
      loadBackground(params),
    ]);
    if (background.diagnostic) {
      diagnostics.push(background.diagnostic);
    }
    const appearance = config.thumbnails.appearance;
    const style: OgCardStyle = {
      appearance,
      accent:
        appearance === "dark"
          ? (config.colors.light ?? config.colors.primary)
          : config.colors.primary,
      logo: await publicImage(params, siteLogo(config)),
      domain: new URL(params.publicOrigin).hostname.replace(/^www\./, ""),
      background: background.dataUri,
    };
    const { accent, logo, domain } = style;
    const now = new Date();
    // seo.image replaces the generated section cards; posts keep their own.
    const areas = config.seo.image ? [] : params.areas;
    await Promise.all(
      areas.map(async (area) => {
        const urlPath = `/${OG_IMAGES_DIR}/${area}.png`;
        await writeCard(params, areaCard(params, area, style), fonts, urlPath);
        manifest[area] = urlPath;
      })
    );
    await Promise.all(
      params.entries.map(async (entry) => {
        const source = await readFile(
          join(
            params.workDir,
            "entries",
            entry.area,
            `${entry.slug}.${entry.format}`
          ),
          "utf8"
        );
        const { data } = parseEntryFrontmatter(entry.path, entry.area, source);
        if (!data || data.image || (data.draft && !params.includeDrafts)) {
          return;
        }
        const version = "version" in data ? data.version : undefined;
        const authors =
          config.thumbnails.layout !== "default" && "author" in data
            ? await resolveAuthors(params, data.author)
            : [];
        const areaTitle = configuredAreaTitle(config, entry.area);
        let card: ReactElement;
        if (config.thumbnails.layout === "article") {
          card = OgArticleCard({
            date: formatShortDate(data.date, now),
            category: data.tags[0] ?? config.thumbnails.label ?? areaTitle,
            title: data.title,
            description: data.description,
            domain,
            appearance,
            accent,
            logo,
            authors,
            background: background.dataUri,
          });
        } else if (config.thumbnails.layout === "author") {
          card = OgAuthorCard({
            label: config.thumbnails.label ?? areaTitle,
            title: data.title,
            domain,
            appearance,
            logo,
            author: authorWithFallback(authors[0], logo),
            background: background.dataUri,
          });
        } else {
          card = OgCard({
            eyebrow: withSiteName(config.name, areaTitle, " · "),
            title: data.title,
            footer: [version, formatDate(data.date)]
              .filter(Boolean)
              .join(" · "),
            appearance,
            accent,
            background: background.dataUri,
          });
        }
        const urlPath = `/${OG_IMAGES_DIR}/${entry.area}/${entry.slug}.png`;
        await writeCard(params, card, fonts, urlPath);
        manifest[`${entry.area}/${entry.slug}`] = urlPath;
      })
    );
  }
  const sorted = Object.fromEntries(
    Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))
  );
  await writeFileEnsured(
    join(params.workDir, OG_MANIFEST_FILE),
    `${JSON.stringify(sorted, null, 2)}\n`
  );
  return { manifest: sorted, diagnostics, durationMs: Date.now() - started };
}
