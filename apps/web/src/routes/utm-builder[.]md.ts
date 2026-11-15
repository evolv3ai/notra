import { createFileRoute } from "@tanstack/react-router";

import { serveUtmBuilderMarkdown } from "@/lib/utm-builder/markdown";

export const Route = createFileRoute("/utm-builder.md")({
  server: {
    handlers: {
      GET: ({ request }) => serveUtmBuilderMarkdown(request),
    },
  },
});
