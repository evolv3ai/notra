// evlog-map-disable -- high-volume, deliberately silent: one event per probe
// or optimized image would only add drain volume
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { optimizeFrameworkImage } =
          await import("../utils/framework-image.server");
        return optimizeFrameworkImage(request);
      },
    },
  },
});
