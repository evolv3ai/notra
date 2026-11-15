import { createHash } from "node:crypto";

import { SVG_START } from "../constants/image-type";

function startsWith(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((byte, index) => bytes[index] === byte);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

/** File extension from the image's magic bytes, ignoring the uploaded name and MIME type. */
export function sniffSiteImageExtension(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return ".png";
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return ".jpg";
  }
  if (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a") {
    return ".gif";
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    return ".webp";
  }
  if (
    ascii(bytes, 4, 8) === "ftyp" &&
    ["avif", "avis"].includes(ascii(bytes, 8, 12))
  ) {
    return ".avif";
  }
  if (startsWith(bytes, [0x00, 0x00, 0x01, 0x00]) && bytes.length > 6) {
    return ".ico";
  }
  const head = new TextDecoder().decode(bytes.subarray(0, 4096));
  return SVG_START.test(head.replace(/^﻿/, "")) ? ".svg" : null;
}

/** The SHA GitHub assigns a blob with these bytes. */
export function gitBlobSha(bytes: Uint8Array): string {
  return createHash("sha1")
    .update(`blob ${bytes.byteLength}\0`)
    .update(bytes)
    .digest("hex");
}
