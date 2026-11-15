import { DEMO_BRAND_WEBSITE_CONTENT } from "@notra/ai/constants/demo-responses";
import type {
  ContextDevBrandRetrieveResponse,
  ContextDevBrandSearchResponse,
  ContextDevCompetitorsResponse,
  ContextDevCrawlSitemapInput,
  ContextDevCrawlSitemapResponse,
  ContextDevErrorResponse,
  ContextDevFetchWebpageInput,
  ContextDevFetchWebpageResponse,
  ContextDevParseResponse,
  ContextDevRequestInit,
  ContextDevScrapingResult,
  ContextDevScreenshotInput,
  ContextDevScreenshotResponse,
  ContextDevSearchResponse,
  ContextDevSearchResult,
  ContextDevStyleguideResponse,
  ContextDevWebSearchInput,
  ContextDevWebSearchResponse,
} from "@notra/ai/types/context-dev";
import type { OperationalLogEvent } from "@notra/ai/types/operational-log";
import { logError } from "@notra/ai/utils/server-log";
import { isDemoMode } from "@notra/utils/demo-mode";
import { Effect } from "effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import { isHttpClientError } from "effect/http/HttpClientError";
import * as HttpClientRequest from "effect/http/HttpClientRequest";

import {
  BRAND_ANALYSIS_EXCLUDED_PATH_PARTS,
  BRAND_ANALYSIS_MAX_CONTENT_LENGTH,
  BRAND_ANALYSIS_MAX_PAGES,
  BRAND_ANALYSIS_PAGE_SEPARATOR,
  BRAND_ANALYSIS_PAGE_WEIGHTS,
  BRAND_ANALYSIS_SITEMAP_MAX_LINKS,
  BRAND_ANALYSIS_SITEMAP_TIMEOUT_MS,
  BRAND_ANALYSIS_WWW_PREFIX,
  BRAND_SEARCH_TYPO_TOLERANCE,
  COMPETITORS_TIMEOUT_MS,
  CONTEXT_DEV_FETCH_TIMEOUT_MS,
  CONTEXT_DEV_PARSE_TIMEOUT_MS,
} from "../constants/context-dev";
import { demoContextDevResponse } from "./demo-context-dev";
import { httpErrorKind } from "./http-error-kind";
import { logOperationalEvent } from "./operational-log";
import { withRateLimitRetry } from "./rate-limit-retry";
import { websiteLogUrl } from "./website-log-url";

const CONTEXT_DEV_API_BASE_URL = "https://api.context.dev/v1";
const HTTP_PROTOCOL_REGEX = /^https?:\/\//i;

class ContextDevApiError extends Error {
  readonly code?: string;
  readonly status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.code = code;
    this.name = "ContextDevApiError";
    this.status = status;
  }
}

/** Whether context.dev calls can succeed: a key, or the demo's fixed data. */
export function isContextDevConfigured(): boolean {
  return Boolean(process.env.CONTEXT_DEV_API_KEY?.trim()) || isDemoMode();
}

function getContextDevApiKey(): string {
  const apiKey = process.env.CONTEXT_DEV_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("CONTEXT_DEV_API_KEY is not configured.");
  }
  return apiKey;
}

function getContextDevErrorMessage(
  payload: ContextDevErrorResponse | undefined,
  status: number
) {
  if (typeof payload?.message === "string" && payload.message.length > 0) {
    return payload.message;
  }

  if (payload?.message !== undefined) {
    try {
      return JSON.stringify(payload.message);
    } catch {
      // Fall through to the generic message below.
    }
  }

  return `Website data request failed with status ${status}`;
}

function toContextDevRequest(
  path: string,
  init: ContextDevRequestInit,
  apiKey: string
) {
  const request = HttpClientRequest.make(init.method)(
    `${CONTEXT_DEV_API_BASE_URL}${path}`
  ).pipe(HttpClientRequest.acceptJson, HttpClientRequest.bearerToken(apiKey));
  const contentType = init.contentType ?? "application/json";
  if (typeof init.body === "string") {
    return HttpClientRequest.bodyText(request, init.body, contentType);
  }
  if (init.body !== undefined) {
    return HttpClientRequest.bodyUint8Array(request, init.body, contentType);
  }
  return request;
}

function withCallerSignal(signal: AbortSignal | undefined): typeof fetch {
  const transport = (
    input: Parameters<typeof fetch>[0],
    requestInit?: Parameters<typeof fetch>[1]
  ) =>
    globalThis.fetch(input, {
      ...requestInit,
      signal:
        signal && requestInit?.signal
          ? AbortSignal.any([requestInit.signal, signal])
          : (requestInit?.signal ?? signal),
    });
  return Object.assign(transport, globalThis.fetch);
}

async function requestContextDev<TResponse>(
  path: string,
  init: ContextDevRequestInit
): Promise<TResponse> {
  const startedAt = performance.now();
  let status: number | undefined;
  let outcome: "success" | "error" = "error";
  let errorName: string | undefined;
  let errorCode: string | undefined;
  let errorMessage: string | undefined;
  let errorKind: OperationalLogEvent["errorKind"] = "operation_error";
  const requestUrl = new URL(path, CONTEXT_DEV_API_BASE_URL);
  const params = requestUrl.searchParams;
  const domain = params.get("domain");
  try {
    if (isDemoMode()) {
      outcome = "success";
      return demoContextDevResponse(path, init) as TResponse;
    }
    const apiKey = getContextDevApiKey();
    errorKind = "transport_error";
    const program = Effect.gen(function* () {
      const client = withRateLimitRetry(yield* HttpClient.HttpClient);
      const response = yield* client.execute(
        toContextDevRequest(path, init, apiKey)
      );
      status = response.status;
      errorKind = httpErrorKind(status) ?? "operation_error";
      if (status < 200 || status >= 300) {
        const payload = (yield* Effect.orElseSucceed(
          response.json,
          () => undefined
        )) as ContextDevErrorResponse | undefined;
        return yield* Effect.fail(
          new ContextDevApiError(
            getContextDevErrorMessage(payload, status),
            status,
            payload?.error_code
          )
        );
      }
      errorKind = "transport_error";
      return (yield* response.json) as TResponse;
    }).pipe(
      Effect.provide(FetchHttpClient.layer),
      Effect.provideService(
        FetchHttpClient.Fetch,
        withCallerSignal(init.signal)
      )
    );
    const payload = await Effect.runPromise(program, {
      signal: init.signal,
    }).catch((error: unknown) => {
      init.signal?.throwIfAborted();
      throw error;
    });
    outcome = "success";
    return payload;
  } catch (error) {
    if (isHttpClientError(error) && error.reason._tag === "DecodeError") {
      errorKind = "operation_error";
    }
    errorName = error instanceof Error ? error.name : "UnknownError";
    if (error instanceof ContextDevApiError) {
      errorCode = error.code;
      errorMessage =
        requestUrl.pathname === "/web/scrape/markdown" ||
        requestUrl.pathname === "/web/scrape/sitemap"
          ? mapContextDevError(error).error
          : `Context.dev request ${requestUrl.pathname} failed with status ${error.status}`;
    }
    throw error;
  } finally {
    logOperationalEvent({
      event: "integration.request.completed",
      surface: "context-dev",
      provider: "context.dev",
      routeId: path.split("?")[0] ?? path,
      method: init.method,
      durationMs: Math.round(performance.now() - startedAt),
      status,
      outcome,
      errorName,
      errorCode,
      errorMessage,
      websiteUrl: websiteLogUrl(
        params.get("url") ?? (domain ? `https://${domain}` : undefined)
      ),
      errorKind: outcome === "error" ? errorKind : undefined,
    });
  }
}

function truncateContent(content: string): string {
  if (content.length <= BRAND_ANALYSIS_MAX_CONTENT_LENGTH) {
    return content;
  }

  return `${content.slice(0, BRAND_ANALYSIS_MAX_CONTENT_LENGTH)}\n\n[Content truncated for brand analysis]`;
}

function mapContextDevError(
  error: unknown
): Extract<ContextDevScrapingResult, { success: false }> {
  if (error instanceof ContextDevApiError) {
    if (
      error.code === "INPUT_VALIDATION_ERROR" ||
      error.message.includes("Invalid URL")
    ) {
      return { success: false, error: "Invalid URL", fatal: true };
    }
    if (error.message.toLowerCase().includes("dns resolution failed")) {
      return {
        success: false,
        error:
          "Website domain could not be resolved. Please check the domain name.",
        fatal: true,
      };
    }
    if (
      error.code === "WEBSITE_NOT_FOUND" ||
      error.code === "NOT_FOUND" ||
      error.status === 404
    ) {
      return { success: false, error: "Website URL not found", fatal: true };
    }
    if (
      error.status === 403 ||
      error.status === 415 ||
      error.code === "WEBSITE_ACCESS_ERROR" ||
      error.code === "UNSUPPORTED_CONTENT"
    ) {
      return {
        success: false,
        error:
          error.status === 415 || error.code === "UNSUPPORTED_CONTENT"
            ? "Website content is not supported"
            : "Website could not be accessed",
        fatal: true,
      };
    }

    return {
      success: false,
      error: `Website data request failed with status ${error.status}`,
      fatal: false,
    };
  }

  return {
    success: false,
    error: isContextDevConfigured()
      ? "Website could not be retrieved. Please try again."
      : "Website scraping is not configured.",
    fatal: false,
  };
}

function normalizeBrandHostname(hostname: string): string {
  return hostname.startsWith(BRAND_ANALYSIS_WWW_PREFIX)
    ? hostname.slice(BRAND_ANALYSIS_WWW_PREFIX.length)
    : hostname;
}

function normalizeUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  return parsed.toString();
}

function normalizeContextDevWebsiteUrl(url: string): string {
  const trimmed = url.trim();
  return HTTP_PROTOCOL_REGEX.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function getCanonicalUrlKey(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.hostname = normalizeBrandHostname(parsed.hostname);
  return parsed.toString();
}

function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const url of urls) {
    try {
      const normalized = normalizeUrl(url);
      const key = getCanonicalUrlKey(normalized);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push(normalized);
    } catch {
      // Ignore malformed sitemap entries returned by external crawlers.
    }
  }

  return result;
}

function shouldSkipBrandAnalysisUrl(url: string): boolean {
  try {
    const { pathname } = new URL(url);
    const lowerPath = pathname.toLowerCase();
    const segments = lowerPath.split("/").filter(Boolean);
    return BRAND_ANALYSIS_EXCLUDED_PATH_PARTS.some((part) => {
      const blockedSegment = part.replace(/^\/|\/$/g, "");
      return segments.includes(blockedSegment);
    });
  } catch {
    return true;
  }
}

function scoreBrandAnalysisUrl(url: string, sourceUrl: string): number {
  try {
    const parsed = new URL(url);
    const source = new URL(sourceUrl);

    if (
      normalizeBrandHostname(parsed.hostname) !==
      normalizeBrandHostname(source.hostname)
    ) {
      return -1;
    }

    if (shouldSkipBrandAnalysisUrl(url)) {
      return -1;
    }

    const path = parsed.pathname.endsWith("/")
      ? parsed.pathname
      : `${parsed.pathname}/`;
    const pathDepth = path.split("/").filter(Boolean).length;
    const weightedScore =
      BRAND_ANALYSIS_PAGE_WEIGHTS.find(({ pattern }) => pattern.test(path))
        ?.weight ?? Math.max(10, 45 - pathDepth * 10);

    return weightedScore - parsed.search.length * 0.1;
  } catch {
    return -1;
  }
}

function pickBrandAnalysisUrls(sourceUrl: string, sitemapUrls: string[]) {
  const [source, ...candidates] = dedupeUrls([sourceUrl, ...sitemapUrls]);
  if (!source) {
    return [];
  }

  const rankedCandidates = candidates
    .map((url) => ({ score: scoreBrandAnalysisUrl(url, source), url }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score)
    .map(({ url }) => url);

  return dedupeUrls([source, ...rankedCandidates]).slice(
    0,
    BRAND_ANALYSIS_MAX_PAGES
  );
}

function formatScrapedPagesForBrandAnalysis(
  pages: ContextDevFetchWebpageResponse[]
) {
  return pages
    .map((page) => {
      const title = page.metadata?.title
        ? `\nTitle: ${page.metadata.title}`
        : "";
      return `Source URL: ${page.url}${title}\n\n${page.markdown}`;
    })
    .join(BRAND_ANALYSIS_PAGE_SEPARATOR);
}

export async function scrapeWebsiteForBrandAnalysis(
  url: string
): Promise<ContextDevScrapingResult> {
  if (isDemoMode()) {
    return { success: true, content: DEMO_BRAND_WEBSITE_CONTENT };
  }
  const websiteUrl = normalizeContextDevWebsiteUrl(url);

  try {
    const entryHost = new URL(websiteUrl).hostname;
    const [entryPageResult, entrySitemap] = await Promise.all([
      fetchBrandAnalysisPage(websiteUrl).then(
        (page) => ({ page }),
        (error: unknown) => ({ error })
      ),
      crawlBrandAnalysisSitemap(entryHost),
    ]);
    if ("error" in entryPageResult) {
      // A slow or blocked homepage should not sink the analysis when the
      // site's other pages are still readable.
      const fallbackUrls = pickBrandAnalysisUrls(
        websiteUrl,
        entrySitemap
      ).filter((pageUrl) => !isSameUrl(pageUrl, websiteUrl));
      const { pages } = await scrapeBrandAnalysisPages(
        fallbackUrls,
        websiteUrl
      );
      return pages.length > 0
        ? {
            success: true,
            content: truncateContent(formatScrapedPagesForBrandAnalysis(pages)),
          }
        : mapContextDevError(entryPageResult.error);
    }
    const entryPage = entryPageResult.page;

    // Rebranded or moved sites (getcargo.io -> getcargo.ai) redirect the
    // entry URL to another domain. Treat the redirect target as the site so
    // its sitemap and subpages are analyzed instead of failing every page.
    const siteUrl = getFinalPageUrl(entryPage);
    const siteHost = new URL(siteUrl).hostname;
    // Page ranking only keeps URLs on the final host, so any host change,
    // including to a subdomain, needs that host's own sitemap.
    const sitemapUrls =
      normalizeBrandHostname(siteHost) === normalizeBrandHostname(entryHost)
        ? entrySitemap
        : await crawlBrandAnalysisSitemap(siteHost);

    const urls = pickBrandAnalysisUrls(siteUrl, sitemapUrls).filter(
      (pageUrl) => !isSameUrl(pageUrl, siteUrl)
    );
    const { pages } = await scrapeBrandAnalysisPages(urls, siteUrl);

    return {
      success: true,
      content: truncateContent(
        formatScrapedPagesForBrandAnalysis([entryPage, ...pages])
      ),
    };
  } catch (error) {
    logError("[context.dev] Error scraping website", undefined, {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return mapContextDevError(error);
  }
}

async function crawlBrandAnalysisSitemap(domain: string): Promise<string[]> {
  const result = await crawlSitemap({
    domain,
    maxLinks: BRAND_ANALYSIS_SITEMAP_MAX_LINKS,
    timeoutMS: BRAND_ANALYSIS_SITEMAP_TIMEOUT_MS,
  }).catch(() => null);
  return result?.urls ?? [];
}

function fetchBrandAnalysisPage(pageUrl: string) {
  return fetchWebpage({
    includeImages: false,
    includeLinks: true,
    onlyMainContent: true,
    timeoutMS: 20_000,
    url: pageUrl,
  });
}

function getFinalPageUrl(page: ContextDevFetchWebpageResponse): string {
  return new URL(page.metadata?.finalUrl ?? page.url, page.url).toString();
}

function isSameBrandHost(host: string, siteHost: string): boolean {
  const normalizedHost = normalizeBrandHostname(host);
  const normalizedSiteHost = normalizeBrandHostname(siteHost);
  return (
    normalizedHost === normalizedSiteHost ||
    normalizedHost.endsWith(`.${normalizedSiteHost}`)
  );
}

function isSameUrl(a: string, b: string): boolean {
  try {
    return getCanonicalUrlKey(a) === getCanonicalUrlKey(b);
  } catch {
    return false;
  }
}

async function scrapeBrandAnalysisPages(urls: string[], siteUrl: string) {
  const siteHost = new URL(siteUrl).hostname;
  const settledPages = await Promise.allSettled(
    urls.map(async (pageUrl) => {
      const page = await fetchBrandAnalysisPage(pageUrl);
      // Subpages that leave the site (e.g. to a parked or partner domain)
      // would mix another brand into the analysis.
      if (!isSameBrandHost(new URL(getFinalPageUrl(page)).hostname, siteHost)) {
        throw new Error("Scraped page redirected to a different website");
      }
      return page;
    })
  );

  return {
    pages: settledPages.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : []
    ),
  };
}

export async function fetchWebpage(
  input: ContextDevFetchWebpageInput,
  options?: { signal?: AbortSignal }
): Promise<ContextDevFetchWebpageResponse> {
  const timeoutMS = input.timeoutMS ?? CONTEXT_DEV_FETCH_TIMEOUT_MS;
  if (
    !Number.isSafeInteger(timeoutMS) ||
    timeoutMS <= 0 ||
    timeoutMS > 2_147_483_647
  ) {
    throw new RangeError(
      "Webpage timeoutMS must be a positive finite timer duration"
    );
  }
  const url = normalizeContextDevWebsiteUrl(input.url);
  const params = new URLSearchParams({
    includeImages: String(input.includeImages ?? false),
    includeLinks: String(input.includeLinks ?? true),
    shortenBase64Images: "true",
    useMainContentOnly: String(input.onlyMainContent ?? true),
    url,
  });

  if (input.maxAgeMs !== undefined) {
    params.set("maxAgeMs", String(input.maxAgeMs));
  }
  if (input.waitForMs !== undefined) {
    params.set("waitForMs", String(input.waitForMs));
  }
  params.set("timeoutMS", String(timeoutMS));
  const controller = new AbortController();
  const signal = options?.signal
    ? AbortSignal.any([controller.signal, options.signal])
    : controller.signal;
  const timer = setTimeout(
    () =>
      controller.abort(
        new DOMException("Webpage deadline exceeded", "TimeoutError")
      ),
    timeoutMS
  );
  try {
    signal.throwIfAborted();
    const response = await requestContextDev<{
      markdown: string;
      metadata?: ContextDevFetchWebpageResponse["metadata"];
      url: string;
    }>(`/web/scrape/markdown?${params.toString()}`, { method: "GET", signal });
    signal.throwIfAborted();

    return {
      success: true,
      markdown: response.markdown,
      metadata: response.metadata,
      url: response.url,
    };
  } catch (error) {
    // Error-body decoding may otherwise replace cancellation with an HTTP error.
    signal.throwIfAborted();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function crawlSitemap(
  input: ContextDevCrawlSitemapInput,
  options?: { signal?: AbortSignal }
): Promise<ContextDevCrawlSitemapResponse> {
  const params = new URLSearchParams({
    domain: input.domain,
  });

  if (input.maxLinks !== undefined) {
    params.set("maxLinks", String(input.maxLinks));
  }
  if (input.timeoutMS !== undefined) {
    params.set("timeoutMS", String(input.timeoutMS));
  }
  if (input.urlRegex !== undefined) {
    params.set("urlRegex", input.urlRegex);
  }

  return requestContextDev<ContextDevCrawlSitemapResponse>(
    `/web/scrape/sitemap?${params.toString()}`,
    { method: "GET", signal: options?.signal }
  );
}

export async function retrieveBrand(
  domain: string,
  options?: { signal?: AbortSignal }
): Promise<ContextDevBrandRetrieveResponse> {
  const params = new URLSearchParams({ domain });

  return requestContextDev<ContextDevBrandRetrieveResponse>(
    `/brand/retrieve?${params.toString()}`,
    { method: "GET", signal: options?.signal }
  );
}

export async function extractCompetitors(
  domain: string,
  numCompetitors: number
): Promise<ContextDevCompetitorsResponse> {
  const params = new URLSearchParams({
    domain,
    numCompetitors: String(numCompetitors),
    timeoutMS: String(COMPETITORS_TIMEOUT_MS),
  });

  return requestContextDev<ContextDevCompetitorsResponse>(
    `/web/competitors?${params.toString()}`,
    { method: "GET" }
  );
}

export async function searchBrands(
  query: string,
  options?: { signal?: AbortSignal }
): Promise<ContextDevBrandSearchResponse> {
  const params = new URLSearchParams({
    query,
    autocomplete: "true",
    typoTolerance: String(BRAND_SEARCH_TYPO_TOLERANCE),
  });

  return requestContextDev<ContextDevBrandSearchResponse>(
    `/brand/search?${params.toString()}`,
    { method: "GET", signal: options?.signal }
  );
}

/**
 * Converts a PDF to markdown with context.dev Parse. The endpoint takes the
 * raw file bytes; a JSON body would be parsed as the document itself.
 */
export async function parsePdfDocument(
  bytes: Uint8Array<ArrayBuffer>
): Promise<string> {
  const response = await requestContextDev<ContextDevParseResponse>(
    "/parse?extension=pdf",
    {
      body: bytes,
      contentType: "application/pdf",
      method: "POST",
      signal: AbortSignal.timeout(CONTEXT_DEV_PARSE_TIMEOUT_MS),
    }
  );
  return response.markdown?.trim() ?? "";
}

export async function retrieveStyleguide(
  domain: string,
  options?: { signal?: AbortSignal }
): Promise<ContextDevStyleguideResponse> {
  const params = new URLSearchParams({
    domain,
    timeoutMS: "30000",
  });

  return requestContextDev<ContextDevStyleguideResponse>(
    `/web/styleguide?${params.toString()}`,
    { method: "GET", signal: options?.signal }
  );
}

export async function captureScreenshot(
  input: ContextDevScreenshotInput,
  options?: { signal?: AbortSignal }
): Promise<ContextDevScreenshotResponse> {
  const { directUrl, domain } = input;
  const hasDomain = domain !== undefined;
  const hasDirectUrl = directUrl !== undefined;

  if (!(hasDomain || hasDirectUrl)) {
    throw new Error("Screenshot capture requires a domain or directUrl.");
  }
  if (hasDomain && hasDirectUrl) {
    throw new Error("Screenshot capture accepts either domain or directUrl.");
  }

  const params = new URLSearchParams();

  if (hasDomain) {
    params.set("domain", domain);
  }
  if (hasDirectUrl) {
    params.set("directUrl", directUrl);
  }

  if (input.viewport !== undefined) {
    params.set("viewport[width]", String(input.viewport.width));
    params.set("viewport[height]", String(input.viewport.height));
  }
  if (input.format !== undefined) {
    params.set("format", input.format);
  }
  if (input.fullScreenshot !== undefined) {
    params.set("fullScreenshot", String(input.fullScreenshot));
  }
  if (input.handleCookiePopup !== undefined) {
    params.set("handleCookiePopup", String(input.handleCookiePopup));
  }
  if (input.maxAgeMs !== undefined) {
    params.set("maxAgeMs", String(input.maxAgeMs));
  }
  if (input.scrollOffset !== undefined) {
    params.set("scrollOffset", String(input.scrollOffset));
  }
  if (input.waitForMs !== undefined) {
    params.set("waitForMs", String(input.waitForMs));
  }
  if (input.timeoutMS !== undefined) {
    params.set("timeoutMS", String(input.timeoutMS));
  }

  return requestContextDev<ContextDevScreenshotResponse>(
    `/web/screenshot?${params.toString()}`,
    { method: "GET", signal: options?.signal }
  );
}

function normalizeSearchResult(
  result: ContextDevSearchResult
): ContextDevSearchResult {
  return {
    ...result,
    markdown: result.markdown ?? {
      code: "NOT_REQUESTED",
      markdown: null,
    },
  };
}

export async function searchWeb(
  input: ContextDevWebSearchInput
): Promise<ContextDevWebSearchResponse> {
  const response = await requestContextDev<ContextDevSearchResponse>(
    "/web/search",
    {
      body: JSON.stringify({
        query: input.query,
        includeDomains: input.includeDomains,
        excludeDomains: input.excludeDomains,
        freshness: input.freshness,
        queryFanout: input.queryFanout,
        timeoutMS: input.timeoutMS,
        markdownOptions: {
          enabled: input.scrapeOptions?.formats?.includes("markdown") ?? false,
          includeLinks: true,
          includeImages:
            input.scrapeOptions?.formats?.includes("images") ?? false,
          shortenBase64Images: true,
          useMainContentOnly: input.scrapeOptions?.onlyMainContent ?? true,
          maxAgeMs: input.scrapeOptions?.maxAge,
        },
      }),
      method: "POST",
      signal: input.abortSignal,
    }
  );

  const results = response.results
    .slice(0, input.limit ?? 5)
    .map(normalizeSearchResult);
  return {
    success: true,
    data: { web: results },
    results,
    query: response.query,
  };
}
