import {
  QR_CODE_LOGO_HOSTS,
  QR_CODE_LOGO_TIMEOUT_MS,
  QR_CODE_MAX_LOGO_BYTES,
} from "@/constants/qr-code";
import type { QrLogoLoad } from "@/types/qr-code";

const IMAGE_TYPE_REGEX = /^image\/(png|jpeg|gif|webp|svg\+xml)$/;
const TOO_LARGE_ERROR = "The logo is over 500 KB.";

function toDataUrl(type: string, bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return `data:${type};base64,${btoa(binary)}`;
}

function parseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

async function readCapped(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    size += value.length;
    if (size > QR_CODE_MAX_LOGO_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

export function logoUrlIssue(value: string) {
  const url = parseUrl(value);
  if (!url || url.protocol !== "https:") {
    return "The logo has to be an https link.";
  }
  if (!QR_CODE_LOGO_HOSTS.includes(url.hostname)) {
    return `Host the logo on Imgur and use its direct link (${QR_CODE_LOGO_HOSTS.join(", ")}).`;
  }
  return null;
}

export async function loadLogoFromUrl(value: string): Promise<QrLogoLoad> {
  if (!value) {
    return { logo: null, error: null };
  }
  const issue = logoUrlIssue(value);
  if (issue) {
    return { logo: null, error: issue };
  }
  const loadError = {
    logo: null,
    error: "Could not load the logo from that link.",
  };
  const response = await fetch(value, {
    redirect: "error",
    signal: AbortSignal.timeout(QR_CODE_LOGO_TIMEOUT_MS),
  }).catch(() => null);
  if (!(response?.ok && response.body)) {
    return loadError;
  }
  if (Number(response.headers.get("content-length")) > QR_CODE_MAX_LOGO_BYTES) {
    return { logo: null, error: TOO_LARGE_ERROR };
  }
  const type = response.headers.get("content-type")?.split(";")[0] ?? "";
  if (!IMAGE_TYPE_REGEX.test(type)) {
    return {
      logo: null,
      error: "The logo link has to point at a PNG, JPG, GIF, WebP or SVG.",
    };
  }
  const bytes = await readCapped(response.body).catch(() => undefined);
  if (bytes === undefined) {
    return loadError;
  }
  if (!bytes) {
    return { logo: null, error: TOO_LARGE_ERROR };
  }
  return {
    logo: { name: value, src: toDataUrl(type, bytes) },
    error: null,
  };
}
