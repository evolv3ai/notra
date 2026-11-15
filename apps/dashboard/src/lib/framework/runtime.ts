import { flushLogs, setLogFlushScheduler } from "@notra/ai/evlog";
import { flushPostHogServer } from "@notra/posthog/server";
import { defineMiddleware } from "nitro";
import { onDispose } from "nitro/h3";

import { IMAGE_SECURITY_HEADERS } from "../../constants/framework-image";
import { onRequestError, register } from "../../instrumentation";
import {
  getDashboardRedirect,
  getDashboardSecurityHeaders,
} from "../../utils/framework-request";
import { isTrafficEmbedPath } from "../../utils/traffic-embed";
import { resolveTrafficEmbedHeaders } from "../geo/traffic-embed-headers";
import { afterResponse, dashboardRequestContext } from "./after-response";

setLogFlushScheduler(afterResponse);

export default defineMiddleware(async (event, next) => {
  onDispose(event, () =>
    Promise.allSettled([flushLogs(), flushPostHogServer()])
  );
  return await dashboardRequestContext.run(event, async () => {
    const embed = isTrafficEmbedPath(event.url.pathname)
      ? await resolveTrafficEmbedHeaders(event.url)
      : null;
    for (const [key, value] of Object.entries(
      embed?.security ?? getDashboardSecurityHeaders()
    )) {
      event.res.headers.set(key, value);
      if (embed) {
        // Error pages (an unknown embed's 404) use these instead.
        event.res.errHeaders.set(key, value);
      }
    }
    // Only successful pages: errors must never land in the CDN.
    for (const [key, value] of Object.entries(embed?.cache ?? {})) {
      event.res.headers.append(key, value);
    }
    if (event.url.pathname === "/api/image") {
      event.res.headers.set(
        "Content-Security-Policy",
        IMAGE_SECURITY_HEADERS["Content-Security-Policy"]
      );
    }
    try {
      await register();
      return getDashboardRedirect(event.req) ?? (await next());
    } catch (error) {
      await onRequestError(error, event.req).catch((captureError) => {
        console.error("[telemetry] request error capture failed", captureError);
      });
      throw error;
    }
  });
});
