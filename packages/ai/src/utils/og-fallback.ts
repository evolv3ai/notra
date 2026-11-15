import type { OgBrandContext, SavedOgTemplate } from "@notra/ai/types/og-image";
import { loadRenderFont } from "@notra/ai/utils/render-font";

/** Deliberately plain: missing evidence must not invent a brand aesthetic. */
export async function fallbackOgTemplate(
  brand: OgBrandContext
): Promise<SavedOgTemplate> {
  return {
    version: 1,
    assets: {},
    warnings: [
      "Brand template unavailable; using a plain typography fallback.",
    ],
    fontBase64: Buffer.from(await loadRenderFont("Inter")).toString("base64"),
    template: {
      background: "#FFFFFF",
      font: { family: "Inter", weight: 400, url: null },
      title: {
        x: 64,
        y: 170,
        width: 1072,
        height: 330,
        color: "#1E1E1E",
        size: 64,
        minSize: 28,
        lineHeight: 1.12,
        letterSpacing: -1.2,
        align: "left",
      },
      layers: [
        {
          kind: "text",
          x: 64,
          y: 54,
          width: 1072,
          height: 60,
          text: brand.name.slice(0, 80),
          color: "#1E1E1E",
          size: 24,
          align: "left",
        },
        {
          kind: "text",
          x: 64,
          y: 530,
          width: 1072,
          height: 68,
          text: "{{domain}}",
          color: "#666666",
          size: 16,
          align: "left",
        },
      ],
    },
  };
}
