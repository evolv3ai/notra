import {
  type GeoFailureWire,
  toGeoFailureWire,
} from "@notra/geo-core/geo/failure-wire";
import { remoteGeoFailureBodySchema } from "@notra/schemas/api/internal-geo";
import { rateLimitResponseSchema } from "@notra/schemas/api/responses";
import { Effect } from "effect";

import { geoCoreApiLayer } from "../lib/geo/configure";
import type {
  GeoApiRuntime,
  GeoFailure,
  GeoOutcome,
  GeoProgramError,
  RemoteGeoOperation,
} from "../types/geo";
import {
  callDashboardInternal,
  InternalDashboardError,
  InternalDashboardTimeoutError,
  SYNCHRONOUS_INTERNAL_CALL_TIMEOUT_MS,
} from "../utils/internal-workflow";
import { logError } from "../utils/logging";

function toGeoFailure(failure: GeoFailureWire): GeoFailure {
  switch (failure._tag) {
    case "GeoSuggestionNotFoundError":
      return { status: 404, error: "Suggestion not found" };
    case "GeoProjectNotFoundError":
      return { status: 404, error: "Project not found" };
    case "GeoProjectDeleteBlockedError":
      return {
        status: 409,
        error:
          failure.reason === "has_sites"
            ? "This project has hosted sites. Delete its sites before deleting the project."
            : "Cannot delete the organization's last project. Create another project first.",
      };
    case "GeoPromptNotFoundError":
      return { status: 404, error: "Prompt not found" };
    case "GeoSequenceNotFoundError":
      return { status: 404, error: "Sequence not found" };
    case "GeoContentBriefNotFoundError":
      return { status: 404, error: "Content brief not found" };
    case "GeoBrandIdentityNotFoundError":
      return { status: 404, error: "Brand identity not found" };
    case "GeoBrandIdentityMissingError":
      return {
        status: 400,
        error: "Create a brand identity before creating a project",
      };
    case "GeoSettingsMissingError":
      return {
        status: 404,
        error: "GEO settings are not configured for this project",
      };
    case "GeoSettingsDisabledError":
      return {
        status: 400,
        error: "Enable brand tracking before starting a scan",
      };
    case "GeoPromptDuplicateError":
      return { status: 409, error: "That prompt is already tracked" };
    case "GeoScanAlreadyRunningError":
      return {
        status: 409,
        error: "A scan is already running for this project",
      };
    case "GeoScanEnginesEmptyError":
      return {
        status: 400,
        error: "Select at least one available model to scan",
      };
    case "GeoCompetitorLimitError":
      return {
        status: 400,
        error:
          failure.limit === undefined
            ? "Too many competitors."
            : `Too many competitors. The limit is ${failure.limit}.`,
      };
    case "GeoSequenceRunUnavailableError":
      return {
        status: 400,
        error: "No engine is available for this project's retention policy",
      };
    case "GeoSequenceLimitError":
      return {
        status: 400,
        error: `You can have up to ${failure.limit} conversations. Remove one before adding another.`,
      };
    case "GeoWriterCreditsExhaustedError":
      return {
        status: 402,
        error: failure.message ?? "AI credits are exhausted",
      };
    case "GeoContentBriefConflictError":
      return {
        status: 409,
        error:
          "Content brief changed since expectedUpdatedAt. Fetch it again and retry.",
      };
    case "GeoContentBriefStateError":
      return {
        status: 409,
        error: `Content brief is ${failure.status ?? "in another state"} and cannot be changed`,
      };
    // These carry upstream error text (scraper, model, DB), so clients get a
    // fixed message and the original is logged (see `logsFailureDetail`).
    case "GeoDiscoveryError":
      return {
        status: 400,
        error: "We couldn't analyze that website. Check the URL and try again.",
      };
    case "GeoSequenceRunError":
      return {
        status: 400,
        error: "The conversation run failed. Please try again.",
      };
    case "GeoSettingsTrackingError":
    case "GeoWriterPlanError":
      return { status: 400, error: failure.message ?? "Invalid request" };
    case "GeoSampleDataDisabledError":
      return { status: 400, error: "Sample data is disabled" };
    case "GeoProjectCreateFailedError":
      return { status: 500, error: "Failed to create the project" };
    case "GeoSequenceCreateFailedError":
      return { status: 500, error: "Failed to create the sequence" };
    case "GeoScanStartError":
      return { status: 500, error: "Failed to start the scan" };
    case "GeoWriterStartError":
      return { status: 500, error: "Failed to start the writer" };
    default:
      return { status: 500, error: "Internal server error" };
  }
}

function logsFailureDetail(tag: string, failure: GeoFailure) {
  return (
    failure.status === 500 ||
    tag === "GeoDiscoveryError" ||
    tag === "GeoSequenceRunError"
  );
}

function toGeoProgramFailure(error: GeoProgramError): GeoFailure {
  switch (error._tag) {
    case "GeoSelectionInvalidError":
    case "AgentReadinessTargetMissingError":
    case "AgentReadinessApiError":
      return { status: 400, error: error.message };
    case "GeoScanNotFoundError":
      return { status: 404, error: "Scan not found" };
    case "AgentReadinessClaimError":
    case "AgentReadinessStampError":
    case "AgentReadinessStartError":
      return { status: 500, error: "Internal server error" };
    default:
      return toGeoFailure(toGeoFailureWire(error));
  }
}

export async function runGeoEffect<A, E extends GeoProgramError>(
  label: string,
  effect: Effect.Effect<A, E, GeoApiRuntime>
): Promise<GeoOutcome<A>> {
  try {
    const outcome = await Effect.runPromise(
      Effect.result(Effect.provide(effect, geoCoreApiLayer))
    );

    if (outcome._tag === "Failure") {
      const failure = toGeoProgramFailure(outcome.failure);
      if (logsFailureDetail(outcome.failure._tag, failure)) {
        logError(`[GEO] ${label}`, outcome.failure);
      }
      return { ok: false, failure };
    }

    return { ok: true, value: outcome.success };
  } catch (error) {
    logError(`[GEO] ${label} (defect)`, error);
    return {
      ok: false,
      failure: { status: 500, error: "Internal server error" },
    };
  }
}

function readRemoteFailure(detail: string): GeoFailureWire | null {
  try {
    const parsed = remoteGeoFailureBodySchema.safeParse(JSON.parse(detail));
    return parsed.success ? parsed.data.failure : null;
  } catch {
    return null;
  }
}

const REMOTE_RATE_LIMIT_MESSAGE = "Rate limit exceeded. Retry later.";

function readRemoteRateLimit(detail: string): GeoFailure["rateLimit"] {
  try {
    const parsed = rateLimitResponseSchema.safeParse(JSON.parse(detail));
    if (!parsed.success) {
      return undefined;
    }
    const { limit, remaining, reset } = parsed.data;
    return { limit, remaining, reset };
  } catch {
    return undefined;
  }
}

export async function runRemoteGeoEffect<A>(
  operation: RemoteGeoOperation<A>,
  url: string,
  payload: unknown
): Promise<GeoOutcome<A>> {
  const { label } = operation;
  try {
    return {
      ok: true,
      value: await callDashboardInternal(
        url,
        payload,
        operation.responseSchema,
        SYNCHRONOUS_INTERNAL_CALL_TIMEOUT_MS
      ),
    };
  } catch (error) {
    if (error instanceof InternalDashboardTimeoutError) {
      logError(`[GEO] ${label} (remote timeout)`, error);
      return {
        ok: false,
        failure: { status: 409, error: operation.timeoutMessage },
      };
    }

    // The dashboard enforces its own per-org budget for these routes, shared
    // with the dashboard UI, so it can refuse even after the API's own limiter
    // let the request through.
    if (error instanceof InternalDashboardError && error.status === 429) {
      return {
        ok: false,
        failure: {
          status: 429,
          error: REMOTE_RATE_LIMIT_MESSAGE,
          rateLimit: readRemoteRateLimit(error.body),
        },
      };
    }

    const remote =
      error instanceof InternalDashboardError
        ? readRemoteFailure(error.body)
        : null;
    if (remote) {
      const failure = toGeoFailure(remote);
      if (logsFailureDetail(remote._tag, failure)) {
        logError(`[GEO] ${label} (remote)`, error);
      }
      return { ok: false, failure };
    }

    logError(`[GEO] ${label} (remote)`, error);
    return {
      ok: false,
      failure: { status: 500, error: "Internal server error" },
    };
  }
}
