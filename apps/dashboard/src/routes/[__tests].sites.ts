import { createFileRoute } from "@tanstack/react-router";

import { dispatchRouteHandler } from "@/lib/auth/route-handler";
import { isSitesTestRequestAllowed } from "@/utils/sites-test-access";

export const Route = createFileRoute("/__tests/sites")({
  server: {
    handlers: {
      ANY: async ({ request, params }) => {
        if (!isSitesTestRequestAllowed(request)) {
          return new Response(null, { status: 404 });
        }
        const handlers = await import("@/app/__tests/sites/route");
        return dispatchRouteHandler(handlers, request, params);
      },
    },
  },
});
