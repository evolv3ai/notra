import { QRCodeSVG } from "qrcode.react";
import { renderToStaticMarkup } from "react-dom/server";

import { QR_CODE_PNG_SIZE } from "@/constants/qr-code";
import { effectiveLevel, qrCodeIssue, qrCodeProps } from "@/lib/qr-code/build";
import { loadLogoFromUrl } from "@/lib/qr-code/logo";
import type { QrCodeState } from "@/types/qr-code";

function issueResponse(issue: string) {
  return new Response(`${issue}\n`, {
    status: 422,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function serveQrCodeSvg(state: QrCodeState) {
  const issue = qrCodeIssue(
    state.text,
    effectiveLevel(state.level, Boolean(state.logo))
  );
  if (issue) {
    return issueResponse(issue);
  }
  const { logo, error } = await loadLogoFromUrl(state.logo);
  if (error) {
    return issueResponse(error);
  }
  return new Response(
    renderToStaticMarkup(
      <QRCodeSVG {...qrCodeProps(state, QR_CODE_PNG_SIZE, logo)} />
    ),
    {
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "public, max-age=86400",
        "access-control-allow-origin": "*",
      },
    }
  );
}
