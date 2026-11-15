import type { GeoDrainSummary } from "../types/ingest";
import { logGeoFailure } from "../utils/geo-log";
import type { GeoIngestError } from "./errors";

const NO_STORE = { "Cache-Control": "no-store" };

const HTTP_UNAUTHORIZED = 401;
const HTTP_BAD_REQUEST = 400;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_BAD_GATEWAY = 502;
const HTTP_ACCEPTED = 202;
const HTTP_OK = 200;
const HTTP_PAYLOAD_TOO_LARGE = 413;

export function toGeoIngestAcceptedResponse(): Response {
  return Response.json(
    { ok: true },
    { status: HTTP_ACCEPTED, headers: NO_STORE }
  );
}

export function toGeoDrainAcceptedResponse(
  summary: Pick<GeoDrainSummary, "requests" | "ingested">
): Response {
  return Response.json(
    { ok: true, requests: summary.requests, ingested: summary.ingested },
    { status: HTTP_OK, headers: NO_STORE }
  );
}

export function toGeoIngestErrorResponse(failure: GeoIngestError): Response {
  switch (failure._tag) {
    case "GeoIngestMissingToken":
    case "GeoIngestInvalidToken":
      return Response.json(
        { error: "Unauthorized" },
        { status: HTTP_UNAUTHORIZED, headers: NO_STORE }
      );
    case "GeoIngestRateLimited":
      return Response.json(
        { error: "Rate limit exceeded" },
        { status: HTTP_TOO_MANY_REQUESTS, headers: NO_STORE }
      );
    case "GeoIngestInvalidPayload":
      return Response.json(
        { error: "Invalid payload" },
        { status: HTTP_BAD_REQUEST, headers: NO_STORE }
      );
    case "GeoIngestPayloadTooLarge":
      return Response.json(
        { error: "Payload too large" },
        { status: HTTP_PAYLOAD_TOO_LARGE, headers: NO_STORE }
      );
    case "GeoIngestUnparseableUrl":
      return Response.json(
        { error: "Invalid url" },
        { status: HTTP_BAD_REQUEST, headers: NO_STORE }
      );
    default:
      logGeoFailure("geo.ingest.failed", "Ingest failed", failure.cause, {
        tag: failure._tag,
      });
      return Response.json(
        { error: "Ingest failed" },
        { status: HTTP_BAD_GATEWAY, headers: NO_STORE }
      );
  }
}
