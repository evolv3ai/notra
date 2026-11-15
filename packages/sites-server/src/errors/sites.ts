import { SITE_PLAN_LIMIT_MESSAGES } from "../constants/plan-limits";
import type { InthErrorCode } from "../types/inth";
import type { SitePlanLimit } from "../types/plan-limits";
import type { SiteInputField } from "../types/sites";

export class SitesNotConfiguredError extends Error {
  readonly name = "SitesNotConfiguredError";
}

export class SiteInputError extends Error {
  readonly name = "SiteInputError";
  readonly field: SiteInputField | null;

  constructor(message: string, options?: { field?: SiteInputField }) {
    super(message);
    this.field = options?.field ?? null;
  }
}

export class SitePlanLimitError extends Error {
  readonly name = "SitePlanLimitError";
  readonly limit: SitePlanLimit;

  constructor(limit: SitePlanLimit) {
    super(SITE_PLAN_LIMIT_MESSAGES[limit]);
    this.limit = limit;
  }
}

export class SiteNotBuildableError extends Error {
  readonly name = "SiteNotBuildableError";
}

export class SiteActivationContentionError extends Error {
  readonly name = "SiteActivationContentionError";
}

export class SitePublishConflictError extends Error {
  readonly name = "SitePublishConflictError";
  readonly paths: string[];

  constructor(paths: string[], message: string) {
    super(message);
    this.paths = paths;
  }
}

export class SiteHostConflictError extends Error {
  readonly name = "SiteHostConflictError";
}

export class R2PreconditionFailedError extends Error {
  readonly name = "R2PreconditionFailedError";
}

export class SitePermanentBuildError extends Error {
  readonly name = "SitePermanentBuildError";
}

export class UnsafeArchiveError extends SitePermanentBuildError {}

export class InthError extends Error {
  readonly name = "InthError";
  readonly code: InthErrorCode;

  constructor(code: InthErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}
