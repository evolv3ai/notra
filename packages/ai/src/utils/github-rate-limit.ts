import type { ErrorWithStatus } from "@notra/ai/types/tools";
import { parseRetryAfterMs } from "@notra/utils/retry-after";

const GITHUB_PRIMARY_RATE_LIMIT_MESSAGE =
  "GitHub API rate limit reached. Please retry later.";

function getHeaderCaseInsensitive(
  headers: Record<string, string | number | undefined> | undefined,
  name: string
) {
  if (!headers) {
    return undefined;
  }

  const key = Object.keys(headers).find(
    (headerName) => headerName.toLowerCase() === name.toLowerCase()
  );

  if (!key) {
    return undefined;
  }

  return headers[key];
}

export class GitHubRateLimitError extends Error {
  readonly retryAfterSeconds?: number;

  constructor(retryAfterSeconds?: number) {
    super(GITHUB_PRIMARY_RATE_LIMIT_MESSAGE);
    this.name = "GitHubRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isGitHubRateLimitError(
  error: unknown
): error is GitHubRateLimitError {
  if (error instanceof GitHubRateLimitError) {
    return true;
  }

  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    name?: string;
    message?: string;
    cause?: unknown;
  };

  if (candidate.name === "GitHubRateLimitError") {
    return true;
  }

  if (candidate.message?.includes(GITHUB_PRIMARY_RATE_LIMIT_MESSAGE)) {
    return true;
  }

  if (candidate.cause) {
    return isGitHubRateLimitError(candidate.cause);
  }

  return false;
}

function toGitHubRateLimitError(error: unknown) {
  const maybeError = error as ErrorWithStatus;
  const status = maybeError?.status;
  const headers = maybeError?.response?.headers;

  const remaining = getHeaderCaseInsensitive(headers, "x-ratelimit-remaining");
  const retryAfter = getHeaderCaseInsensitive(headers, "retry-after");
  const resetAt = getHeaderCaseInsensitive(headers, "x-ratelimit-reset");
  const retryAfterMs = parseRetryAfterMs(
    retryAfter === undefined ? undefined : String(retryAfter)
  );

  let retryAfterSeconds =
    retryAfterMs && retryAfterMs > 0
      ? Math.ceil(retryAfterMs / 1000)
      : undefined;
  if (!retryAfterSeconds) {
    const resetEpochSeconds = Math.floor(Number(resetAt));
    if (resetEpochSeconds > 0) {
      const nowEpochSeconds = Math.floor(Date.now() / 1000);
      const diff = resetEpochSeconds - nowEpochSeconds;
      retryAfterSeconds = diff > 0 ? diff : undefined;
    }
  }

  const isRateLimitedByStatus = status === 429;
  const isRateLimitedByForbidden =
    status === 403 && String(remaining ?? "") === "0";
  const isSecondaryRateLimit =
    status === 403 &&
    maybeError?.message?.toLowerCase().includes("secondary rate limit") ===
      true;

  if (
    isRateLimitedByStatus ||
    isRateLimitedByForbidden ||
    isSecondaryRateLimit
  ) {
    return new GitHubRateLimitError(retryAfterSeconds);
  }

  return null;
}

export async function withGitHubRateLimitHandling<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const rateLimitError = toGitHubRateLimitError(error);
    if (rateLimitError) {
      throw rateLimitError;
    }
    throw error;
  }
}
