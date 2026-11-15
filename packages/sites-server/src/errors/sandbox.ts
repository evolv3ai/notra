import { Schema } from "effect";

const taggedError = Schema.TaggedError;

export class SandboxRequestError extends taggedError<SandboxRequestError>()(
  "SandboxRequestError",
  {
    operation: Schema.String,
    status: Schema.NullOr(Schema.Number),
    message: Schema.String,
    responseBody: Schema.optional(Schema.String),
    requestId: Schema.optional(Schema.String),
  }
) {}
