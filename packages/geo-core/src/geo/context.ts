import { withRateLimitRetry } from "@notra/ai/utils/rate-limit-retry";
import { GEO_CHECK_GROUNDING_MAX_SOURCES } from "@notra/db/constants/geo-checks";
import { requireApiKey } from "@notra/utils/require-api-key";
import { Effect, Stream } from "effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";

import {
  GEO_CONTEXT_API_KEY_ENV,
  GEO_CONTEXT_API_URL,
  GEO_CONTEXT_MAX_RESPONSE_BYTES,
  GEO_CONTEXT_PARSER_VERSION,
  GEO_CONTEXT_SOURCE_CONCURRENCY,
  GEO_CONTEXT_TIMEOUT_MS,
} from "../constants/geo-context";
import { geoContextResponseSchema } from "../schemas/geo-context";
import type { GeoEngineAnswer } from "../types/geo";
import {
  buildGeoContextRequest,
  isGeoContextEngine,
} from "../utils/geo-context";
import { parseGeoContextCapture } from "../utils/geo-context-answer";
import { resolveGeoContextSource } from "../utils/geo-context-source";
import { getReferenceDomain } from "../utils/reference-display";
import { GeoScanError } from "./errors";

/** Only 429s are retried (per Retry-After): submitting a consumer prompt is a paid, non-idempotent operation. */
export const askGeoContextAnswer = Effect.fn("geo.askContextAnswer")(function* (
  engine: string,
  prompt: string,
  language: string
) {
  if (!isGeoContextEngine(engine)) {
    return yield* Effect.fail(
      new GeoScanError({ message: "Unsupported Context engine" })
    );
  }
  return yield* Effect.gen(function* () {
    const response = yield* Effect.gen(function* () {
      const apiKey = yield* Effect.try(() =>
        requireApiKey(GEO_CONTEXT_API_KEY_ENV)
      );
      const client = withRateLimitRetry(yield* HttpClient.HttpClient);
      const result = yield* client
        .execute(
          HttpClientRequest.post(GEO_CONTEXT_API_URL).pipe(
            HttpClientRequest.bearerToken(apiKey),
            HttpClientRequest.bodyJsonUnsafe(
              buildGeoContextRequest(engine, prompt, language)
            )
          )
        )
        .pipe(Effect.flatMap(HttpClientResponse.filterStatusOk));
      let bytes = 0;
      const body = yield* result.stream.pipe(
        Stream.tap((chunk) => {
          bytes += chunk.byteLength;
          return bytes > GEO_CONTEXT_MAX_RESPONSE_BYTES
            ? Effect.fail(
                new GeoScanError({
                  message: "Context response exceeds the capture size limit",
                })
              )
            : Effect.void;
        }),
        Stream.decodeText,
        Stream.mkString
      );
      return yield* Effect.try(() =>
        geoContextResponseSchema.parse(JSON.parse(body))
      );
    }).pipe(
      Effect.provide(FetchHttpClient.layer),
      Effect.provideService(FetchHttpClient.Fetch, globalThis.fetch),
      Effect.mapError(
        (cause) =>
          new GeoScanError({
            message: `Engine ${engine} failed to capture an answer through Context`,
            cause,
          })
      )
    );
    const capture = yield* Effect.try({
      try: () => parseGeoContextCapture(engine, prompt, response),
      catch: (cause) =>
        new GeoScanError({
          message: `Engine ${engine} returned an invalid Context capture`,
          cause,
        }),
    });
    const resolved = yield* Effect.forEach(
      capture.sources.slice(0, GEO_CHECK_GROUNDING_MAX_SOURCES),
      (source) =>
        Effect.tryPromise({
          try: async (signal) => ({
            ...source,
            url: await resolveGeoContextSource(source.url, signal),
          }),
          catch: (cause) =>
            new GeoScanError({
              message: `Engine ${engine} returned an unresolved Context citation`,
              cause,
            }),
        }),
      { concurrency: GEO_CONTEXT_SOURCE_CONCURRENCY }
    );
    const sources = [
      ...new Map(resolved.map((source) => [source.url, source])).values(),
    ];
    const answer: GeoEngineAnswer = {
      text: capture.text,
      sources,
      grounding: {
        queries: [],
        sources: sources.map((source) => ({
          ...source,
          title: source.title || new URL(source.url).hostname,
          domain:
            getReferenceDomain(source.url) ?? new URL(source.url).hostname,
        })),
        capture: {
          provider: "context.dev",
          parserVersion: GEO_CONTEXT_PARSER_VERSION,
          requestId: response.request_id,
        },
      },
      finishReason: capture.absent ? null : "stop",
      zdrEnforced: false,
      ...(capture.absent ? { absent: true } : {}),
    };
    return answer;
  }).pipe(
    Effect.timeoutOrElse({
      duration: GEO_CONTEXT_TIMEOUT_MS,
      orElse: () =>
        Effect.fail(
          new GeoScanError({
            message: `Engine ${engine} Context capture timed out`,
            timedOut: true,
          })
        ),
    })
  );
});
