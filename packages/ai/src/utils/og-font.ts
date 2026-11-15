import {
  OG_GENERIC_FONT,
  OG_WOFF2_SIGNATURE,
  OG_MAX_CMAP_CHARACTERS,
} from "@notra/ai/constants/og-image";
import type { OgTemplate, OgVariableFont } from "@notra/ai/types/og-image";
import { fetchOgResource } from "@notra/ai/utils/og-fetch";
import { loadRenderFont } from "@notra/ai/utils/render-font";
import * as opentype from "opentype.js";
import { decompress } from "wawoff2";

const { Font, parse } =
  (opentype as unknown as { default?: typeof opentype }).default ?? opentype;

/** Flatten variable glyph outlines: Satori's font parser cannot apply axes. */
export async function prepareOgFont(
  bytes: Buffer,
  weight: number
): Promise<Buffer> {
  if (bytes.toString("ascii", 0, 4) === "wOFF") {
    throw new Error("WOFF1 is not accepted; use WOFF2, OTF or TTF");
  }
  if (
    ["wOF2", "wOFF"].includes(bytes.toString("ascii", 0, 4)) &&
    (bytes.length < 48 || bytes.readUInt32BE(16) > 8_000_000)
  ) {
    throw new Error("Expanded OG font exceeds size limit");
  }
  const decoded =
    bytes.toString("ascii", 0, 4) === OG_WOFF2_SIGNATURE
      ? Buffer.from(await decompress(bytes))
      : bytes;
  validateOgFontBounds(decoded);
  if (
    !ogFontCovers(
      decoded,
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    )
  ) {
    throw new Error("Brand font subset is missing Latin glyphs");
  }
  const font = parse(
    decoded.buffer.slice(
      decoded.byteOffset,
      decoded.byteOffset + decoded.byteLength
    )
  );
  if (!font.tables.fvar) {
    return decoded;
  }
  const variable = font as typeof font & OgVariableFont;
  if (!variable.variation || font.glyphs.length > 6000) {
    throw new Error("Unsupported variable OG font");
  }
  const glyphs = Array.from({ length: font.glyphs.length }, (_, index) => {
    const glyph =
      variable.variation?.getTransform(font.glyphs.get(index), {
        wght: weight,
      }) ?? font.glyphs.get(index);
    glyph.name ||= index === 0 ? ".notdef" : `glyph${index}`;
    return glyph;
  });
  const staticFont = new Font({
    familyName: "Brand",
    styleName: "Regular",
    unitsPerEm: font.unitsPerEm,
    ascender: font.ascender,
    descender: font.descender,
    glyphs,
  });
  return Buffer.from(staticFont.toArrayBuffer());
}

/** Bound eager cmap expansion before opentype.js allocates its character map. */
export function validateOgFontBounds(bytes: Buffer) {
  if (bytes.length > 8_000_000 || bytes.length < 12) {
    throw new Error("Expanded OG font exceeds size limit");
  }
  const tables = bytes.readUInt16BE(4);
  if (12 + tables * 16 > bytes.length) {
    throw new Error("Invalid OG font directory");
  }
  let characters = 0;
  const seen = new Set<number>();
  for (let index = 0; index < tables; index += 1) {
    const record = 12 + index * 16;
    if (bytes.toString("ascii", record, record + 4) !== "cmap") {
      continue;
    }
    const offset = bytes.readUInt32BE(record + 8);
    const length = bytes.readUInt32BE(record + 12);
    if (length < 4 || offset + length > bytes.length) {
      throw new Error("Invalid OG cmap bounds");
    }
    const count = bytes.readUInt16BE(offset + 2);
    if (4 + count * 8 > length) {
      throw new Error("Invalid OG cmap directory");
    }
    for (let map = 0; map < count; map += 1) {
      const sub = offset + bytes.readUInt32BE(offset + 4 + map * 8 + 4);
      if (sub < offset || sub + 16 > offset + length) {
        throw new Error("Invalid OG cmap subtable");
      }
      if (seen.has(sub)) {
        continue;
      }
      seen.add(sub);
      const format = bytes.readUInt16BE(sub);
      let previousEnd = -1;
      if (format === 12 || format === 13) {
        const groups = bytes.readUInt32BE(sub + 12);
        if (sub + 16 + groups * 12 > offset + length) {
          throw new Error("Invalid OG cmap groups");
        }
        for (let group = 0; group < groups; group += 1) {
          const start = bytes.readUInt32BE(sub + 16 + group * 12);
          const end = bytes.readUInt32BE(sub + 20 + group * 12);
          if (start <= previousEnd || end < start || end > 0x10ffff) {
            throw new Error("Invalid OG cmap character range");
          }
          previousEnd = end;
          characters += end - start + 1;
          if (characters > OG_MAX_CMAP_CHARACTERS) {
            throw new Error("OG cmap exceeds character limit");
          }
        }
      } else if (format === 4) {
        const segments = bytes.readUInt16BE(sub + 6) / 2;
        if (
          !Number.isInteger(segments) ||
          sub + 16 + segments * 8 > offset + length
        ) {
          throw new Error("Invalid OG cmap segments");
        }
        for (let segment = 0; segment < segments; segment += 1) {
          const start = bytes.readUInt16BE(
            sub + 16 + segments * 2 + segment * 2
          );
          const end = bytes.readUInt16BE(sub + 14 + segment * 2);
          if (start <= previousEnd || end < start) {
            throw new Error("Invalid OG cmap character range");
          }
          previousEnd = end;
          characters += end - start + 1;
          if (characters > OG_MAX_CMAP_CHARACTERS) {
            throw new Error("OG cmap exceeds character limit");
          }
        }
      }
    }
  }
}

export async function loadOgFont(
  font: OgTemplate["font"],
  warnings: string[],
  signal?: AbortSignal
) {
  if (font.url) {
    try {
      const prepared = await prepareOgFont(
        (await fetchOgResource(font.url, signal)).bytes,
        font.weight
      );
      return prepared;
    } catch {
      warnings.push(
        `Brand font ${font.family} could not be loaded; using Inter.`
      );
    }
  } else if (!OG_GENERIC_FONT.test(font.family) && font.family !== "Inter") {
    warnings.push(`No downloadable font for ${font.family}; using Inter.`);
  } else if (OG_GENERIC_FONT.test(font.family)) {
    warnings.push(
      `Platform font ${font.family} is rendered with bundled Inter.`
    );
  }
  return Buffer.from(
    await loadRenderFont(font.weight >= 600 ? "Inter:wght@700" : "Inter")
  );
}

export function ogFontCovers(bytes: Buffer, text: string) {
  const font = parse(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  );
  return [...new Set(text)].every(
    (character) =>
      /\s/u.test(character) || font.charToGlyphIndex(character) !== 0
  );
}

export function validateOgGlyphCoverage(
  primary: Buffer,
  fallback: Buffer,
  text: string
) {
  const brand = parse(
    primary.buffer.slice(
      primary.byteOffset,
      primary.byteOffset + primary.byteLength
    )
  );
  const inter = parse(
    fallback.buffer.slice(
      fallback.byteOffset,
      fallback.byteOffset + fallback.byteLength
    )
  );
  const missing = [...new Set(text)].filter(
    (character) =>
      !/\s/u.test(character) &&
      brand.charToGlyphIndex(character) === 0 &&
      inter.charToGlyphIndex(character) === 0
  );
  if (missing.length) {
    throw new Error(
      `Embedded OG fonts do not support these characters: ${missing.slice(0, 12).join("")}`
    );
  }
}
