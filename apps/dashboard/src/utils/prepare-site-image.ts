import "@tanstack/react-start/server-only";
import { SITE_IMAGE_UPLOAD_MAX_EDGE } from "@notra/sites-core/constants/uploads";
import type { SiteImageUploadKind } from "@notra/sites-core/types/uploads";
import { isAnimatedPng } from "@notra/sites-core/utils/is-animated-png";
import { sniffSiteImageExtension } from "@notra/sites-server/utils/image-type";

import {
  SITE_BACKGROUND_WEBP_QUALITY,
  SITE_IMAGE_MAX_INPUT_PIXELS,
} from "@/constants/site-image-upload";
import { sanitizeSvg } from "@/lib/upload/sanitize-svg";

// sharp reports AVIF as heif.
const SCALABLE_FORMATS = new Set(["png", "jpeg", "webp", "heif"]);

const loadSharp = () => import("sharp").then((module) => module.default);

const SHARE_IMAGE_FORMATS = "Share images can be PNG, JPEG, WebP or GIF";

/** The upload is an image this server won't process; safe to show the user. */
export class SiteImageInputError extends Error {}

/**
 * The bytes an upload is stored as: SVGs are sanitized because they run in
 * the site's origin when opened directly, raster images are optimized.
 * Throws SvgSanitizationError or SiteImageInputError for unusable files.
 */
export async function prepareSiteImage(
  bytes: Uint8Array,
  kind: SiteImageUploadKind
): Promise<Uint8Array> {
  if (sniffSiteImageExtension(bytes) !== ".svg") {
    return await optimizeSiteImage(bytes, kind);
  }
  // Link previews don't render SVG.
  if (kind === "share") {
    throw new SiteImageInputError(SHARE_IMAGE_FORMATS);
  }
  const svg = await sanitizeSvg(Buffer.from(bytes).toString("utf8"));
  return Buffer.from(svg, "utf8");
}

/**
 * Scales an upload to the size it's shown at and re-encodes it. Backgrounds
 * become WebP; logos and favicons become PNG or JPEG because share images are
 * rendered from logos and the renderer only reads those. Logos are therefore
 * always converted, animated ones to their first frame. Share images are too,
 * because not every link preview reads WebP, AVIF or animations; they become
 * JPEG unless they're PNG or transparent. Otherwise SVG, ICO, GIF and
 * animated images pass through unchanged.
 */
async function optimizeSiteImage(
  bytes: Uint8Array,
  kind: SiteImageUploadKind
): Promise<Uint8Array> {
  const animatedPng =
    sniffSiteImageExtension(bytes) === ".png" && isAnimatedPng(bytes);
  // Logos and share images are stills.
  const still = kind === "logo" || kind === "share";
  // sharp doesn't report APNG frames. Keep them intact outside the stills.
  if (!still && animatedPng) {
    return bytes;
  }
  const sharp = await loadSharp();
  // Reading the header doesn't decode, so it works past the pixel limit.
  const metadata = await sharp(bytes)
    .metadata()
    .catch(() => null);
  const format = metadata?.format;
  const logo = kind === "logo";
  if (!metadata && logo) {
    throw new SiteImageInputError("Logos can be PNG, JPEG, SVG, WebP or GIF");
  }
  if (!metadata && kind === "share") {
    throw new SiteImageInputError(SHARE_IMAGE_FORMATS);
  }
  if (
    !metadata ||
    !(
      format &&
      (SCALABLE_FORMATS.has(format) || (still && format === "gif"))
    ) ||
    (!still && (metadata.pages ?? 1) > 1)
  ) {
    return bytes;
  }
  if (metadata.width * metadata.height > SITE_IMAGE_MAX_INPUT_PIXELS) {
    throw new SiteImageInputError(
      `Images can be at most ${SITE_IMAGE_MAX_INPUT_PIXELS / 1_000_000} megapixels`
    );
  }
  const edge = SITE_IMAGE_UPLOAD_MAX_EDGE[kind];
  // EXIF orientation is applied, then all metadata (GPS included) is dropped.
  const image = sharp(bytes, { limitInputPixels: SITE_IMAGE_MAX_INPUT_PIXELS })
    .rotate()
    .resize({
      width: edge,
      height: edge,
      fit: "inside",
      withoutEnlargement: true,
    });
  let output = image.png({ compressionLevel: 9, effort: 10 });
  if (kind === "background") {
    output = image.webp({ quality: SITE_BACKGROUND_WEBP_QUALITY, effort: 4 });
  } else if (
    format === "jpeg" ||
    (kind === "share" && format !== "png" && !metadata.hasAlpha)
  ) {
    output = image.jpeg({ mozjpeg: true, quality: 85 });
  }
  const encoded = await output.toBuffer().catch(() => {
    throw new SiteImageInputError("This image couldn't be read");
  });
  // The original is only kept when it already has the target format, the
  // right size and no metadata, and re-encoding wouldn't shrink it.
  const keepable =
    !animatedPng &&
    (metadata.pages ?? 1) === 1 &&
    Math.max(metadata.width, metadata.height) <= edge &&
    !(metadata.exif || metadata.xmp || metadata.iptc) &&
    (kind === "background" || format === "png" || format === "jpeg");
  return keepable && bytes.byteLength <= encoded.byteLength ? bytes : encoded;
}
