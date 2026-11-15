import { isDemoMode } from "@notra/utils/demo-mode";

import { TRAFFIC_EMBED_CDN_TTL_SECONDS } from "../../constants/traffic-embed";
import { getTrafficEmbedSecurityHeaders } from "../../utils/framework-request";
import { isDashboardLocale } from "../../utils/i18n";
import {
  trafficEmbedFrameAncestors,
  trafficEmbedIdFromPath,
} from "../../utils/traffic-embed";

/**
 * Unknown, revoked or unreadable embeds keep `frame-ancestors 'none'`, so a
 * lookup failure can only make the page unframeable, never open it up.
 * Active embeds render the same page for every visitor, so Vercel's CDN may
 * serve it; without a `locale` param the language follows the browser.
 */
export async function resolveTrafficEmbedHeaders(url: URL): Promise<{
  security: Record<string, string>;
  cache: Record<string, string>;
}> {
  const embedId = isDemoMode() ? null : trafficEmbedIdFromPath(url.pathname);
  const config =
    embedId === null
      ? null
      : await import("./traffic-embeds")
          .then((module) => module.getTrafficEmbedConfig(embedId))
          .catch(() => null);
  if (!config) {
    return { security: getTrafficEmbedSecurityHeaders("'none'"), cache: {} };
  }
  return {
    security: getTrafficEmbedSecurityHeaders(
      trafficEmbedFrameAncestors(config.allowedOrigins)
    ),
    cache: {
      "Vercel-CDN-Cache-Control": `max-age=${TRAFFIC_EMBED_CDN_TTL_SECONDS}`,
      ...(isDashboardLocale(url.searchParams.get("locale"))
        ? {}
        : { Vary: "Accept-Language" }),
    },
  };
}
