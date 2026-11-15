import { createLoader } from "nuqs/server";

import {
  QR_CODE_AGENT_PROMPT,
  QR_CODE_DEFAULT_BG,
  QR_CODE_DEFAULT_FG,
  QR_CODE_DEFAULT_MARGIN,
  QR_CODE_LOGO_HOSTS,
  QR_CODE_MARKDOWN_URL,
  QR_CODE_MAX_MARGIN,
  QR_CODE_PNG_SIZE,
  QR_CODE_SVG_URL,
  QR_CODE_TITLE,
  QR_CODE_URL,
  QR_ERROR_LEVELS,
} from "@/constants/qr-code";
import { effectiveLevel, qrCodeIssue } from "@/lib/qr-code/build";
import { logoUrlIssue } from "@/lib/qr-code/logo";
import { serializeQrCode, qrCodeParsers } from "@/schemas/qr-code";
import type { QrCodeState } from "@/types/qr-code";
import { markdownResponse } from "@/utils/http";
import { markdownSection } from "@/utils/markdown";
import { SITE_URL } from "@/utils/urls";

const loadQrCodeState = createLoader(qrCodeParsers);

function resultLines(state: QrCodeState, issue: string | null) {
  if (issue) {
    return [`**Error:** ${issue}`];
  }
  const svgUrl = serializeQrCode(QR_CODE_SVG_URL, state);
  return [
    `![QR code](${svgUrl})`,
    "",
    "SVG:",
    "",
    "```text",
    svgUrl,
    "```",
    "",
    `Open in the generator: ${serializeQrCode(QR_CODE_URL, state)}`,
  ];
}

function buildQrCodeMarkdown(state: QrCodeState) {
  const issue = state.text
    ? (qrCodeIssue(
        state.text,
        effectiveLevel(state.level, Boolean(state.logo))
      ) ?? (state.logo ? logoUrlIssue(state.logo) : null))
    : null;
  const markdown = [
    `# ${QR_CODE_TITLE}`,
    "",
    "Make a QR code for any link or text. The code encodes exactly what you send, with no redirect, no tracking and no expiry. No key, no sign-up, nothing is stored.",
    "",
    ...(state.text
      ? [markdownSection("Result", resultLines(state, issue))]
      : []),
    markdownSection("How to call it", [
      `GET \`${QR_CODE_SVG_URL}?text=https%3A%2F%2Fexample.com\``,
      "",
      `Returns the QR code as \`image/svg+xml\`, ${QR_CODE_PNG_SIZE}px wide. Text that does not fit comes back as plain text with status 422.`,
      "",
      `GET \`${QR_CODE_MARKDOWN_URL}?text=https%3A%2F%2Fexample.com\` returns this page with the SVG link filled in. The same query on \`${QR_CODE_URL}\` opens the generator for a person to check, add a logo and download a PNG.`,
      "",
      "URL-encode the `text` value, otherwise its own `?`, `&` and `#` are read as parameters.",
    ]),
    markdownSection("Parameters", [
      "| Query key | Need | What it is |",
      "| --- | --- | --- |",
      "| `text` | Required | The link or text to encode. |",
      `| \`level\` | Optional | Error correction: ${QR_ERROR_LEVELS.map((level) => `\`${level.id}\` (${level.recovery}, up to ${level.maxBytes} bytes)`).join(", ")}. Default \`M\`. |`,
      `| \`fg\` | Optional | Module colour as 6-digit hex without \`#\`. Default \`${QR_CODE_DEFAULT_FG}\`. |`,
      `| \`bg\` | Optional | Background colour as 6-digit hex without \`#\`. Default \`${QR_CODE_DEFAULT_BG}\`. |`,
      `| \`margin\` | Optional | Quiet zone around the code in modules, 0 to ${QR_CODE_MAX_MARGIN}. Default \`${QR_CODE_DEFAULT_MARGIN}\`. |`,
      `| \`logo\` | Optional | Direct link to an image for the middle of the code, hosted on ${QR_CODE_LOGO_HOSTS.join(" or ")}. Upload it to Imgur first. PNG, JPG, GIF, WebP or SVG up to 500 KB. Forces error correction \`H\` so the code still scans. |`,
    ]),
    markdownSection("Prompt for your agent", [
      "Add this to your agent's instructions so it makes QR codes here:",
      "",
      "```text",
      QR_CODE_AGENT_PROMPT,
      "```",
    ]),
    markdownSection("Tips for codes that scan", [
      "- Keep dark modules on a light background with strong contrast. Many scanners fail on inverted or low-contrast codes.",
      "- Leave a margin of at least 2 modules, 4 if the code sits on a busy background.",
      "- Shorter text means bigger modules, which scan from further away.",
      `- Tag marketing links with UTM parameters first so scans show up as their own source: ${SITE_URL}/utm-builder.md`,
    ]),
  ].join("\n");
  return { markdown, issue };
}

export function serveQrCodeMarkdown(request: Request) {
  const { markdown, issue } = buildQrCodeMarkdown(loadQrCodeState(request.url));
  return markdownResponse(markdown, issue ? 422 : 200);
}
