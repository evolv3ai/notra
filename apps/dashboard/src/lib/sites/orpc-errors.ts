import { SiteProviderRequestError } from "@notra/sites-server/errors/provider";
import {
  InthError,
  SiteHostConflictError,
  SiteInputError,
  SiteNotBuildableError,
  SitePermanentBuildError,
  SitePlanLimitError,
  SitePublishConflictError,
  SitesNotConfiguredError,
} from "@notra/sites-server/errors/sites";

import {
  badGateway,
  badRequest,
  conflict,
  notFound,
  paymentRequired,
  serviceUnavailable,
} from "@/lib/orpc/utils/errors";

export function toSitesOrpcError(error: unknown): unknown {
  if (error instanceof SitePlanLimitError) {
    return paymentRequired(error.message, { limit: error.limit });
  }
  if (error instanceof SiteInputError) {
    if (error.message === "Branch not found") {
      return notFound(error.message);
    }
    return badRequest(
      error.message,
      error.field ? { field: error.field } : undefined
    );
  }
  if (
    error instanceof SitePermanentBuildError ||
    error instanceof SiteNotBuildableError
  ) {
    return badRequest(error.message);
  }
  if (error instanceof SitePublishConflictError) {
    return conflict(error.message, { paths: error.paths });
  }
  if (error instanceof SiteHostConflictError) {
    return conflict(error.message);
  }
  if (error instanceof InthError) {
    switch (error.code) {
      case "not_configured":
        return serviceUnavailable(error.message);
      case "project_not_found":
        return notFound(error.message);
      case "no_backend":
        return badRequest(error.message, { code: error.code });
      case "api_error":
        return badGateway(error.message);
      default:
        return conflict(error.message, { code: error.code });
    }
  }
  if (
    error instanceof SiteProviderRequestError &&
    error.provider === "cloudflare"
  ) {
    return badGateway(
      `Couldn't register the domain with Cloudflare. ${error.message}. Try again in a few minutes.`
    );
  }
  if (error instanceof SitesNotConfiguredError) {
    return serviceUnavailable(
      `Notra Sites is not configured on this environment: ${error.message}`
    );
  }
  return error;
}

/** A message for one failed row of a bulk import, safe to show to the user. */
export function bulkImportErrorMessage(error: unknown): string {
  if (
    error instanceof SiteInputError ||
    error instanceof SiteHostConflictError ||
    error instanceof SitePlanLimitError
  ) {
    return error.message;
  }
  console.warn("sites.bulk_import_failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  return "Could not create this site";
}
