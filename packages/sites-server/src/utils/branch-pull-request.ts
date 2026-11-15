import { GITHUB_API_VERSION_HEADERS } from "@notra/ai/constants/github";

import {
  BRANCH_PULL_REQUEST_QUERY,
  MERGEABLE_STATES,
} from "../constants/branches";
import type {
  BranchPullRequest,
  BranchPullRequestResponse,
} from "../types/branches";
import type { SiteRepository } from "../types/github";
import { createSiteBranchOctokit as createOctokit } from "./branch-octokit";

export async function branchPullRequest(
  repository: SiteRepository,
  token: string,
  branch: string,
  base?: string
) {
  const octokit = createOctokit(token);
  const params = {
    owner: repository.owner,
    repo: repository.repo,
    head: `${repository.owner}:${branch}`,
    base,
    sort: "created" as const,
    direction: "desc" as const,
    per_page: 100,
    headers: GITHUB_API_VERSION_HEADERS,
  };
  // Look up open PRs separately so newer closed PRs cannot hide a reopened one.
  const { data: open } = await octokit.request(
    "GET /repos/{owner}/{repo}/pulls",
    {
      ...params,
      state: "open",
    }
  );
  const pr =
    open[0] ??
    (base === undefined
      ? undefined
      : (
          await octokit.request("GET /repos/{owner}/{repo}/pulls", {
            ...params,
            state: "closed",
            per_page: 1,
          })
        ).data[0]);
  if (!pr) {
    return null;
  }
  const result = await octokit.graphql<BranchPullRequestResponse>(
    BRANCH_PULL_REQUEST_QUERY,
    { id: pr.node_id }
  );
  return result.node;
}

export function canMergeBranch(pr: BranchPullRequest | null): boolean {
  return Boolean(
    pr &&
    pr.state === "OPEN" &&
    !pr.isDraft &&
    pr.mergeable === "MERGEABLE" &&
    MERGEABLE_STATES.has(pr.mergeStateStatus) &&
    (pr.reviewDecision === null || pr.reviewDecision === "APPROVED")
  );
}
