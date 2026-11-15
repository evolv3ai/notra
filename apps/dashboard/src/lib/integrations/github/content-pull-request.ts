import { GITHUB_API_VERSION_HEADERS } from "@notra/ai/constants/github";

import type {
  ContentPullRequestRef,
  ContentPullRequestState,
  GitHubClient,
  GitHubMergeMethod,
} from "@/types/integrations/github";
import { hasGitHubStatus } from "@/utils/github-publish-failure";

const GITHUB_MERGE_METHODS: readonly GitHubMergeMethod[] = [
  "squash",
  "merge",
  "rebase",
];
const MARK_READY_FOR_REVIEW_MUTATION = `
  mutation MarkReadyForReview($pullRequestId: ID!) {
    markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {
      pullRequest { id }
    }
  }
`;
const MERGE_METHOD_NOT_ALLOWED_REGEX = /merge method|not allowed/i;

export async function getContentPullRequestState(
  octokit: GitHubClient,
  ref: ContentPullRequestRef
): Promise<ContentPullRequestState> {
  const { data } = await octokit.request(
    "GET /repos/{owner}/{repo}/pulls/{pull_number}",
    {
      owner: ref.owner,
      repo: ref.repo,
      pull_number: ref.pullNumber,
      headers: GITHUB_API_VERSION_HEADERS,
    }
  );
  if (data.merged) {
    return {
      status: "merged",
      mergedAt: data.merged_at ? new Date(data.merged_at) : null,
    };
  }
  if (data.state === "closed") {
    return { status: "closed" };
  }
  return { status: "open", draft: Boolean(data.draft), nodeId: data.node_id };
}

/** Takes a draft content pull request out of draft so it can be reviewed. */
export async function markContentPullRequestReady(
  octokit: GitHubClient,
  pullRequest: { draft: boolean; nodeId: string }
): Promise<void> {
  if (pullRequest.draft) {
    await octokit.graphql(MARK_READY_FOR_REVIEW_MUTATION, {
      pullRequestId: pullRequest.nodeId,
    });
  }
}

export function isMergeMethodNotAllowed(error: unknown) {
  return (
    hasGitHubStatus(error, 405) &&
    error instanceof Error &&
    MERGE_METHOD_NOT_ALLOWED_REGEX.test(error.message)
  );
}

/**
 * Merges an open content pull request with `method`, or without one with the
 * first merge method the repository allows. With `headSha` the merge is
 * pinned to that commit, so a later push is never merged. Notra opens drafts,
 * which GitHub refuses to merge; merging is the go-ahead to leave draft.
 * Throws the GitHub error.
 */
export async function mergeContentPullRequest(
  octokit: GitHubClient,
  ref: ContentPullRequestRef,
  pullRequest: { draft: boolean; nodeId: string },
  headSha: string | null,
  method?: GitHubMergeMethod
): Promise<void> {
  await markContentPullRequestReady(octokit, pullRequest);
  let lastError: unknown = null;
  for (const mergeMethod of method ? [method] : GITHUB_MERGE_METHODS) {
    try {
      await octokit.request(
        "PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge",
        {
          owner: ref.owner,
          repo: ref.repo,
          pull_number: ref.pullNumber,
          merge_method: mergeMethod,
          ...(headSha ? { sha: headSha } : {}),
          headers: GITHUB_API_VERSION_HEADERS,
        }
      );
      return;
    } catch (error) {
      lastError = error;
      if (!isMergeMethodNotAllowed(error)) {
        break;
      }
    }
  }
  throw lastError;
}
