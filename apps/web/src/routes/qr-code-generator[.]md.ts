import { createFileRoute } from "@tanstack/react-router";

import { serveQrCodeMarkdown } from "@/lib/qr-code/markdown";

export const Route = createFileRoute("/qr-code-generator.md")({
  server: {
    handlers: {
      GET: ({ request }) => serveQrCodeMarkdown(request),
    },
  },
});
