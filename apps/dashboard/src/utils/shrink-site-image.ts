import {
  SITE_IMAGE_UPLOAD_MAX_BYTES,
  SITE_IMAGE_UPLOAD_MAX_EDGE,
} from "@notra/sites-core/constants/uploads";
import type { SiteImageUploadKind } from "@notra/sites-core/types/uploads";
import { isAnimatedPng } from "@notra/sites-core/utils/is-animated-png";

import {
  SITE_IMAGE_MAX_INPUT_PIXELS,
  SITE_IMAGE_PREUPLOAD_WEBP_QUALITY,
  SITE_IMAGE_SHRINK_TYPES,
} from "@/constants/site-image-upload";

const SCALABLE = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
]);

/** Whether any pixel on the canvas isn't fully opaque. */
function hasTransparency(context: CanvasRenderingContext2D) {
  const { data } = context.getImageData(
    0,
    0,
    context.canvas.width,
    context.canvas.height
  );
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] !== 255) {
      return true;
    }
  }
  return false;
}

function encode(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, SITE_IMAGE_PREUPLOAD_WEBP_QUALITY)
  );
}

/**
 * Whether the file has more than one frame. A canvas keeps only the first, so
 * those are sent as they are and rejected if still too large.
 */
async function isAnimated(file: File): Promise<boolean> {
  if (file.type === "image/png") {
    return isAnimatedPng(new Uint8Array(await file.arrayBuffer()));
  }
  const head = new Uint8Array(await file.slice(0, 64 * 1024).arrayBuffer());
  const text = new TextDecoder("latin1").decode(head);
  if (file.type === "image/webp") {
    // VP8X header with the animation flag.
    return text.slice(12, 16) === "VP8X" && ((head[20] ?? 0) & 0x02) !== 0;
  }
  if (file.type === "image/avif") {
    // Image sequences declare the "avis" brand in the ftyp box.
    return text.slice(0, 64).includes("avis");
  }
  return false;
}

/**
 * Scales images too large to upload or for the server to decode down to their
 * display size first; the server still encodes the final file. Everything
 * else, animations included, is sent untouched.
 */
export async function shrinkSiteImage(
  file: File,
  kind: SiteImageUploadKind
): Promise<File> {
  if (!SCALABLE.has(file.type) || (await isAnimated(file))) {
    return file;
  }
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    return file;
  }
  const edge = SITE_IMAGE_UPLOAD_MAX_EDGE[kind];
  if (
    file.size <= SITE_IMAGE_UPLOAD_MAX_BYTES &&
    bitmap.width * bitmap.height <= SITE_IMAGE_MAX_INPUT_PIXELS
  ) {
    bitmap.close();
    return file;
  }
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  context?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  // JPEG drops transparency, so transparent share images stay PNG.
  const type =
    kind === "share" && context && hasTransparency(context)
      ? "image/png"
      : SITE_IMAGE_SHRINK_TYPES[kind];
  // Safari can't encode WebP and hands back PNG, which is too large for
  // photos, so backgrounds fall back to JPEG.
  let blob = await encode(canvas, type);
  if (kind === "background" && blob?.type !== "image/webp") {
    blob = await encode(canvas, "image/jpeg");
  }
  return blob ? new File([blob], file.name, { type: blob.type }) : file;
}
