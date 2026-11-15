import { Schema } from "effect";

export class FeedbackOrganizationNotFoundError extends Schema.TaggedError<FeedbackOrganizationNotFoundError>()(
  "FeedbackOrganizationNotFoundError",
  {}
) {}

export class FeedbackProjectNotFoundError extends Schema.TaggedError<FeedbackProjectNotFoundError>()(
  "FeedbackProjectNotFoundError",
  {}
) {}

export class FeedbackNotFoundError extends Schema.TaggedError<FeedbackNotFoundError>()(
  "FeedbackNotFoundError",
  {}
) {}

export class FeedbackIdempotencyConflictError extends Schema.TaggedError<FeedbackIdempotencyConflictError>()(
  "FeedbackIdempotencyConflictError",
  {}
) {}

export class FeedbackQuotaExceededError extends Schema.TaggedError<FeedbackQuotaExceededError>()(
  "FeedbackQuotaExceededError",
  {}
) {}

export class FeedbackDatabaseError extends Schema.TaggedError<FeedbackDatabaseError>()(
  "FeedbackDatabaseError",
  { cause: Schema.Defect() }
) {}
