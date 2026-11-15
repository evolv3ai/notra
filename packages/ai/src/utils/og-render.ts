import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  OG_TITLE_LINE_LIMITS,
  OG_WIDE_TITLE_MIN_WIDTH,
} from "@notra/ai/constants/og-image";
import type {
  OgBrandContext,
  OgRenderBounds,
  OgTemplate,
  SavedOgTemplate,
} from "@notra/ai/types/og-image";
import { validateOgGlyphCoverage } from "@notra/ai/utils/og-font";
import { parseOgWebsiteUrl } from "@notra/ai/utils/og-website";
import { loadRenderFont } from "@notra/ai/utils/render-font";
import { createElement as h } from "react";

export function validateOgLayout(template: OgTemplate) {
  const { title } = template;
  if (template.layers.filter((layer) => layer.kind === "image").length > 4) {
    throw new Error("Use at most four OG image assets");
  }
  if (
    title.x < 32 ||
    title.y < 32 ||
    title.x + title.width > 1168 ||
    title.y + title.height > 598 ||
    title.size < title.minSize
  ) {
    throw new Error("Title must fit the 32px safe area");
  }
  for (const [index, layer] of template.layers.entries()) {
    if (layer.kind === "image" && layer.fit === "fill" && !layer.decorative) {
      throw new Error(
        "Only text-free decorative backgrounds may use fill; logos and illustrations must preserve their aspect ratio"
      );
    }
    if (
      layer.x + layer.width > OG_IMAGE_WIDTH ||
      layer.y + layer.height > OG_IMAGE_HEIGHT
    ) {
      throw new Error("Layer exceeds the canvas");
    }
    if (
      layer.kind !== "rect" &&
      !(
        (layer.kind === "artwork" ||
          (layer.kind === "image" && layer.decorative)) &&
        layer.height >= OG_IMAGE_HEIGHT * 0.75
      ) &&
      layer.x < title.x + title.width + 16 &&
      layer.x + layer.width > title.x - 16 &&
      layer.y < title.y + title.height + 16 &&
      layer.y + layer.height > title.y - 16
    ) {
      throw new Error(
        `Layer ${index} (${layer.kind}, x=${layer.x}, y=${layer.y}, width=${layer.width}, height=${layer.height}) overlaps the title safe area (x=${title.x}, y=${title.y}, width=${title.width}, height=${title.height}). Keep a 16px gap around the entire title rectangle. Only full-height background treatments may sit behind it; move decorative panels and footers outside the safe area.`
      );
    }
  }
}

export async function renderOgImage(
  document: SavedOgTemplate,
  title: string,
  brand: Pick<OgBrandContext, "name" | "websiteUrl">
) {
  const template = document.template;
  validateOgLayout(template);
  const area = template.title;
  if (
    area.width < area.size * 2 ||
    template.layers.some(
      (layer) => layer.kind === "text" && layer.width < layer.size * 2
    )
  ) {
    throw new Error("Text panel is too narrow to render safely");
  }
  const domain =
    parseOgWebsiteUrl(brand.websiteUrl)?.hostname.replace(/^www\./, "") ?? "";
  const lineLimit = OG_TITLE_LINE_LIMITS.find(
    (limit) => title.length <= limit.maxCharacters
  );
  const maxLines =
    lineLimit?.[area.width >= OG_WIDE_TITLE_MIN_WIDTH ? "wide" : "split"];
  const font = Buffer.from(document.fontBase64, "base64");
  const fallbackFont = Buffer.from(
    await loadRenderFont(
      template.font.weight >= 600 ? "Inter:wght@700" : "Inter"
    )
  );
  const labels = template.layers.flatMap((layer) =>
    layer.kind === "text"
      ? [
          layer.text
            .replaceAll("{{brandName}}", brand.name)
            .replaceAll("{{domain}}", domain),
        ]
      : []
  );
  validateOgGlyphCoverage(font, fallbackFont, [title, ...labels].join(" "));
  const [{ default: satori }, { Resvg }] = await Promise.all([
    import("satori"),
    import("@resvg/resvg-js"),
  ]);
  const renderAt = async (size: number, decorations: boolean) => {
    let titleBounds: OgRenderBounds | undefined;
    let labelOverflow = false;
    const svg = await satori(
      h(
        "div",
        {
          style: {
            display: "flex",
            position: "relative",
            width: 1200,
            height: 630,
            backgroundColor: template.background,
            fontFamily: "Brand, Inter",
            fontWeight: template.font.weight,
          },
        },
        ...template.layers.map((layer, index) => {
          if (!decorations && layer.kind !== "text") {
            return null;
          }
          const style = {
            position: "absolute" as const,
            left: layer.x,
            top: layer.y,
            width: layer.width,
            height: layer.height,
          };
          if (layer.kind === "image" || layer.kind === "artwork") {
            const asset =
              document.assets[
                layer.kind === "artwork" ? `artwork-${index}` : layer.assetId
              ];
            return asset
              ? h("img", {
                  key: index,
                  src: asset,
                  width: layer.width,
                  height: layer.height,
                  style: {
                    ...style,
                    objectFit: layer.kind === "artwork" ? "fill" : layer.fit,
                    opacity: layer.opacity,
                  },
                })
              : null;
          }
          if (layer.kind === "rect") {
            return h("div", {
              key: index,
              style: {
                ...style,
                display: "flex",
                backgroundColor: layer.color,
                borderRadius: layer.radius,
                opacity: layer.opacity,
              },
            });
          }
          const text = layer.text
            .replaceAll("{{brandName}}", brand.name)
            .replaceAll("{{domain}}", domain);
          return h(
            "div",
            {
              key: index,
              style: {
                ...style,
                display: "flex",
                color: layer.color,
                fontSize: layer.size,
                lineHeight: 1.1,
                textAlign: layer.align,
              },
            },
            h(
              "div",
              {
                "data-label": true,
                "data-max-height": layer.height,
                style: {
                  display: "flex",
                  width: layer.width,
                  flexShrink: 0,
                  wordBreak: "break-word",
                },
              },
              text
            )
          );
        }),
        h(
          "div",
          {
            style: {
              display: "flex",
              position: "absolute",
              left: area.x,
              top: area.y,
              width: area.width,
              height: area.height,
              alignItems: "center",
            },
          },
          h(
            "div",
            {
              "data-title": true,
              style: {
                display: "flex",
                width: area.width,
                flexShrink: 0,
                fontSize: size,
                color: area.color,
                lineHeight: area.lineHeight,
                letterSpacing: area.letterSpacing,
                textAlign: area.align,
                textWrap: "balance",
                wordBreak: "break-word",
              },
            },
            title
          )
        )
      ),
      {
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        fonts: [
          {
            name: "Brand",
            data: font,
            weight: template.font.weight,
            style: "normal",
          },
          {
            name: "Inter",
            data: fallbackFont,
            weight: template.font.weight,
            style: "normal",
          },
        ],
        onNodeDetected: (node) => {
          if (node.props["data-title"]) {
            titleBounds = node;
          }
          if (
            node.props["data-label"] &&
            node.height > Number(node.props["data-max-height"]) + 1
          ) {
            labelOverflow = true;
          }
        },
      }
    );
    return { svg, titleBounds, labelOverflow };
  };
  for (let size = area.size; size >= area.minSize; size -= 2) {
    const { titleBounds, labelOverflow } = await renderAt(size, false);
    if (labelOverflow) {
      throw new Error(
        "Brand/domain label does not fit its configured rectangle"
      );
    }
    if (
      !titleBounds ||
      titleBounds.height > area.height + 1 ||
      titleBounds.top < area.y - 1 ||
      titleBounds.top + titleBounds.height > area.y + area.height + 1
    ) {
      continue;
    }
    const lineCount = Math.round(titleBounds.height / (size * area.lineHeight));
    if (maxLines && lineCount > maxLines && size - 2 >= area.minSize) {
      continue;
    }
    const { svg } = await renderAt(size, true);
    return {
      svg,
      pngBase64: new Resvg(svg).render().asPng().toString("base64"),
      fontSize: size,
      lineCount,
    };
  }
  throw new Error("Full title does not fit the OG template");
}
