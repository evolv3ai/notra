/* oxlint-disable unicorn/throw-new-error -- Schema.TaggedError is a curried class factory, not a constructor. */
import { Schema } from "effect";

/** The host could not hand a run to its workflow engine. */
export class GeoWorkflowStartError extends Schema.TaggedError<GeoWorkflowStartError>()(
  "GeoWorkflowStartError",
  { cause: Schema.Defect() }
) {}

/** The host's billing gate, check or settlement failed (not a denial). */
export class GeoBillingError extends Schema.TaggedError<GeoBillingError>()(
  "GeoBillingError",
  { cause: Schema.Defect() }
) {}

export class GeoGenerationTrackingError extends Schema.TaggedError<GeoGenerationTrackingError>()(
  "GeoGenerationTrackingError",
  { cause: Schema.Defect() }
) {}
