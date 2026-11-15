import { isDemoMode } from "@notra/utils/demo-mode";

import { DASHBOARD_SECURITY_HEADERS } from "../constants/framework";
import { IMAGE_SECURITY_HEADERS } from "../constants/framework-image";
import { getDashboardSecurityHeaders } from "./framework-request";

export function getDashboardHeaderRouting(
  vercel: boolean,
  demo = isDemoMode()
) {
  const headers = getDashboardSecurityHeaders(demo);
  const routeRules: Record<
    string,
    { headers: Record<string, string> | false }
  > = vercel
    ? {}
    : {
        "/**": { headers },
        // Header rules apply last; embed pages get theirs from the runtime
        // middleware, which knows each embed's allowed origins.
        "/embed/**": { headers: false },
        "/api/image": { headers: IMAGE_SECURITY_HEADERS },
      };
  return {
    routeRules,
    vercelConfig: vercel
      ? {
          version: 3 as const,
          routes: [
            // Embed pages set their own frame-ancestors per embed at runtime;
            // an edge-level `frame-ancestors 'none'` would be enforced too.
            { src: "^/(?!embed/).*$", headers, continue: true },
            {
              src: "^/embed/.*$",
              headers: DASHBOARD_SECURITY_HEADERS,
              continue: true,
            },
            {
              src: "/api/image",
              headers: IMAGE_SECURITY_HEADERS,
              continue: true,
            },
          ],
        }
      : undefined,
  };
}
