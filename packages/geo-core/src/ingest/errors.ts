import { Data } from "effect";
import type { core } from "zod";

import type {
  GeoIngestAuthContext,
  GeoIngestAuthLookupStage,
  GeoIngestAuthRejectionReason,
} from "../types/ingest";

export class GeoIngestMissingTokenError extends Data.TaggedError(
  "GeoIngestMissingToken"
)<Record<string, never>> {}

export class GeoIngestInvalidTokenError extends Data.TaggedError(
  "GeoIngestInvalidToken"
)<
  GeoIngestAuthContext & {
    readonly authReason: GeoIngestAuthRejectionReason;
  }
> {}

export class GeoIngestRateLimitedError extends Data.TaggedError(
  "GeoIngestRateLimited"
)<{
  readonly organizationId: string;
}> {}

export class GeoIngestInvalidPayloadError extends Data.TaggedError(
  "GeoIngestInvalidPayload"
)<{
  readonly issues: readonly core.$ZodIssue[];
}> {}

export class GeoIngestUnparseableUrlError extends Data.TaggedError(
  "GeoIngestUnparseableUrl"
)<{
  readonly url: string;
}> {}

export class GeoIngestPayloadTooLargeError extends Data.TaggedError(
  "GeoIngestPayloadTooLarge"
)<Record<string, never>> {}

export class GeoIngestFailedError extends Data.TaggedError("GeoIngestFailed")<
  GeoIngestAuthContext & {
    readonly cause: unknown;
    readonly stage?: GeoIngestAuthLookupStage;
  }
> {}

export type GeoIngestError =
  | GeoIngestMissingTokenError
  | GeoIngestInvalidTokenError
  | GeoIngestRateLimitedError
  | GeoIngestInvalidPayloadError
  | GeoIngestUnparseableUrlError
  | GeoIngestPayloadTooLargeError
  | GeoIngestFailedError;
