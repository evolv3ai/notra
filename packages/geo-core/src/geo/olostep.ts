import { requireApiKey } from "@notra/utils/require-api-key";
import { Effect } from "effect";
import type { output, ZodType } from "zod";

import {
  GEO_OLOSTEP_API_KEY_ENV,
  GEO_OLOSTEP_BASE_URL,
  GEO_OLOSTEP_ENGINES,
  GEO_OLOSTEP_ITEMS_PAGE_LIMIT,
  GEO_OLOSTEP_REQUEST_TIMEOUT_MS,
  GEO_OLOSTEP_TERMINAL_BATCH_STATUSES,
} from "../constants/geo-olostep";
import {
  geoOlostepAnswerSchema,
  geoOlostepBatchItemsSchema,
  geoOlostepBatchSchema,
  geoOlostepRetrieveSchema,
} from "../schemas/geo-olostep";
import type {
  GeoOlostepBatchRequest,
  GeoOlostepQuery,
  GeoOlostepResults,
} from "../types/geo-olostep";
import { logGeoFailure } from "../utils/geo-log";
import { geoOlostepAnswer } from "../utils/geo-olostep-answer";
import { buildGeoOlostepBatchRequests } from "../utils/geo-olostep-batches";
import { GeoOlostepError, GeoScanError } from "./errors";

function olostepRequest<S extends ZodType>(
  path: string,
  schema: S,
  init?: { method: "POST"; body: unknown }
): Effect.Effect<output<S>, GeoOlostepError> {
  return Effect.gen(function* () {
    const apiKey = yield* Effect.try({
      try: () => requireApiKey(GEO_OLOSTEP_API_KEY_ENV),
      catch: (cause) =>
        new GeoOlostepError({ message: "Olostep is not configured", cause }),
    });
    const response = yield* Effect.tryPromise({
      try: (signal) =>
        fetch(`${GEO_OLOSTEP_BASE_URL}${path}`, {
          method: init?.method ?? "GET",
          body: init ? JSON.stringify(init.body) : undefined,
          signal: AbortSignal.any([
            signal,
            AbortSignal.timeout(GEO_OLOSTEP_REQUEST_TIMEOUT_MS),
          ]),
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
        }),
      catch: (cause) =>
        new GeoOlostepError({ message: `Olostep ${path} failed`, cause }),
    });
    const body = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: (cause) =>
        new GeoOlostepError({
          message: `Olostep ${path} responded with ${response.status} and no JSON`,
          cause,
        }),
    });
    if (!response.ok) {
      return yield* Effect.fail(
        new GeoOlostepError({
          message: `Olostep ${path} responded with ${response.status}`,
          cause: body,
        })
      );
    }
    return yield* Effect.try({
      try: () => schema.parse(body),
      catch: (cause) =>
        new GeoOlostepError({
          message: `Olostep ${path} returned an unexpected shape`,
          cause,
        }),
    });
  }).pipe(Effect.withSpan("geo.olostepRequest", { attributes: { path } }));
}

/**
 * Olostep is best effort inside a scan: a failed request is logged and
 * replaced by `fallback` so the scan's other engines still run.
 */
function withGeoOlostepFallback<A>(
  event: `geo.olostep.${string}`,
  message: string,
  fallback: A,
  fields: Record<string, unknown>
) {
  return <E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, never, R> =>
    effect.pipe(
      Effect.catch((error) =>
        Effect.sync(() => {
          logGeoFailure(event, message, error, fields);
          return fallback;
        })
      )
    );
}

const submitGeoOlostepBatch = Effect.fn("geo.submitOlostepBatch")(function* (
  request: GeoOlostepBatchRequest
) {
  const batch = yield* olostepRequest("/batches", geoOlostepBatchSchema, {
    method: "POST",
    body: request.body,
  });
  return batch.id;
});

/**
 * Submits the queries at `indexes` and returns the ids of the batches that
 * were created. A rejected batch is logged and skipped so the ones already
 * running are kept; its queries come back as missing for the retry round.
 */
export const submitGeoOlostepBatches = Effect.fn("geo.submitOlostepBatches")(
  function* (queries: readonly GeoOlostepQuery[], indexes: readonly number[]) {
    const batchIds = yield* Effect.forEach(
      buildGeoOlostepBatchRequests(queries, indexes),
      (request) =>
        submitGeoOlostepBatch(request).pipe(
          withGeoOlostepFallback<string | null>(
            "geo.olostep.submit_failed",
            "Olostep batch submission failed",
            null,
            { items: request.queryIndexes.length }
          )
        ),
      { concurrency: "unbounded" }
    );
    return batchIds.filter((batchId) => batchId !== null);
  }
);

/**
 * Ids of the given batches that may still finish more items. A failed status
 * check keeps the batch pending until the wait deadline.
 */
export const pendingGeoOlostepBatches = Effect.fn("geo.pendingOlostepBatches")(
  function* (batchIds: readonly string[]) {
    const statuses = yield* Effect.forEach(
      batchIds,
      (batchId) =>
        olostepRequest(
          `/batches/${encodeURIComponent(batchId)}`,
          geoOlostepBatchSchema
        ).pipe(
          Effect.map((batch) => batch.status),
          withGeoOlostepFallback<string | null>(
            "geo.olostep.status_failed",
            "Olostep batch status check failed",
            null,
            { batchId }
          )
        ),
      { concurrency: "unbounded" }
    );
    return batchIds.filter(
      (_, index) =>
        !GEO_OLOSTEP_TERMINAL_BATCH_STATUSES.has(statuses[index] ?? "")
    );
  }
);

const listGeoOlostepBatchResults = Effect.fn("geo.listOlostepBatchResults")(
  function* (batchId: string) {
    const results: GeoOlostepResults = {};
    let cursor: string | undefined;
    for (;;) {
      const params = new URLSearchParams({
        status: "completed",
        limit: String(GEO_OLOSTEP_ITEMS_PAGE_LIMIT),
        ...(cursor ? { cursor } : {}),
      });
      const page = yield* olostepRequest(
        `/batches/${encodeURIComponent(batchId)}/items?${params}`,
        geoOlostepBatchItemsSchema
      );
      for (const item of page.items) {
        results[item.custom_id] = item.retrieve_id;
      }
      if (
        page.items.length === 0 ||
        page.cursor === null ||
        page.cursor === undefined
      ) {
        return results;
      }
      cursor = String(page.cursor);
    }
  }
);

/**
 * Result handles of every finished item across the given batches. A batch
 * whose listing fails contributes nothing, so its queries are retried.
 */
export const collectGeoOlostepResults = Effect.fn("geo.collectOlostepResults")(
  function* (batchIds: readonly string[]) {
    const pages = yield* Effect.forEach(
      batchIds,
      (batchId) =>
        listGeoOlostepBatchResults(batchId).pipe(
          withGeoOlostepFallback<GeoOlostepResults>(
            "geo.olostep.collect_failed",
            "Olostep batch results could not be listed",
            {},
            { batchId }
          )
        ),
      { concurrency: "unbounded" }
    );
    const results: GeoOlostepResults = {};
    for (const page of pages) {
      Object.assign(results, page);
    }
    return results;
  }
);

const fetchGeoOlostepAnswer = Effect.fn("geo.fetchOlostepAnswer")(function* (
  engine: string,
  retrieveId: string
) {
  const retrieved = yield* olostepRequest(
    `/retrieve?${new URLSearchParams({ retrieve_id: retrieveId, formats: "json" })}`,
    geoOlostepRetrieveSchema
  );
  const payload = yield* Effect.try({
    try: () =>
      geoOlostepAnswerSchema.parse(JSON.parse(retrieved.json_content ?? "")),
    catch: (cause) =>
      new GeoOlostepError({
        message: `Olostep result ${retrieveId} has no parsed answer`,
        cause,
      }),
  });
  return geoOlostepAnswer(payload, {
    panelSourcesCited: GEO_OLOSTEP_ENGINES[engine]?.panelSourcesCited === true,
  });
});

/**
 * Consumer apps scraped through Olostep. The batch was submitted and awaited
 * by the scan workflow; a missing handle means the item never finished.
 */
export const askGeoOlostepAnswer = Effect.fn("geo.askOlostepAnswer")(function* (
  engine: string,
  retrieveId: string | null | undefined
) {
  if (!retrieveId) {
    return yield* Effect.fail(
      new GeoScanError({
        message: `Engine ${engine} returned no result from its Olostep batch`,
      })
    );
  }
  return yield* fetchGeoOlostepAnswer(engine, retrieveId).pipe(
    Effect.mapError(
      (cause) =>
        new GeoScanError({
          message: `Engine ${engine} failed to answer`,
          cause,
        })
    )
  );
});
