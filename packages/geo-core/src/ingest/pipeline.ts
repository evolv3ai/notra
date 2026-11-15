import {
  hasAiTrafficEventsQuota,
  trackAiTrafficEvent,
} from "@notra/ai/billing/ai-traffic-events";
import {
  ingestGeoTrafficEvents,
  ingestMcpEvents,
  ingestWebPageEngagement,
  ingestWebPageViews,
} from "@notra/analytics/tinybird/client";
import type { GeoTrafficEventRow } from "@notra/analytics/tinybird/datasources";
import type {
  WebPageEngagementRow,
  WebPageViewRow,
} from "@notra/analytics/types/tinybird-datasources";
import { GEO_INGEST_BEARER_PREFIX } from "@notra/geo-core/constants/geo";
import {
  isGeoIngestSiteToken,
  verifyGeoIngestSiteToken,
  verifyGeoIngestToken,
} from "@notra/geo-core/geo/ingest";
import {
  geoRequestPayloadSchema,
  mcpEventBatchSchema,
  webEngagementPayloadSchema,
} from "@notra/geo-core/schemas/geo";
import type {
  GeoIngestIdentity,
  GeoVisitorType,
} from "@notra/geo-core/types/geo";
import { isTrackedGeoVisitorType } from "@notra/geo-core/utils/ai-traffic";
import { acceptsIngestHost } from "@notra/geo-core/utils/geo-project-domains";
import { isServedBySite } from "@notra/geo-core/utils/ingest-sites";
import { Effect } from "effect";

import { GEO_INGEST_TINYBIRD_TIMEOUT_MS } from "../constants/ingest";
import type {
  GeoIngestBuffer,
  GeoIngestDefer,
  GeoIngestDropReason,
  GeoIngestResult,
} from "../types/ingest";
import { geoIngestAdmissionKey } from "../utils/geo-ingest-admission-key";
import { logGeoFailure } from "../utils/geo-log";
import { isHumanPageView } from "../utils/web-page-view";
import { trackGeoIngestAnalytics } from "./analytics";
import { classifyVisitor } from "./classify-visitor";
import {
  GeoIngestFailedError,
  GeoIngestInvalidPayloadError,
  GeoIngestInvalidTokenError,
  GeoIngestMissingTokenError,
  GeoIngestRateLimitedError,
  GeoIngestUnparseableUrlError,
} from "./errors";
import { buildGeoTrafficEvent, toCapturedDate } from "./event";
import { loadIngestAllowedHosts } from "./hosts";
import { assertGeoIngestIdentityActive } from "./identity";
import { resolveJourneyId } from "./journey";
import { announceGeoTrafficEvent, expediteForLiveViewers } from "./live";
import { buildMcpEventRow, isMcpEventBody } from "./mcp";
import {
  geoIngestAdmissionRatelimit,
  geoIngestRatelimit,
  webIngestRatelimit,
} from "./ratelimit";
import { loadIngestSite, loadOrganizationSitePrefixes } from "./sites";
import {
  buildWebEngagementRow,
  buildWebPageView,
  isWebEngagementBody,
} from "./web";

const readSiteIdentity = Effect.fn("geoIngest.readSiteIdentity")(function* (
  token: string
) {
  const siteId = verifyGeoIngestSiteToken(token);
  if (!siteId) {
    return yield* Effect.fail(
      new GeoIngestInvalidTokenError({ authReason: "invalid_signature" })
    );
  }
  const site = yield* Effect.tryPromise({
    try: () => loadIngestSite(siteId),
    catch: (cause) =>
      new GeoIngestFailedError({ cause, stage: "site_lookup", siteId }),
  });
  if (!site) {
    return yield* Effect.fail(
      new GeoIngestInvalidTokenError({ authReason: "site_inactive", siteId })
    );
  }
  return {
    organizationId: site.organizationId,
    projectId: site.projectId,
    generation: 0,
    site: { id: site.id, hosts: site.hosts, mounts: site.mounts },
  } satisfies GeoIngestIdentity;
});

export const readBearerIdentity = Effect.fn("geoIngest.readBearerIdentity")(
  function* (request: Request) {
    const header = request.headers.get("authorization");
    const token = header?.startsWith(GEO_INGEST_BEARER_PREFIX)
      ? header.slice(GEO_INGEST_BEARER_PREFIX.length).trim()
      : "";

    if (token.length === 0) {
      return yield* Effect.fail(new GeoIngestMissingTokenError({}));
    }

    if (isGeoIngestSiteToken(token)) {
      return yield* readSiteIdentity(token);
    }

    const identity = verifyGeoIngestToken(token);
    if (!identity) {
      return yield* Effect.fail(
        new GeoIngestInvalidTokenError({ authReason: "invalid_signature" })
      );
    }

    return identity;
  }
);

const enforceRateLimit = Effect.fn("geoIngest.rateLimit")(function* (
  organizationId: string,
  admissionKey?: string,
  rate = 1
) {
  const limiter = admissionKey
    ? geoIngestAdmissionRatelimit
    : geoIngestRatelimit;
  const { success, reason } = yield* Effect.tryPromise({
    try: () => limiter.limit(admissionKey ?? organizationId, { rate }),
    catch: (cause) => new GeoIngestFailedError({ cause }),
  });
  // Upstash reports timeouts as success; an unavailable limiter is not approval.
  if (reason === "timeout") {
    return yield* Effect.fail(
      new GeoIngestFailedError({
        cause: new Error("Rate limit check timed out"),
      })
    );
  }
  if (!success) {
    return yield* Effect.fail(
      new GeoIngestRateLimitedError({ organizationId })
    );
  }
});

const readBody = Effect.fn("geoIngest.readBody")(function* (request: Request) {
  return yield* Effect.promise((): Promise<unknown> =>
    request.json().catch(() => null)
  );
});

const readPayload = Effect.fn("geoIngest.readPayload")(function* (
  body: unknown
) {
  const parsed = geoRequestPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return yield* Effect.fail(
      new GeoIngestInvalidPayloadError({ issues: parsed.error.issues })
    );
  }
  return parsed.data;
});

const parseUrl = Effect.fn("geoIngest.parseUrl")(function* (value: string) {
  return yield* Effect.try({
    try: () => new URL(value),
    catch: () => new GeoIngestUnparseableUrlError({ url: value }),
  });
});

const admitWebPageView = Effect.fn("geoIngest.admitWebPageView")(function* (
  admissionKey: string
) {
  return yield* Effect.promise(() =>
    webIngestRatelimit
      .limit(admissionKey)
      .then((result) => result.success)
      .catch(() => true)
  );
});

const storeWebPageView = Effect.fn("geoIngest.storeWebPageView")(function* (
  row: WebPageViewRow,
  buffer: GeoIngestBuffer | undefined
) {
  if (buffer?.enqueueWeb?.(row)) {
    return;
  }
  yield* Effect.promise(() =>
    ingestWebPageViews([row]).catch((error: unknown) => {
      logGeoFailure(
        "geo.ingest.web_write_failed",
        "Web page view write failed",
        error,
        { organizationId: row.organization_id }
      );
      return null;
    })
  );
});

const writeTinybirdRows = Effect.fn("geoIngest.ingest")(function* (
  ingest: () => ReturnType<typeof ingestGeoTrafficEvents>
) {
  const result = yield* Effect.tryPromise({
    try: ingest,
    catch: (cause) => new GeoIngestFailedError({ cause }),
  }).pipe(
    Effect.timeoutOrElse({
      duration: GEO_INGEST_TINYBIRD_TIMEOUT_MS,
      orElse: () =>
        Effect.fail(
          new GeoIngestFailedError({
            cause: new Error(
              `Tinybird write timed out after ${GEO_INGEST_TINYBIRD_TIMEOUT_MS}ms`
            ),
          })
        ),
    })
  );
  if (!result) {
    return yield* Effect.fail(
      new GeoIngestFailedError({
        cause: new Error("Tinybird is not configured"),
      })
    );
  }
  if (result.quarantined_rows > 0) {
    return yield* Effect.fail(
      new GeoIngestFailedError({
        cause: new Error("Tinybird quarantined events"),
      })
    );
  }
});

export const writeGeoTrafficEvents = (rows: GeoTrafficEventRow[]) =>
  writeTinybirdRows(() => ingestGeoTrafficEvents(rows));

const failWithAuthPrecedence = Effect.fn("geoIngest.failWithAuthPrecedence")(
  function* (
    identity: GeoIngestIdentity,
    error: GeoIngestInvalidPayloadError | GeoIngestUnparseableUrlError
  ) {
    yield* enforceRateLimit(
      identity.organizationId,
      geoIngestAdmissionKey(identity)
    );
    yield* assertGeoIngestIdentityActive(identity);
    return yield* Effect.fail(error);
  }
);

const storeWebEngagement = Effect.fn("geoIngest.storeWebEngagement")(function* (
  row: WebPageEngagementRow,
  buffer: GeoIngestBuffer | undefined
) {
  if (buffer?.enqueueEngagement?.(row)) {
    return;
  }
  yield* Effect.promise(() =>
    ingestWebPageEngagement([row]).catch((error: unknown) => {
      logGeoFailure(
        "geo.ingest.engagement_write_failed",
        "Web engagement write failed",
        error,
        { organizationId: row.organization_id }
      );
      return null;
    })
  );
});

function droppedResult(
  identity: GeoIngestIdentity,
  visitorType: GeoVisitorType,
  reason: GeoIngestDropReason,
  host?: string
): GeoIngestResult {
  return {
    outcome: "dropped",
    reason,
    organizationId: identity.organizationId,
    projectId: identity.projectId,
    visitorType,
    ...(host === undefined ? {} : { host }),
  };
}

function webOnlyResult(
  identity: GeoIngestIdentity,
  visitorType: GeoVisitorType
): GeoIngestResult {
  return {
    outcome: "ingested",
    organizationId: identity.organizationId,
    projectId: identity.projectId,
    visitorType,
    source: "",
    agent: "",
    ingestMs: 0,
  };
}

function isOutsideSiteMounts(identity: GeoIngestIdentity, url: URL): boolean {
  return (
    identity.site !== undefined &&
    !isServedBySite(url, [{ host: url.hostname, mounts: identity.site.mounts }])
  );
}

const runWebEngagementIngest = Effect.fn("geoIngest.engagement")(function* (
  identity: GeoIngestIdentity,
  body: unknown,
  buffer: GeoIngestBuffer | undefined
) {
  if (!identity.site) {
    return droppedResult(identity, "human", "not_site");
  }
  const parsed = webEngagementPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return yield* failWithAuthPrecedence(
      identity,
      new GeoIngestInvalidPayloadError({ issues: parsed.error.issues })
    );
  }
  const payload = parsed.data;
  const urlResult = yield* Effect.result(parseUrl(payload.url));
  if (urlResult._tag === "Failure") {
    return yield* failWithAuthPrecedence(identity, urlResult.failure);
  }
  const url = urlResult.success;
  if (!(yield* admitWebPageView(geoIngestAdmissionKey(identity)))) {
    return droppedResult(identity, "human", "web_rate_limited");
  }
  const [, allowedHosts] = yield* Effect.all(
    [
      assertGeoIngestIdentityActive(identity),
      Effect.promise(() => loadIngestAllowedHosts(identity)),
    ],
    { concurrency: "unbounded" }
  );
  if (
    !acceptsIngestHost(url.hostname, allowedHosts) ||
    isOutsideSiteMounts(identity, url)
  ) {
    return droppedResult(identity, "human", "host", url.hostname);
  }
  yield* storeWebEngagement(
    buildWebEngagementRow({
      identity,
      payload,
      url,
      capturedAt: toCapturedDate(payload.timestamp),
    }),
    buffer
  );
  return webOnlyResult(identity, "human");
});

const runMcpEventIngest = Effect.fn("geoIngest.mcp")(function* (
  identity: GeoIngestIdentity,
  body: unknown,
  defer: GeoIngestDefer
) {
  const parsed = mcpEventBatchSchema.safeParse(body);
  if (!parsed.success) {
    return yield* failWithAuthPrecedence(
      identity,
      new GeoIngestInvalidPayloadError({ issues: parsed.error.issues })
    );
  }
  yield* enforceRateLimit(
    identity.organizationId,
    geoIngestAdmissionKey(identity)
  );
  yield* assertGeoIngestIdentityActive(identity);
  if (!(yield* hasAiTrafficEventsQuota(identity.organizationId))) {
    return droppedResult(identity, "unknown", "quota");
  }
  const { events } = parsed.data;
  yield* enforceRateLimit(identity.organizationId, undefined, events.length);

  const rows = events.map((payload) =>
    buildMcpEventRow({
      identity,
      payload,
      capturedAt: toCapturedDate(payload.timestamp),
    })
  );
  const ingestStartedAt = Date.now();
  yield* writeTinybirdRows(() => ingestMcpEvents(rows));
  const ingestMs = Date.now() - ingestStartedAt;
  yield* Effect.sync(() =>
    defer(() => trackAiTrafficEvent(identity.organizationId, rows.length))
  );

  return {
    outcome: "ingested",
    organizationId: identity.organizationId,
    projectId: identity.projectId,
    visitorType: "unknown",
    source: "mcp",
    agent: rows[0]?.client_name ?? "",
    ingestMs,
  } satisfies GeoIngestResult;
});

export const runGeoEnvelopeIngest = Effect.fn("geoIngest.envelope")(function* (
  identity: GeoIngestIdentity,
  body: unknown,
  defer: GeoIngestDefer,
  buffer?: GeoIngestBuffer
) {
  const payloadResult = yield* Effect.result(readPayload(body));
  if (payloadResult._tag === "Failure") {
    return yield* failWithAuthPrecedence(identity, payloadResult.failure);
  }
  const payload = payloadResult.success;

  const urlResult = yield* Effect.result(parseUrl(payload.url));
  if (urlResult._tag === "Failure") {
    return yield* failWithAuthPrecedence(identity, urlResult.failure);
  }
  const url = urlResult.success;
  const classification = classifyVisitor({
    userAgent: payload.userAgent,
    referer: payload.referer,
    accept: payload.accept,
    signals: payload.signals,
  });
  const isAi = isTrackedGeoVisitorType(classification.visitorType);
  const countsVisitors =
    identity.site !== undefined &&
    payload.visitorConsent !== false &&
    isHumanPageView({ classification, payload, url });
  if (!(isAi || countsVisitors)) {
    return droppedResult(identity, classification.visitorType, "visitor_type");
  }
  if (
    classification.visitorType === "ai_referral" &&
    payload.visitorConsent === false
  ) {
    return droppedResult(identity, classification.visitorType, "consent");
  }

  if (isAi) {
    yield* enforceRateLimit(
      identity.organizationId,
      geoIngestAdmissionKey(identity)
    );
  } else if (!(yield* admitWebPageView(geoIngestAdmissionKey(identity)))) {
    return droppedResult(
      identity,
      classification.visitorType,
      "web_rate_limited"
    );
  }
  const [, allowedHosts, sitePrefixes] = yield* Effect.all(
    [
      assertGeoIngestIdentityActive(identity),
      Effect.promise(() => loadIngestAllowedHosts(identity)),
      identity.site
        ? Effect.succeed(null)
        : Effect.promise(() =>
            loadOrganizationSitePrefixes(identity.organizationId)
          ),
    ],
    { concurrency: "unbounded" }
  );
  if (!identity.projectId && allowedHosts === null) {
    return yield* Effect.fail(
      new GeoIngestFailedError({
        cause: new Error("Traffic host lookup failed"),
      })
    );
  }
  if (
    !acceptsIngestHost(url.hostname, allowedHosts) ||
    isOutsideSiteMounts(identity, url)
  ) {
    return droppedResult(
      identity,
      classification.visitorType,
      "host",
      url.hostname
    );
  }
  if (sitePrefixes && isServedBySite(url, sitePrefixes)) {
    return droppedResult(
      identity,
      classification.visitorType,
      "site",
      url.hostname
    );
  }

  const capturedAt = toCapturedDate(payload.timestamp);
  const webRow = countsVisitors
    ? yield* Effect.promise(() =>
        buildWebPageView({
          identity,
          payload,
          url,
          capturedAt,
          classification,
        }).catch(() => null)
      )
    : null;
  if (webRow) {
    yield* storeWebPageView(webRow, buffer);
  }
  if (!isAi) {
    return webOnlyResult(identity, classification.visitorType);
  }
  if (!(yield* hasAiTrafficEventsQuota(identity.organizationId))) {
    return droppedResult(
      identity,
      classification.visitorType,
      "quota",
      url.hostname
    );
  }

  const journey = resolveJourneyId({
    url,
    source: classification.source,
    ip: payload.ip,
    capturedAt,
    visitorType: classification.visitorType,
    category: classification.category,
  });
  const event = buildGeoTrafficEvent({
    organizationId: identity.organizationId,
    projectId: identity.projectId,
    siteId: identity.site?.id,
    payload,
    url,
    capturedAt,
    classification,
    journey,
  });

  yield* enforceRateLimit(identity.organizationId);
  const ingestStartedAt = Date.now();
  const buffered = buffer?.enqueue(event) ?? false;
  if (!buffered) {
    yield* writeGeoTrafficEvents([event]);
  }
  const ingestMs = Date.now() - ingestStartedAt;
  yield* Effect.sync(() =>
    defer(async () => {
      const announced =
        buffered && buffer
          ? expediteForLiveViewers(buffer, event.organization_id)
          : announceGeoTrafficEvent(event.organization_id, event.project_id);
      const tracked = trackAiTrafficEvent(event.organization_id);
      try {
        await Effect.runPromise(trackGeoIngestAnalytics({ identity, event }));
      } catch (error) {
        logGeoFailure(
          "geo.ingest.analytics_failed",
          "Deferred ingest analytics failed",
          error,
          {
            organizationId: identity.organizationId,
            projectId: identity.projectId,
          }
        );
      }
      await Promise.all([announced, tracked]);
    })
  );

  return {
    outcome: "ingested",
    organizationId: identity.organizationId,
    projectId: identity.projectId,
    visitorType: classification.visitorType,
    source: classification.source,
    agent: classification.agent,
    ingestMs,
  } satisfies GeoIngestResult;
});

export const runGeoIngest = Effect.fn("geoIngest.run")(function* (
  request: Request,
  defer: GeoIngestDefer,
  buffer?: GeoIngestBuffer
) {
  const identity = yield* readBearerIdentity(request);
  const body = yield* readBody(request);
  if (isWebEngagementBody(body)) {
    return yield* runWebEngagementIngest(identity, body, buffer);
  }
  if (isMcpEventBody(body)) {
    return yield* runMcpEventIngest(identity, body, defer);
  }
  return yield* runGeoEnvelopeIngest(identity, body, defer, buffer);
});
