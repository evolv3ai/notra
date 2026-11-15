// evlog-map-disable -- crawler probe, static body
import { createFileRoute } from "@tanstack/react-router";

import { dispatchRouteHandler } from "@/lib/auth/route-handler";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      ANY: async ({ request, params }) => {
        const handlers = await import("@/app/robots.txt/route");
        return dispatchRouteHandler(handlers, request, params);
      },
    },
  },
});
