import type { GitHubMentionDestination } from "@notra/ai/types/github-mention";
import { wantsSeparatePullRequest } from "@notra/ai/utils/github-mention";

export function resolveGitHubMentionDestination(params: {
  commentBody: string;
  pullRequest: {
    number: number;
    headRef: string;
    headSha: string;
  } | null;
}): GitHubMentionDestination {
  if (!params.pullRequest) {
    return {
      mode: "reply_only",
      pullRequestNumber: null,
      headRef: null,
      headSha: null,
    };
  }

  return {
    mode: wantsSeparatePullRequest(params.commentBody)
      ? "new_pull_request"
      : "same_pull_request",
    pullRequestNumber: params.pullRequest.number,
    headRef: params.pullRequest.headRef,
    headSha: params.pullRequest.headSha,
  };
}
