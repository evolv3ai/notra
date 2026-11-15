export const GITHUB_CONTENT_POST_TRAILER = "Notra-Post: ";

/** GitHub App tokens author this commit as the App bot. */
export const GITHUB_CREATE_COMMIT_ON_BRANCH_MUTATION = `
  mutation CreateCommitOnBranch($input: CreateCommitOnBranchInput!) {
    createCommitOnBranch(input: $input) {
      commit {
        oid
      }
    }
  }
`;

export const GITHUB_API_VERSION = "2022-11-28";

export const GITHUB_API_DEFAULT_URL = "https://api.github.com";

export const GITHUB_API_VERSION_HEADERS = {
  "X-GitHub-Api-Version": GITHUB_API_VERSION,
} as const;
