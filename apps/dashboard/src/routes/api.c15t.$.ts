import { createFileRoute } from "@tanstack/react-router";

import { dispatchRouteHandler } from "@/lib/auth/route-handler";
import { requestLogMiddleware } from "@/middleware/request-log";

export const Route = createFileRoute("/api/c15t/$")({
  server: {
    middleware: [requestLogMiddleware],
    handlers: {
      ANY: async (ctx) => {
        const { log } = ctx.context;
        log.set({ routeId: "/api/c15t/$" });
        const handlers = await import("@/app/api/c15t/[...all]/route");
        return dispatchRouteHandler(handlers, ctx.request, {
          ...ctx.params,
          all: ctx.params._splat?.split("/"),
        });
      },
    },
  },
});
