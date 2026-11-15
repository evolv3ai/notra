import { gunzipSync } from "node:zlib";

import type { GeoTrafficEventRow } from "@notra/analytics/tinybird/datasources";
import type {
  GeoDrainProvider,
  GeoIngestIdentity,
} from "@notra/geo-core/types/geo";
import { isTrackedGeoVisitorType } from "@notra/geo-core/utils/ai-traffic";
import { Effect, type Result } from "effect";

import {
  GEO_DRAIN_CONCURRENCY,
  GEO_DRAIN_DEDUPE_KEY_PREFIX,
  GEO_DRAIN_DEDUPE_TTL_SECONDS,
  GEO_DRAIN_MAX_BODY_BYTES,
  GEO_DRAIN_GZIP_MAGIC,
  GEO_DRAIN_MAX_DECOMPRESSED_BYTES,
  GEO_DRAIN_RETRYABLE_OUTCOMES,
} from "../constants/ingest";
import type {
  GeoDrainRecord,
  GeoDrainRecordOutcome,
  GeoDrainSummary,
  GeoIngestBuffer,
  GeoIngestDefer,
  GeoIngestResult,
} from "../types/ingest";
import { parseDrainLines, toGeoDrainRecords } from "../utils/geo-drain-records";
import { classifyVisitor } from "./classify-visitor";
import {
  type GeoIngestError,
  GeoIngestFailedError,
  GeoIngestInvalidPayloadError,
  GeoIngestInvalidTokenError,
  GeoIngestPayloadTooLargeError,
} from "./errors";
import { assertGeoIngestIdentityActive } from "./identity";
import { announceGeoTrafficRows } from "./live";
import {
  readBearerIdentity,
  runGeoEnvelopeIngest,
  writeGeoTrafficEvents,
} from "./pipeline";
import { geoIngestRedis } from "./ratelimit";

const readDrainIdentity = Effect.fn("geoDrain.readIdentity")(function* (
  request: Request
) {
  const identity = yield* readBearerIdentity(request);
  if (identity.site) {
    return yield* Effect.fail(
      new GeoIngestInvalidTokenError({
        authReason: "site_token_not_allowed",
        organizationId: identity.organizationId,
        projectId: identity.projectId,
        siteId: identity.site.id,
      })
    );
  }
  yield* assertGeoIngestIdentityActive(identity);
  return identity;
});

const readDrainBody = Effect.fn("geoDrain.readBody")(function* (
  request: Request
) {
  const bytes = yield* Effect.tryPromise({
    try: async () => new Uint8Array(await request.arrayBuffer()),
    catch: () => new GeoIngestInvalidPayloadError({ issues: [] }),
  });
  if (bytes.byteLength > GEO_DRAIN_MAX_BODY_BYTES) {
    return yield* Effect.fail(new GeoIngestPayloadTooLargeError({}));
  }
  const [first, second] = GEO_DRAIN_GZIP_MAGIC;
  if (!(bytes[0] === first && bytes[1] === second)) {
    return new TextDecoder().decode(bytes);
  }
  return yield* Effect.try({
    try: () =>
      gunzipSync(bytes, {
        maxOutputLength: GEO_DRAIN_MAX_DECOMPRESSED_BYTES,
      }).toString("utf8"),
    catch: (cause) =>
      cause instanceof RangeError
        ? new GeoIngestPayloadTooLargeError({})
        : new GeoIngestInvalidPayloadError({ issues: [] }),
  });
});

function isAiRecord({ payload }: GeoDrainRecord): boolean {
  const { visitorType } = classifyVisitor({
    userAgent: payload.userAgent,
    referer: payload.referer,
    accept: payload.accept,
    signals: payload.signals,
  });
  return isTrackedGeoVisitorType(visitorType);
}

function isRetryable(outcome: GeoDrainRecordOutcome): boolean {
  return GEO_DRAIN_RETRYABLE_OUTCOMES.some(
    (retryable) => retryable === outcome
  );
}

function claimRequest(key: string): Promise<boolean> {
  return geoIngestRedis
    .set(key, "1", { nx: true, ex: GEO_DRAIN_DEDUPE_TTL_SECONDS })
    .then((result) => result === "OK")
    .catch(() => true);
}

function releaseRequests(keys: string[]): Promise<void> {
  if (keys.length === 0) {
    return Promise.resolve();
  }
  return geoIngestRedis
    .del(...keys)
    .then(() => undefined)
    .catch(() => undefined);
}

function toRecordOutcome(
  result: Result.Result<GeoIngestResult, GeoIngestError>
): GeoDrainRecordOutcome {
  if (result._tag === "Success") {
    return result.success.outcome;
  }
  switch (result.failure._tag) {
    case "GeoIngestRateLimited":
      return "rate_limited";
    case "GeoIngestInvalidPayload":
    case "GeoIngestUnparseableUrl":
      return "invalid";
    default:
      return "failed";
  }
}

const ingestRecord = Effect.fn("geoDrain.record")(function* (
  identity: GeoIngestIdentity,
  record: GeoDrainRecord,
  defer: GeoIngestDefer,
  buffer: GeoIngestBuffer,
  claimed: string[]
) {
  const key = `${GEO_DRAIN_DEDUPE_KEY_PREFIX}:${identity.organizationId}:${identity.projectId ?? "-"}:${record.dedupeKey}`;
  if (!(yield* Effect.promise(() => claimRequest(key)))) {
    return "duplicate" satisfies GeoDrainRecordOutcome;
  }
  const outcome = toRecordOutcome(
    yield* Effect.result(
      runGeoEnvelopeIngest(identity, record.payload, defer, buffer)
    )
  );
  if (isRetryable(outcome)) {
    yield* Effect.promise(() => releaseRequests([key]));
  } else {
    claimed.push(key);
  }
  return outcome;
});

export const runGeoDrainIngest = Effect.fn("geoDrain.run")(function* (
  request: Request,
  provider: GeoDrainProvider,
  defer: GeoIngestDefer,
  buffer?: GeoIngestBuffer
) {
  const identity = yield* readDrainIdentity(request);
  const lines = parseDrainLines(yield* readDrainBody(request));
  const records = toGeoDrainRecords(provider, lines);
  const aiRecords = records.filter(isAiRecord);

  const collected: GeoTrafficEventRow[] = [];
  const target: GeoIngestBuffer = buffer ?? {
    enqueue: (event) => collected.push(event) > 0,
    expedite: () => undefined,
  };
  const pending: Parameters<GeoIngestDefer>[0][] = [];
  const recordDefer: GeoIngestDefer = buffer
    ? defer
    : (task) => {
        pending.push(task);
      };
  const claimed: string[] = [];
  const results = yield* Effect.forEach(
    aiRecords,
    (record) => ingestRecord(identity, record, recordDefer, target, claimed),
    { concurrency: GEO_DRAIN_CONCURRENCY }
  );

  if (collected.length > 0) {
    const written = yield* Effect.result(writeGeoTrafficEvents(collected));
    if (written._tag === "Failure") {
      yield* Effect.promise(() => releaseRequests(claimed));
      return yield* Effect.fail(written.failure);
    }
    yield* Effect.sync(() =>
      defer(async () => announceGeoTrafficRows(collected))
    );
  }
  yield* Effect.sync(() => {
    for (const task of pending) {
      defer(task);
    }
  });

  const retryable = results.filter(isRetryable).length;
  if (retryable > 0) {
    return yield* Effect.fail(
      new GeoIngestFailedError({
        cause: new Error(`${retryable} drain records need a retry`),
      })
    );
  }
  return {
    provider,
    organizationId: identity.organizationId,
    projectId: identity.projectId ?? "",
    lines: lines.length,
    requests: records.length,
    aiRequests: aiRecords.length,
    ingested: results.filter((outcome) => outcome === "ingested").length,
    duplicates: results.filter((outcome) => outcome === "duplicate").length,
  } satisfies GeoDrainSummary;
});
