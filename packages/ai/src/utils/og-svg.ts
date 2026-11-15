import { OG_HEX_COLOR } from "@notra/ai/constants/og-image";

/** Recolor only explicitly painted, single-color SVGs, never masks or multicolor artwork. */
export function recolorOgSvg(svg: string, color?: string | null) {
  if (
    !color ||
    !OG_HEX_COLOR.test(color) ||
    /<(?:mask|linearGradient|radialGradient|pattern)\b/i.test(svg)
  ) {
    return svg;
  }
  const shapes =
    svg.match(
      /<(?:path|rect|circle|ellipse|polygon|polyline|line)\b[^>]*>/gi
    ) ?? [];
  if (
    !shapes.length ||
    shapes.some((shape) => !/\bfill="[^"]+"/i.test(shape))
  ) {
    return svg;
  }
  const paints = new Set(
    [...svg.matchAll(/\b(?:fill|stroke)="([^"]+)"/gi)]
      .map((match) => match[1]?.toLowerCase())
      .filter(
        (paint) =>
          paint && !["none", "transparent", "currentcolor"].includes(paint)
      )
  );
  const paint = [...paints][0];
  if (paints.size !== 1 || !paint || !OG_HEX_COLOR.test(paint)) {
    return svg;
  }
  return svg.replace(
    /\b(fill|stroke)="(#[0-9a-f]{6})"/gi,
    (_match, attribute: string, value: string) =>
      `${attribute}="${value.toLowerCase() === paint ? color : value}"`
  );
}
