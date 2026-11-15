import type { QRCodeSVG } from "qrcode.react";
import type { ComponentProps } from "react";

import {
  QR_CODE_LOGO_SCALE,
  QR_CODE_MAX_MARGIN,
  QR_ERROR_LEVELS,
} from "@/constants/qr-code";
import type { QrCodeLogo, QrCodeState, QrErrorLevel } from "@/types/qr-code";

export function effectiveLevel(
  level: QrErrorLevel,
  hasLogo: boolean
): QrErrorLevel {
  return hasLogo ? "H" : level;
}

export function qrCodeIssue(text: string, level: QrErrorLevel) {
  if (!text) {
    return "Add a link or some text to encode.";
  }
  const maxBytes =
    QR_ERROR_LEVELS.find((candidate) => candidate.id === level)?.maxBytes ?? 0;
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > maxBytes) {
    return `That is ${bytes} bytes. A QR code at error correction ${level} holds at most ${maxBytes}. Shorten the text or lower the error correction.`;
  }
  return null;
}

export function qrCodeProps(
  state: QrCodeState,
  size: number,
  logo: QrCodeLogo | null = null
): ComponentProps<typeof QRCodeSVG> {
  const logoSize = Math.round(size * QR_CODE_LOGO_SCALE);
  return {
    value: state.text,
    size,
    level: effectiveLevel(state.level, Boolean(logo)),
    fgColor: `#${state.fg}`,
    bgColor: `#${state.bg}`,
    marginSize: Math.min(Math.max(state.margin, 0), QR_CODE_MAX_MARGIN),
    title: `QR code for ${state.text}`,
    xmlns: "http://www.w3.org/2000/svg",
    imageSettings: logo
      ? { src: logo.src, width: logoSize, height: logoSize, excavate: true }
      : undefined,
  };
}
