import { Resvg } from "@resvg/resvg-js";
import type { ReactNode } from "react";
import satori from "satori";
import type { Font } from "satori";
import type {
  ImageResponseOptions,
  OgAdditionalAsset,
  OgFallbackFamily,
} from "~types/og";

import {
  OG_FALLBACK_FONTS,
  OG_GOOGLE_FONTS_USER_AGENT,
  OG_TWEMOJI_BASE_URL,
} from "@/utils/constants";

const FONT_URL_REGEX = /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/;
const ZERO_WIDTH_JOINER = String.fromCodePoint(0x20_0d);
const VARIATION_SELECTOR = String.fromCodePoint(0xfe_0f);
const assetCache = new Map<string, Promise<OgAdditionalAsset>>();

function emojiCode(segment: string) {
  const chars = segment.includes(ZERO_WIDTH_JOINER)
    ? segment
    : segment.replaceAll(VARIATION_SELECTOR, "");
  return Array.from(chars, (char) => char.codePointAt(0)?.toString(16)).join(
    "-"
  );
}

async function fetchGoogleFont(params: URLSearchParams) {
  const css = await fetch(`https://fonts.googleapis.com/css2?${params}`, {
    headers: { "User-Agent": OG_GOOGLE_FONTS_USER_AGENT },
  }).then((res) => res.text());
  const url = css.match(FONT_URL_REGEX)?.[1];
  if (!url) {
    return null;
  }
  const res = await fetch(url);
  return res.ok ? res.arrayBuffer() : null;
}

async function loadGoogleFont(family: string, text: string) {
  return (
    (await fetchGoogleFont(new URLSearchParams({ family, text }))) ??
    fetchGoogleFont(new URLSearchParams({ family }))
  );
}

async function loadFallbackFonts(languageCode: string, text: string) {
  const families: OgFallbackFamily[] = languageCode
    .split("|")
    .flatMap((code) =>
      (OG_FALLBACK_FONTS[code] ?? []).map((name) => ({ code, name }))
    );
  const fonts: Font[] = [];
  for (const { code, name } of families) {
    const data = await loadGoogleFont(name, text).catch(() => null);
    if (data) {
      fonts.push({
        name: `${name} fallback ${text}`,
        data,
        weight: 400,
        style: "normal",
        lang: code === "unknown" ? undefined : code,
      });
    }
  }
  return fonts;
}

async function loadAsset(
  languageCode: string,
  segment: string
): Promise<OgAdditionalAsset> {
  if (languageCode !== "emoji") {
    return loadFallbackFonts(languageCode, segment);
  }
  const res = await fetch(`${OG_TWEMOJI_BASE_URL}${emojiCode(segment)}.svg`);
  if (!res.ok) {
    return [];
  }
  const svg = Buffer.from(await res.text()).toString("base64");
  return `data:image/svg+xml;base64,${svg}`;
}

function loadAdditionalAsset(languageCode: string, segment: string) {
  const key = `${languageCode}:${segment}`;
  const cached =
    assetCache.get(key) ??
    loadAsset(languageCode, segment).catch((): OgAdditionalAsset => {
      assetCache.delete(key);
      return [];
    });
  assetCache.set(key, cached);
  return cached;
}

export class ImageResponse extends Response {
  constructor(element: ReactNode, options: ImageResponseOptions) {
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        const svg = await satori(element, { loadAdditionalAsset, ...options });
        controller.enqueue(new Resvg(svg).render().asPng());
        controller.close();
      },
    });
    super(body, {
      headers: {
        "content-type": "image/png",
        "cache-control":
          process.env.NODE_ENV === "development"
            ? "no-cache, no-store"
            : "public, immutable, no-transform, max-age=31536000",
      },
    });
  }
}
