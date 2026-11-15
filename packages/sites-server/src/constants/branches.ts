export const BRANCH_PROTECTION_CACHE_MS = 15_000;
export const BRANCH_PROTECTION_QUERY = `query SiteBranchProtection($owner: String!, $repo: String!, $ref: String!) {
  repository(owner: $owner, name: $repo) {
    ref(qualifiedName: $ref) { branchProtectionRule { id } }
  }
}`;
export const BRANCH_PULL_REQUEST_QUERY = `query SiteBranchPullRequest($id: ID!) {
  node(id: $id) { ... on PullRequest {
    id number url isDraft state merged mergeable mergeStateStatus reviewDecision headRefOid
    commits { totalCount }
  } }
}`;
export const READY_FOR_REVIEW_MUTATION = `mutation SiteRequestReview($id: ID!) {
  markPullRequestReadyForReview(input: {pullRequestId: $id}) { pullRequest { id } }
}`;
export const MERGEABLE_STATES = new Set(["CLEAN", "HAS_HOOKS"]);

export const BRANCH_PR_PAGE_LIMIT = 3;
export const SITE_BRANCH_WRITABLE_CACHE_MS = 60_000;
export const SITE_BRANCH_BLOCKED_MESSAGE =
  "GitHub blocks direct commits to this branch. Create a new branch to keep editing.";
export const SITE_EDIT_BRANCH_BLOCKED_MESSAGE =
  "GitHub rules block commits to Notra's branches. Ask a repository admin to exclude notra/** from the branch rules.";
