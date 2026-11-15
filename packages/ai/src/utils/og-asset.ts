import { OG_IMAGE_WIDTH } from "@notra/ai/constants/og-image";
import type {
  OgAssetCrop,
  OgAssetTarget,
  OgTemplate,
  OgBrandContext,
} from "@notra/ai/types/og-image";
import { fetchOgResource } from "@notra/ai/utils/og-fetch";
import { recolorOgSvg } from "@notra/ai/utils/og-svg";
import sanitizeHtml from "sanitize-html";
import sharp from "sharp";

export function validateOgArtworkSources(
  template: OgTemplate,
  sources: OgBrandContext["assets"]
) {
  const sourcesById = new Map(sources.map((asset) => [asset.id, asset]));
  for (const layer of template.layers) {
    if (layer.kind !== "image") {
      continue;
    }
    const source = sourcesById.get(layer.assetId);
    if (
      source &&
      /wordmark/i.test(`${source.label} ${source.url}`) &&
      (layer.crop || layer.fit !== "contain")
    ) {
      throw new Error(
        "Standalone wordmark assets must be shown whole: crop=null and fit=contain. Do not truncate letters or stretch them into texture."
      );
    }
  }
  const hasOriginalArt = template.layers.some(
    (layer) =>
      layer.kind === "image" &&
      sources.some(
        (source) =>
          source.id === layer.assetId &&
          ((source.id === "og-reference" && Boolean(layer.crop)) ||
            (/wordmark/i.test(`${source.label} ${source.url}`) &&
              layer.width >= OG_IMAGE_WIDTH / 2 &&
              !layer.crop &&
              layer.fit === "contain") ||
            (layer.decorative === true &&
              !/^(?:Official )?(?:logo|icon|wordmark)\b/i.test(source.label)))
      )
  );
  if (
    template.layers.some((layer) => layer.kind === "artwork") &&
    !hasOriginalArt
  ) {
    throw new Error(
      "Remove the procedural artwork layers, or supplement a real original decorative asset: a text-free og-reference crop, complete oversized wordmark (crop=null, fit=contain), or original illustration. A small primary logo alone does not qualify. Do not retry the same SVG-only decoration."
    );
  }
  const selected = template.layers.flatMap((layer) =>
    layer.kind === "image"
      ? sources.filter((source) => source.id === layer.assetId)
      : []
  );
  if (
    sources.some((source) =>
      /^Official (?:logo|wordmark)\b/i.test(source.label)
    ) &&
    selected.some((source) => /^Official icon\b/i.test(source.label)) &&
    !selected.some((source) =>
      /^Official (?:logo|wordmark)\b|wordmark/i.test(source.label)
    ) &&
    !template.layers.some(
      (layer) => layer.kind === "text" && layer.text === "{{brandName}}"
    )
  ) {
    throw new Error(
      "Use the available full wordmark, or put {{brandName}} beside the official icon. Do not leave icon-only branding when a wordmark is available."
    );
  }
}

export async function encodeOgPngAsset(png: Buffer) {
  const compact =
    png.length > 2_100_000
      ? await sharp(png)
          .timeout({ seconds: 10 })
          .png({ palette: true, colors: 256 })
          .toBuffer()
      : png;
  const uri = `data:image/png;base64,${compact.toString("base64")}`;
  if (uri.length > 3_000_000) {
    throw new Error(
      "Decorative asset is too large after compression; choose a smaller or simpler text-free crop"
    );
  }
  return uri;
}

/** Smaller model-only previews; full-resolution assets remain in the saved design. */
export async function createOgAssetPreview(
  data: string,
  bounds: Pick<OgAssetTarget, "width" | "height">
) {
  const png = await sharp(Buffer.from(data.split(",")[1] ?? "", "base64"), {
    limitInputPixels: 16_000_000,
  })
    .timeout({ seconds: 10 })
    .resize({ ...bounds, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  return encodeOgPngAsset(png);
}

/** Untrusted decorative SVG never reaches the renderer as markup. */
export async function renderOgArtwork(svg: string) {
  if (Buffer.byteLength(svg) > 24_000) {
    throw new Error("OG artwork exceeds size limit");
  }
  const png = await sharp(Buffer.from(sanitizeOgSvg(svg)), {
    limitInputPixels: 16_000_000,
  })
    .timeout({ seconds: 10 })
    .resize({ width: 1200, height: 630, fit: "inside" })
    .png()
    .toBuffer();
  return encodeOgPngAsset(png);
}

/** SVGs are rasterized only after removing scripts, CSS and external references. */
export async function loadOgAsset(
  url: string,
  crop?: OgAssetCrop | null,
  color?: string | null,
  target?: OgAssetTarget,
  signal?: AbortSignal
) {
  const { bytes, contentType } = await fetchOgResource(url, signal);
  signal?.throwIfAborted();
  let source = bytes;
  const isSvg =
    contentType.includes("svg") ||
    /<(?:[\w.-]+:)?svg[\s>]/i.test(bytes.toString("utf8"));
  if (isSvg) {
    const svg = sanitizeOgSvg(bytes.toString("utf8"), color);
    source = Buffer.from(svg);
  }
  let pipeline = sharp(source, {
    limitInputPixels: 16_000_000,
    animated: false,
  }).timeout({ seconds: 10 });
  const metadata = await pipeline.metadata();
  if (metadata.format === "svg" && !isSvg) {
    throw new Error("Unrecognized SVG payload cannot be rasterized safely");
  }
  if (target && metadata.width && metadata.height) {
    validateOgAssetSize(
      metadata.width * (crop?.width ?? 1),
      metadata.height * (crop?.height ?? 1),
      target
    );
  }
  if (crop) {
    if (crop.left + crop.width > 1 || crop.top + crop.height > 1) {
      throw new Error("OG asset crop exceeds its source image");
    }
    if (!metadata.width || !metadata.height) {
      throw new Error("OG asset dimensions unavailable");
    }
    pipeline = pipeline.extract({
      left: Math.floor(crop.left * metadata.width),
      top: Math.floor(crop.top * metadata.height),
      width: Math.max(1, Math.floor(crop.width * metadata.width)),
      height: Math.max(1, Math.floor(crop.height * metadata.height)),
    });
  }
  const png = await pipeline
    .resize({
      width: 1200,
      height: 630,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
  return encodeOgPngAsset(png);
}

/** Check the pixels actually embedded after the bounded asset resize. */
export function validateOgAssetSize(
  width: number,
  height: number,
  target: OgAssetTarget
) {
  const resizeScale = Math.min(1200 / width, 630 / height, 1);
  const scales = [
    target.width / (width * resizeScale),
    target.height / (height * resizeScale),
  ];
  // Fill deliberately stretches diffuse decorative strips; cover must fill both axes.
  const enlargement =
    target.fit === "cover" ? Math.max(...scales) : Math.min(...scales);
  if (enlargement > (target.decorative ? 4 : 1.25)) {
    throw new Error(
      `Asset is only ${Math.round(width * resizeScale)}x${Math.round(height * resizeScale)} pixels; choose a higher-resolution source, a smaller box, or omit this image`
    );
  }
}

export function sanitizeOgSvg(source: string, color?: string | null) {
  const patterned = /<pattern\b/i.test(source);
  if (
    patterned &&
    (/\b(?:patternTransform|transform)\s*=/i.test(source) ||
      (source.match(/<svg\b/gi)?.length ?? 0) > 1)
  ) {
    throw new Error("Patterned SVGs cannot use transforms or nested viewports");
  }
  let patternScale = 1;
  const sanitized = sanitizeHtml(source, {
    nonTextTags: [
      "script",
      "style",
      "textarea",
      "option",
      "text",
      "foreignObject",
    ],
    allowedTags: [
      "svg",
      "g",
      "path",
      "rect",
      "circle",
      "ellipse",
      "line",
      "polyline",
      "polygon",
      "defs",
      "pattern",
      "linearGradient",
      "radialGradient",
      "stop",
      "clipPath",
      "mask",
    ],
    allowedAttributes: {
      "*": [
        "xmlns",
        "color",
        "viewBox",
        "width",
        "height",
        "d",
        "x",
        "y",
        "x1",
        "x2",
        "y1",
        "y2",
        "cx",
        "cy",
        "r",
        "rx",
        "ry",
        "points",
        "fill",
        "fill-rule",
        "fill-opacity",
        "stroke",
        "stroke-width",
        "stroke-linecap",
        "stroke-linejoin",
        "opacity",
        "transform",
        "id",
        "offset",
        "stop-color",
        "stop-opacity",
        "clip-path",
        "mask",
        "gradientUnits",
        "gradientTransform",
        "patternUnits",
        "patternContentUnits",
        "patternTransform",
        "maskUnits",
        "preserveAspectRatio",
      ],
    },
    parser: { lowerCaseAttributeNames: false, lowerCaseTags: false },
    transformTags: {
      "*": (tagName, attributes) => {
        if (
          tagName === "pattern" &&
          (attributes.patternUnits !== "userSpaceOnUse" ||
            ![attributes.width, attributes.height].every(
              (value) =>
                Number.isFinite(Number(value)) &&
                Number(value) * patternScale >= 2 &&
                Number(value) <= 1200
            ))
        ) {
          throw new Error(
            "SVG patterns require userSpaceOnUse and numeric tile dimensions between 2 and 1200 pixels"
          );
        }
        // Freeze known hidden animation states before dropping all classes.
        // Otherwise an opacity-0 overlay becomes opaque and masks the logo.
        if (
          attributes.class
            ?.split(/\s+/)
            .some((value) =>
              ["opacity-0", "hidden", "invisible"].includes(value)
            )
        ) {
          attributes.opacity = "0";
        }
        if (tagName === "svg") {
          const viewBox = attributes.viewBox
            ?.trim()
            .split(/[\s,]+/)
            .map(Number);
          if (
            viewBox?.length === 4 &&
            viewBox.every(Number.isFinite) &&
            (viewBox[2] ?? 0) > 0 &&
            (viewBox[3] ?? 0) > 0
          ) {
            const scale = 1200 / Math.max(viewBox[2] ?? 1, viewBox[3] ?? 1);
            patternScale = scale;
            attributes.width = String(
              Math.max(1, Math.round((viewBox[2] ?? 1) * scale))
            );
            attributes.height = String(
              Math.max(1, Math.round((viewBox[3] ?? 1) * scale))
            );
          }
          attributes.color =
            color && /^#[0-9a-f]{6}$/i.test(color) ? color : "#000000";
        }
        return {
          tagName,
          attribs: Object.fromEntries(
            Object.entries(attributes).filter(
              ([, value]) =>
                !/\\|\/\*|url\(\s*[^#]|(?:https?:|file:|data:|var\()/i.test(
                  value
                )
            )
          ),
        };
      },
    },
  });
  return recolorOgSvg(sanitized, color);
}
