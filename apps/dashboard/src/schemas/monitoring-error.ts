import { Schema } from "effect";

// oxlint-disable-next-line unicorn/throw-new-error
export class MonitoringOperationError extends Schema.TaggedError<MonitoringOperationError>()(
  "MonitoringOperationError",
  {
    operation: Schema.String,
    errorName: Schema.String,
  }
) {}
