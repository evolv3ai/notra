import {
  GITHUB_CONTENT_POST_TRAILER,
  GITHUB_CREATE_COMMIT_ON_BRANCH_MUTATION,
  GITHUB_API_VERSION_HEADERS,
} from "@notra/ai/constants/github";
import {
  GITHUB_MENTION_FILE_CONTENT_MAX_BYTES,
  GITHUB_MENTION_IMAGE_MAX_BYTES,
} from "@notra/ai/constants/github-mention";
import { getGitHubAppBotLogin } from "@notra/ai/integrations/github";
import type {
  CommitFilesToPullRequestParams,
  GitHubCreateCommitOnBranchResult,
} from "@notra/ai/types/github-mention";

async function getTrustedParentCommitBody(
  params: CommitFilesToPullRequestParams
) {
  const publisherLogin =
    getGitHubAppBotLogin() ??
    (await params.octokit
      .request("GET /user")
      .then(({ data }) => data.login)
      .catch(() => null));
  if (!publisherLogin) {
    return undefined;
  }
  const { data: commit } = await params.octokit.request(
    "GET /repos/{owner}/{repo}/commits/{ref}",
    {
      owner: params.owner,
      repo: params.repo,
      ref: params.expectedHeadOid,
      headers: GITHUB_API_VERSION_HEADERS,
    }
  );
  if (
    commit.author?.login !== publisherLogin ||
    commit.commit.verification?.verified !== true
  ) {
    return undefined;
  }
  const body = commit.commit.message
    .split(/\r?\n\r?\n/)
    .slice(1)
    .join("\n\n")
    .split(/\r?\n/)
    .filter((line) => !line.startsWith(GITHUB_CONTENT_POST_TRAILER))
    .join("\n");
  return body || undefined;
}

/** Binary files arrive base64-encoded; text is committed as UTF-8. */
function fileBytes(file: CommitFilesToPullRequestParams["files"][number]) {
  return file.encoding === "base64"
    ? Buffer.from(file.contents, "base64")
    : Buffer.from(file.contents, "utf8");
}

export async function commitFilesToPullRequest(
  params: CommitFilesToPullRequestParams
) {
  const deletions = params.deletions ?? [];
  if (params.files.length === 0 && deletions.length === 0) {
    throw new Error("At least one file is required to commit");
  }

  for (const file of params.files) {
    const bytes = fileBytes(file).length;
    const limit =
      file.encoding === "base64"
        ? GITHUB_MENTION_IMAGE_MAX_BYTES
        : GITHUB_MENTION_FILE_CONTENT_MAX_BYTES;
    if (bytes > limit) {
      throw new Error(
        `File ${file.path} is ${bytes} bytes and exceeds the ${limit} byte limit`
      );
    }
  }

  const parentBody = await getTrustedParentCommitBody(params);

  const result = await params.octokit.graphql<GitHubCreateCommitOnBranchResult>(
    GITHUB_CREATE_COMMIT_ON_BRANCH_MUTATION,
    {
      input: {
        branch: {
          repositoryNameWithOwner: `${params.owner}/${params.repo}`,
          branchName: params.branch,
        },
        message: {
          headline: params.headline,
          ...(parentBody ? { body: parentBody } : {}),
        },
        expectedHeadOid: params.expectedHeadOid,
        fileChanges: {
          additions: params.files.map((file) => ({
            path: file.path,
            contents: fileBytes(file).toString("base64"),
          })),
          deletions: deletions.map((path) => ({ path })),
        },
      },
    }
  );

  const commitSha = result.createCommitOnBranch?.commit.oid;
  if (!commitSha) {
    throw new Error("GitHub did not return the content commit");
  }
  return commitSha;
}

export async function getPullRequestHead(params: {
  octokit: CommitFilesToPullRequestParams["octokit"];
  owner: string;
  repo: string;
  pullNumber: number;
}) {
  const { data } = await params.octokit.request(
    "GET /repos/{owner}/{repo}/pulls/{pull_number}",
    {
      owner: params.owner,
      repo: params.repo,
      pull_number: params.pullNumber,
      headers: GITHUB_API_VERSION_HEADERS,
    }
  );
  return {
    number: data.number,
    title: data.title,
    body: data.body ?? null,
    htmlUrl: data.html_url,
    headRef: data.head.ref,
    headSha: data.head.sha,
    headRepoFullName: data.head.repo?.full_name ?? null,
    baseRef: data.base.ref,
    defaultBranch: data.base.repo?.default_branch ?? null,
    draft: Boolean(data.draft),
    authorLogin: data.user?.login ?? null,
    state: data.state,
    merged: Boolean(data.merged),
  };
}

export async function getRepositoryFileContents(params: {
  octokit: CommitFilesToPullRequestParams["octokit"];
  owner: string;
  repo: string;
  path: string;
  ref: string;
}) {
  const { data } = await params.octokit.request(
    "GET /repos/{owner}/{repo}/contents/{path}",
    {
      owner: params.owner,
      repo: params.repo,
      path: params.path,
      ref: params.ref,
      headers: GITHUB_API_VERSION_HEADERS,
    }
  );
  if (Array.isArray(data) || data.type !== "file" || !("content" in data)) {
    throw new Error(`${params.path} is not a file on ${params.ref}`);
  }
  return Buffer.from(data.content, "base64").toString("utf8");
}

export async function getGitHubChangedFiles(params: {
  octokit: CommitFilesToPullRequestParams["octokit"];
  owner: string;
  repo: string;
  baseSha: string;
  headSha: string;
}) {
  const { data } = await params.octokit.request(
    "GET /repos/{owner}/{repo}/compare/{basehead}",
    {
      owner: params.owner,
      repo: params.repo,
      basehead: `${params.baseSha}...${params.headSha}`,
      headers: GITHUB_API_VERSION_HEADERS,
    }
  );
  return (data.files ?? []).map((file) => ({
    path: file.filename,
    additions: file.additions,
    deletions: file.deletions,
    patch: file.patch ?? null,
  }));
}

/** The pull request's diff of one file; null when the file is not part of it. */
export async function getGitHubPullRequestFilePatch(params: {
  octokit: CommitFilesToPullRequestParams["octokit"];
  owner: string;
  repo: string;
  pullNumber: number;
  path: string;
}) {
  for (let page = 1; ; page++) {
    const { data } = await params.octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
      {
        owner: params.owner,
        repo: params.repo,
        pull_number: params.pullNumber,
        per_page: 100,
        page,
        headers: GITHUB_API_VERSION_HEADERS,
      }
    );
    const file = data.find((candidate) => candidate.filename === params.path);
    if (file || data.length < 100) {
      return file?.patch ?? null;
    }
  }
}

export function githubStatus(error: unknown) {
  if (typeof error === "object" && error !== null && "status" in error) {
    return typeof error.status === "number" ? error.status : null;
  }
  return null;
}

function isDuplicatePullRequestError(error: unknown) {
  if (githubStatus(error) !== 422 || typeof error !== "object" || !error) {
    return false;
  }
  const requestError = error as {
    message?: string;
    errors?: Array<{ message?: string }>;
    response?: { data?: { errors?: Array<{ message?: string }> } };
  };
  const details = [
    requestError.message,
    ...(requestError.errors ?? []).map(({ message }) => message),
    ...(requestError.response?.data?.errors ?? []).map(
      ({ message }) => message
    ),
  ];
  return details.some((message) =>
    message?.toLowerCase().includes("pull request already exists")
  );
}

export async function createGitHubBranch(params: {
  octokit: CommitFilesToPullRequestParams["octokit"];
  owner: string;
  repo: string;
  branch: string;
  sha: string;
}) {
  try {
    await params.octokit.request("POST /repos/{owner}/{repo}/git/refs", {
      owner: params.owner,
      repo: params.repo,
      ref: `refs/heads/${params.branch}`,
      sha: params.sha,
      headers: GITHUB_API_VERSION_HEADERS,
    });
  } catch (error) {
    if (githubStatus(error) !== 422) {
      throw error;
    }
  }
}

export async function getGitHubBranchHeadSha(params: {
  octokit: CommitFilesToPullRequestParams["octokit"];
  owner: string;
  repo: string;
  branch: string;
}) {
  const { data } = await params.octokit.request(
    "GET /repos/{owner}/{repo}/git/ref/{ref}",
    {
      owner: params.owner,
      repo: params.repo,
      ref: `heads/${params.branch}`,
      headers: GITHUB_API_VERSION_HEADERS,
    }
  );
  return data.object.sha;
}

export async function createDraftPullRequest(params: {
  octokit: CommitFilesToPullRequestParams["octokit"];
  owner: string;
  repo: string;
  title: string;
  body: string;
  head: string;
  base: string;
}) {
  try {
    const { data } = await params.octokit.request(
      "POST /repos/{owner}/{repo}/pulls",
      {
        owner: params.owner,
        repo: params.repo,
        title: params.title,
        body: params.body,
        head: params.head,
        base: params.base,
        draft: true,
        headers: GITHUB_API_VERSION_HEADERS,
      }
    );
    return {
      number: data.number,
      htmlUrl: data.html_url,
      headRef: data.head.ref,
      headSha: data.head.sha,
    };
  } catch (error) {
    if (!isDuplicatePullRequestError(error)) {
      throw error;
    }
    const { data: pullRequests } = await params.octokit.request(
      "GET /repos/{owner}/{repo}/pulls",
      {
        owner: params.owner,
        repo: params.repo,
        head: `${params.owner}:${params.head}`,
        state: "open",
        headers: GITHUB_API_VERSION_HEADERS,
      }
    );
    const existing = pullRequests.find(
      (pullRequest) => pullRequest.base.ref === params.base
    );
    if (!existing) {
      throw error;
    }
    return {
      number: existing.number,
      htmlUrl: existing.html_url,
      headRef: existing.head.ref,
      headSha: existing.head.sha,
    };
  }
}
