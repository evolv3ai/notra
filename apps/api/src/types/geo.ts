import type {
  GeoEntitlementService,
  GeoCodingAgentAccessService,
  GeoGenerationService,
  GeoWorkflowService,
  AgentReadinessNetwork,
  GeoModelService,
  GeoSearchConsoleService,
} from "@notra/geo-core/deps";
import type { GeoRouterError } from "@notra/geo-core/geo/errors";
import type {
  AgentReadinessApiError,
  AgentReadinessClaimError,
  AgentReadinessStampError,
  AgentReadinessStartError,
  AgentReadinessTargetMissingError,
} from "@notra/geo-core/schemas/agent-readiness-errors";
import type { ZodType } from "zod";

import type {
  GeoScanNotFoundError,
  GeoSelectionInvalidError,
} from "../errors/geo";

type GeoErrorStatus = 400 | 402 | 404 | 409 | 429 | 500 | 503;

export interface GeoFailure {
  readonly status: GeoErrorStatus;
  readonly error: string;
  /** Set with status 429 when the dashboard's shared org budget is spent. */
  readonly rateLimit?: {
    readonly limit: number;
    readonly remaining: number;
    readonly reset: number;
  };
}

export type GeoOutcome<A> =
  | { readonly ok: true; readonly value: A }
  | { readonly ok: false; readonly failure: GeoFailure };

export type GeoApiRuntime =
  | AgentReadinessNetwork
  | GeoModelService
  | GeoSearchConsoleService
  | GeoEntitlementService
  | GeoCodingAgentAccessService
  | GeoGenerationService
  | GeoWorkflowService;

type AgentReadinessProgramError =
  | AgentReadinessApiError
  | AgentReadinessClaimError
  | AgentReadinessStampError
  | AgentReadinessStartError
  | AgentReadinessTargetMissingError;

export type GeoProgramError =
  | GeoRouterError
  | GeoSelectionInvalidError
  | AgentReadinessProgramError
  | GeoScanNotFoundError;

export interface RemoteGeoOperation<A> {
  readonly label: string;
  readonly path: string;
  readonly responseSchema: ZodType<A>;
  readonly timeoutMessage: string;
  readonly unavailableMessage: string;
}
