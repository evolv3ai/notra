import { geoLog } from "@notra/ai/evlog";
import type { GeoLogEvent } from "@notra/ai/types/evlog";
import { Effect } from "effect";

import {
  GEO_INGEST_DROPPED_LOG_SAMPLE_RATE,
  GEO_INGEST_ERROR_MESSAGE_MAX_LENGTH,
} from "../constants/ingest";
import type { GeoDrainProvider } from "../types/geo";
import type {
  GeoIngestBuffer,
  GeoIngestDefer,
  GeoIngestHandled,
  GeoIngestResult,
} from "../types/ingest";
import {
  getGeoIngestRegion,
  getGeoIngestRuntime,
} from "../utils/ingest-runtime";
import { runGeoDrainIngest } from "./drain";
import { type GeoIngestError, GeoIngestFailedError } from "./errors";
import { runGeoIngest } from "./pipeline";
import {
  toGeoDrainAcceptedResponse,
  toGeoIngestAcceptedResponse,
  toGeoIngestErrorResponse,
} from "./response";

type IngestLogFields = GeoIngestHandled["fields"];

const FAILURE_REASONS = {
  GeoIngestMissingToken: "missing_token",
  GeoIngestInvalidToken: "invalid_token",
  GeoIngestRateLimited: "rate_limited",
  GeoIngestInvalidPayload: "invalid_payload",
  GeoIngestUnparseableUrl: "invalid_url",
  GeoIngestPayloadTooLarge: "payload_too_large",
  GeoIngestFailed: "failed",
} as const satisfies Record<GeoIngestError["_tag"], string>;

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, GEO_INGEST_ERROR_MESSAGE_MAX_LENGTH);
}

function describeResult(result: GeoIngestResult): IngestLogFields {
  return { ...result, projectId: result.projectId ?? "" };
}

function describeFailure(failure: GeoIngestError): IngestLogFields {
  const fields: IngestLogFields = {
    outcome: failure._tag === "GeoIngestFailed" ? "failed" : "rejected",
    reason: FAILURE_REASONS[failure._tag],
  };
  if (failure._tag === "GeoIngestRateLimited") {
    fields.organizationId = failure.organizationId;
  }
  if (failure._tag === "GeoIngestFailed") {
    fields.errorMessage = errorMessage(failure.cause);
    fields.stage = failure.stage;
  }
  if (
    failure._tag === "GeoIngestInvalidToken" ||
    failure._tag === "GeoIngestFailed"
  ) {
    fields.organizationId = failure.organizationId;
    fields.projectId = failure.projectId;
    fields.siteId = failure.siteId;
  }
  if (failure._tag === "GeoIngestInvalidToken") {
    fields.authReason = failure.authReason;
  }
  return fields;
}

function sampleRateFor(fields: IngestLogFields): number {
  return fields.outcome === "dropped" && fields.reason === "visitor_type"
    ? GEO_INGEST_DROPPED_LOG_SAMPLE_RATE
    : 1;
}

async function handleLogged<A>(
  event: GeoLogEvent["event"],
  program: Effect.Effect<A, GeoIngestError>,
  onSuccess: (value: A) => GeoIngestHandled
): Promise<Response> {
  const startedAt = performance.now();
  let handled: GeoIngestHandled;

  try {
    const outcome = await Effect.runPromise(Effect.result(program));
    handled =
      outcome._tag === "Failure"
        ? {
            response: toGeoIngestErrorResponse(outcome.failure),
            fields: describeFailure(outcome.failure),
          }
        : onSuccess(outcome.success);
  } catch (error) {
    handled = {
      response: toGeoIngestErrorResponse(
        new GeoIngestFailedError({ cause: error })
      ),
      fields: {
        outcome: "failed",
        reason: "defect",
        errorMessage: errorMessage(error),
      },
    };
  }

  const { response, fields } = handled;
  const sampleRate = sampleRateFor(fields);
  if (sampleRate >= 1 || Math.random() < sampleRate) {
    geoLog.info({
      event,
      ...fields,
      status: response.status,
      durationMs: Math.round(performance.now() - startedAt),
      weight: Math.round(1 / sampleRate),
      runtime: getGeoIngestRuntime(),
      region: getGeoIngestRegion(),
    });
  }

  return response;
}

/**
 * Runs one ingest request and emits exactly one `geo.ingest` event for it,
 * whatever the outcome, so Axiom can chart throughput, status mix and latency
 * for the dashboard route and the ingest service alike.
 */
export function handleGeoIngestRequest(
  request: Request,
  defer: GeoIngestDefer,
  buffer?: GeoIngestBuffer
): Promise<Response> {
  return handleLogged(
    "geo.ingest",
    runGeoIngest(request, defer, buffer),
    (result) => ({
      response: toGeoIngestAcceptedResponse(),
      fields: describeResult(result),
    })
  );
}

export function handleGeoDrainRequest(
  request: Request,
  provider: GeoDrainProvider,
  defer: GeoIngestDefer,
  buffer?: GeoIngestBuffer
): Promise<Response> {
  return handleLogged(
    "geo.ingest.drain",
    runGeoDrainIngest(request, provider, defer, buffer),
    (summary) => ({
      response: toGeoDrainAcceptedResponse(summary),
      fields: { ...summary, outcome: "ingested" },
    })
  );
}
