import { createFileRoute } from "@tanstack/react-router";
import { createLoader } from "nuqs/server";

import { serveQrCodeSvg } from "@/lib/qr-code/svg";
import { qrCodeParsers } from "@/schemas/qr-code";

const loadQrCodeState = createLoader(qrCodeParsers);

export const Route = createFileRoute("/api/qr-code")({
  server: {
    handlers: {
      GET: ({ request }) => serveQrCodeSvg(loadQrCodeState(request.url)),
    },
  },
});
