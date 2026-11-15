import { C15T_ANALYTICS_CATEGORY } from "@notra/sites-core/constants/integrations";
import {
  SITE_ANALYTICS_EVENT_FILE,
  SITE_ENGAGEMENT_VIEW_ID_PATTERN,
} from "@notra/sites-core/constants/sites";

import {
  ANALYTICS_EVENT_MAX_BYTES,
  ANALYTICS_SCRIPT,
  ANALYTICS_SCRIPT_CACHE_CONTROL,
} from "./constants/analytics";
import type { AnalyticsScriptTag } from "./types/serving";
import type { AnalyticsEvent, EngagementReport } from "./types/traffic";
import { escapeHtml } from "./utils/html";
import { postToIngest } from "./utils/ingest";

export function isAnalyticsEventPath(pathname: string): boolean {
  return pathname.endsWith(`/${SITE_ANALYTICS_EVENT_FILE}`);
}

/**
 * Beacons come from the site's own pages: the worker host, or the customer's
 * origin when the site is reverse-proxied. Anything else is a forged report.
 */
export function isForeignAnalyticsPost(
  request: Request,
  origins: string[]
): boolean {
  // The beacon endpoint is relative, so a real page always posts same-origin;
  // proxied hosts like www vs apex make the Origin list a fallback only.
  const fetchSite = request.headers.get("Sec-Fetch-Site");
  if (fetchSite !== null) {
    return fetchSite !== "same-origin";
  }
  const origin = request.headers.get("Origin");
  return origin !== null && !origins.includes(origin);
}

export function analyticsScriptResponse(): Response {
  return new Response(ANALYTICS_SCRIPT, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": ANALYTICS_SCRIPT_CACHE_CONTROL,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function injectAnalyticsScript(
  response: Response,
  analytics: AnalyticsScriptTag
): Response {
  const consent = analytics.consent
    ? ` type="text/plain" data-c15t-category="${C15T_ANALYTICS_CATEGORY}"`
    : "";
  const view = analytics.reportsView ? " data-view" : "";
  const tag = `<script${consent} src="${escapeHtml(analytics.scriptSrc)}" data-endpoint="${escapeHtml(analytics.eventPath)}"${view} defer></script>`;
  return new HTMLRewriter()
    .on("body", {
      element(element) {
        element.append(tag, { html: true });
      },
    })
    .transform(response);
}

function parseAnalyticsEvent(text: string): AnalyticsEvent | null {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const { k, r, v, p, ms, sd } = body as Record<string, unknown>;
  if (typeof p !== "string" || !p.startsWith("/")) {
    return null;
  }
  if (k === "view") {
    return typeof r === "string"
      ? { kind: "view", path: p, referrer: r }
      : null;
  }
  if (
    typeof v !== "string" ||
    !SITE_ENGAGEMENT_VIEW_ID_PATTERN.test(v) ||
    typeof ms !== "number" ||
    !Number.isFinite(ms) ||
    ms < 0 ||
    typeof sd !== "number" ||
    !Number.isFinite(sd)
  ) {
    return null;
  }
  return {
    kind: "engagement",
    viewId: v,
    path: p,
    visibleMs: Math.round(ms),
    scrollDepth: Math.min(100, Math.max(0, Math.round(sd))),
  };
}

export async function readAnalyticsEvent(
  request: Request
): Promise<AnalyticsEvent | null> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > ANALYTICS_EVENT_MAX_BYTES) {
    return null;
  }
  const text = await request.text().catch(() => "");
  if (text.length === 0 || text.length > ANALYTICS_EVENT_MAX_BYTES) {
    return null;
  }
  return parseAnalyticsEvent(text);
}

export async function reportEngagement(
  report: EngagementReport
): Promise<void> {
  const { event, publicOrigin } = report;
  await postToIngest({
    fetch: report.fetch,
    ingestUrl: report.ingestUrl,
    token: report.token,
    kind: "engagement",
    buildBody: () => ({
      type: "engagement",
      timestamp: new Date().toISOString(),
      url: new URL(event.path, publicOrigin).href,
      viewId: event.viewId,
      visibleMs: event.visibleMs,
      scrollDepth: event.scrollDepth,
    }),
  });
}
