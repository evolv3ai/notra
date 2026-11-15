import {
  HTTP_NOT_FOUND,
  HTTP_PAYMENT_REQUIRED,
  HTTP_SERVER_ERROR_MIN,
  HTTP_UNAUTHORIZED,
  NO_TRAINING_PROVIDER_ERROR_PATTERN,
  OPENROUTER_NO_ZDR_ENDPOINT_PATTERN,
  RETRYABLE_STATUS_CODES,
  ZDR_ERROR_PATTERN,
  ZDR_REJECTION_STATUS_CODES,
} from "@notra/ai/constants/router";
import type { FallbackReason } from "@notra/ai/types/router";

import { NoCompliantRouteError } from "./errors";

export function readStatusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  const record = error as Record<string, unknown>;
  const candidate = record.statusCode ?? record.status;
  return typeof candidate === "number" ? candidate : undefined;
}

function readBodyText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value !== "object" || value === null) {
    return "";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

export function readMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (typeof error !== "object" || error === null) {
    return "";
  }
  const record = error as Record<string, unknown>;
  const parts = [
    error instanceof Error ? error.message : "",
    readBodyText(record.response),
    readBodyText(record.responseBody),
  ];
  return parts.filter((part) => part.length > 0).join(" ");
}

function readIsRetryable(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  return (error as Record<string, unknown>).isRetryable === true;
}

/**
 * Decide whether a failed upstream call may be retried on the other gateway
 * and why. Returns undefined for errors that must surface to the caller
 * (validation errors, aborts, prompt-level client errors, ...).
 */
export function classifyUpstreamFailure(
  error: unknown
): FallbackReason | undefined {
  if (error instanceof NoCompliantRouteError) {
    return "non-compliant";
  }
  if (error instanceof Error && error.name === "AbortError") {
    return undefined;
  }
  const status = readStatusCode(error);
  if (status === HTTP_PAYMENT_REQUIRED) {
    return "no-credits";
  }
  if (status === HTTP_UNAUTHORIZED) {
    // Rejected credentials (expired/revoked key) fail every model on the
    // gateway account: try the other gateway instead of surfacing the 401.
    return "auth-failure";
  }
  if (NO_TRAINING_PROVIDER_ERROR_PATTERN.test(readMessage(error))) {
    return "non-compliant";
  }
  if (
    status !== undefined &&
    ZDR_REJECTION_STATUS_CODES.has(status) &&
    ZDR_ERROR_PATTERN.test(readMessage(error))
  ) {
    // The gateway refused to honour the zero-data-retention requirement:
    // Vercel answers 400 when no ZDR provider serves the model and 403 when
    // the team plan lacks ZDR. Either way the route is not compliant.
    return "non-compliant";
  }
  if (
    status === HTTP_NOT_FOUND &&
    OPENROUTER_NO_ZDR_ENDPOINT_PATTERN.test(readMessage(error))
  ) {
    // OpenRouter found the model but no host satisfies the ZDR data policy.
    return "non-compliant";
  }
  if (status === HTTP_NOT_FOUND) {
    return "unsupported-model";
  }
  if (
    status !== undefined &&
    (status >= HTTP_SERVER_ERROR_MIN || RETRYABLE_STATUS_CODES.has(status))
  ) {
    return "upstream-error";
  }
  if (readIsRetryable(error)) {
    return "upstream-error";
  }
  if (status === undefined && error instanceof TypeError) {
    // fetch() network failures surface as TypeError without a status.
    return "upstream-error";
  }
  return undefined;
}
