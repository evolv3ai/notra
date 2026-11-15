import { createOctokit } from "@notra/ai/utils/octokit";

/** Bound GitHub work while holding a branch lock. Writes are never retried. */
export function createSiteBranchOctokit(token: string) {
  return createOctokit(token, { requestTimeoutMs: 15_000, retryReads: true });
}
