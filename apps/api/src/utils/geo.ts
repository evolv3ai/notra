import { refreshGeoContentGapsBestEffort } from "@notra/geo-core/geo/gaps";
import { Effect } from "effect";
import type { Context } from "hono";

import type { ApiEnv } from "../types/env";
import type { GeoFailure, GeoOutcome } from "../types/geo";
import type { GeoRequestContext } from "../types/geo-context";
import { setRatelimitHeaders } from "./ratelimit";

export function geoErrorResponse(c: Context, failure: GeoFailure) {
  switch (failure.status) {
    case 400:
      return c.json({ error: failure.error }, 400);
    case 402:
      return c.json({ error: failure.error }, 402);
    case 404:
      return c.json({ error: failure.error }, 404);
    case 409:
      return c.json({ error: failure.error }, 409);
    case 503:
      return c.json({ error: failure.error }, 503);
    default:
      return c.json({ error: failure.error }, 500);
  }
}

// Used when the dashboard sends a 429 without a readable budget, e.g. while
// the API and dashboard deploys are briefly out of step.
const REMOTE_RATE_LIMIT_FALLBACK_RETRY_MS = 60_000;

/**
 * `geoErrorResponse` plus 429, for the routes that forward to the dashboard and
 * declare a 429 response. Kept apart because the typed OpenAPI handlers reject
 * a 429 on routes that do not declare one.
 */
export function geoRemoteErrorResponse(c: Context, failure: GeoFailure) {
  if (failure.status !== 429) {
    return geoErrorResponse(c, failure);
  }
  const rateLimit = failure.rateLimit ?? {
    limit: 1,
    remaining: 0,
    reset: Date.now() + REMOTE_RATE_LIMIT_FALLBACK_RETRY_MS,
  };
  const retryAfter = setRatelimitHeaders(c, rateLimit);
  c.header("Retry-After", String(retryAfter));
  return c.json({ ...rateLimit, error: failure.error }, 429);
}

export function attachGeoOrganization<T>(
  organization: GeoRequestContext["organization"],
  body: T
): T & { organization: GeoRequestContext["organization"] } {
  return { ...body, organization };
}

export function geoOutcomeResponse<A, S extends 200 | 201 | 202>(
  c: Context<ApiEnv>,
  outcome: GeoOutcome<A>,
  status: S
): ReturnType<typeof geoErrorResponse> | ReturnType<typeof respond<A, S>>;
export function geoOutcomeResponse<A, B, S extends 200 | 201 | 202>(
  c: Context<ApiEnv>,
  outcome: GeoOutcome<A>,
  status: S,
  // Runs outside the Effect so a throwing normalizer still reaches app.onError.
  toBody: (value: A) => B
): ReturnType<typeof geoErrorResponse> | ReturnType<typeof respond<B, S>>;
export function geoOutcomeResponse<A, S extends 200 | 201 | 202>(
  c: Context<ApiEnv>,
  outcome: GeoOutcome<A>,
  status: S,
  toBody?: (value: A) => unknown
) {
  if (!outcome.ok) {
    return geoErrorResponse(c, outcome.failure);
  }
  return respond(c, toBody ? toBody(outcome.value) : outcome.value, status);
}

function respond<A, S extends 200 | 201 | 202>(
  c: Context<ApiEnv>,
  value: A,
  status: S
) {
  return c.json(
    attachGeoOrganization(c.get("geo").organization, value),
    status
  );
}

export function refreshGeoGapsAfter(scope: {
  readonly organizationId: string;
  readonly projectId: string;
}) {
  return <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(Effect.tap(() => refreshGeoContentGapsBestEffort(scope)));
}
