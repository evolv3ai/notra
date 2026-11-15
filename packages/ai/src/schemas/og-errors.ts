import { Schema } from "effect";

// oxlint-disable-next-line unicorn/throw-new-error -- TaggedError is a class factory, not an Error constructor.
export class OgQualityError extends Schema.TaggedError<OgQualityError>()(
  "OgQualityError",
  {
    message: Schema.String,
  }
) {}

// oxlint-disable-next-line unicorn/throw-new-error -- TaggedError is a class factory, not an Error constructor.
export class OgProviderError extends Schema.TaggedError<OgProviderError>()(
  "OgProviderError",
  {
    cause: Schema.Defect(),
  }
) {}

// oxlint-disable-next-line unicorn/throw-new-error -- TaggedError is a class factory, not an Error constructor.
export class OgPersistenceError extends Schema.TaggedError<OgPersistenceError>()(
  "OgPersistenceError",
  {
    operation: Schema.String,
    cause: Schema.Defect(),
  }
) {}

// oxlint-disable-next-line unicorn/throw-new-error -- TaggedError is a class factory, not an Error constructor.
export class OgAccountingError extends Schema.TaggedError<OgAccountingError>()(
  "OgAccountingError",
  {
    cause: Schema.Defect(),
  }
) {}
