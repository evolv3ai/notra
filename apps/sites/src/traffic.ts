import {
  CLOUDFLARE_WORKER_SUBREQUEST_IP,
  TRAFFIC_CONTENT_TYPES,
  TRAFFIC_TRACING_HEADERS,
} from "./constants/traffic";
import type { TrafficPayload, TrafficReport } from "./types/traffic";
import { forwardedClientIp } from "./utils/client-ip";
import { postToIngest } from "./utils/ingest";

function header(headers: Headers, name: string): string | undefined {
  return headers.get(name) ?? undefined;
}

function isPrefetch(headers: Headers): boolean {
  const purpose = `${headers.get("sec-purpose") ?? ""} ${headers.get("purpose") ?? ""}`;
  return purpose.toLowerCase().includes("prefetch");
}

function isReportableResponse(response: Response): boolean {
  if (
    response.status >= 300 &&
    response.status < 400 &&
    response.status !== 304
  ) {
    return false;
  }
  const contentType = response.headers.get("content-type") ?? "";
  return TRAFFIC_CONTENT_TYPES.some((type) => contentType.startsWith(type));
}

export function isDashboardReferer(
  referer: string | null,
  dashboardUrl: string
): boolean {
  return (
    referer !== null &&
    URL.canParse(referer) &&
    new URL(referer).origin === new URL(dashboardUrl).origin
  );
}

function isDashboardPreview(request: Request, dashboardUrl: string): boolean {
  const referer = request.headers.get("referer");
  if (isDashboardReferer(referer, dashboardUrl)) {
    return true;
  }
  return (
    referer !== null &&
    URL.canParse(referer) &&
    request.headers.get("sec-fetch-dest") === "iframe" &&
    new URL(referer).host === new URL(request.url).host
  );
}

export function isReportablePageView(
  request: Request,
  response: Response,
  dashboardUrl: string
): boolean {
  return (
    request.method === "GET" &&
    isReportableResponse(response) &&
    !isDashboardPreview(request, dashboardUrl)
  );
}

function publicReferer(
  referer: string | null,
  request: Request,
  publicUrl: string
): string | undefined {
  if (!referer) {
    return undefined;
  }
  try {
    const from = new URL(referer);
    if (from.host !== new URL(request.url).host) {
      return referer;
    }
    return new URL(`${from.pathname}${from.search}`, publicUrl).href;
  } catch {
    return referer;
  }
}

function buildPayload(report: TrafficReport): TrafficPayload {
  const { request, publicUrl, proxied, status } = report;
  const { headers } = request;
  const cf = (request as { cf?: IncomingRequestCfProperties }).cf;
  const connectingIp = header(headers, "cf-connecting-ip");
  const forwardedIp = proxied
    ? forwardedClientIp(headers.get("x-forwarded-for"), connectingIp)
    : undefined;
  // Cloudflare locates the address that connected to it, which behind a
  // proxy is the proxy's server, except for a Cloudflare Worker's request.
  const country =
    !forwardedIp || connectingIp === CLOUDFLARE_WORKER_SUBREQUEST_IP
      ? (cf?.country ?? header(headers, "cf-ipcountry"))
      : header(headers, "x-vercel-ip-country");
  const ip = forwardedIp ?? connectingIp;
  return {
    timestamp: new Date().toISOString(),
    method: report.method,
    url: publicUrl,
    ip: ip || undefined,
    geo: { country },
    referer: publicReferer(report.referer, request, publicUrl),
    userAgent: header(headers, "user-agent"),
    accept: header(headers, "accept"),
    acceptLanguage: header(headers, "accept-language"),
    requestId: header(headers, "cf-ray"),
    status: status === 304 ? 200 : status,
    signals: {
      clientHints: headers.has("sec-ch-ua"),
      fetchMode: headers.get("sec-fetch-mode"),
      tracing: TRAFFIC_TRACING_HEADERS.some((name) => headers.has(name)),
      prefetch: isPrefetch(headers),
    },
    visitorConsent: report.visitorConsent,
  };
}

export async function reportTraffic(report: TrafficReport): Promise<void> {
  await postToIngest({
    fetch: report.fetch,
    ingestUrl: report.ingestUrl,
    token: report.token,
    kind: "traffic",
    buildBody: () => buildPayload(report),
  });
}
