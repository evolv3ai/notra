import {
  GITHUB_CREATE_COMMIT_ON_BRANCH_MUTATION,
  GITHUB_API_VERSION_HEADERS,
} from "@notra/ai/constants/github";

import { SiteInputError } from "./errors/sites";
import type {
  CreateCommitOnBranchResponse,
  RepositoryBranchInput,
  RepositoryCommitInput,
  RepositoryFileRef,
  RepositoryPullRequestInput,
  SiteSourceFileContent,
} from "./types/editor";
import type { SiteRepository } from "./types/github";
import { createSiteBranchOctokit as createOctokit } from "./utils/branch-octokit";
import { isNotFoundError } from "./utils/errors";

export async function readRepositoryFile(
  repository: SiteRepository,
  token: string,
  file: RepositoryFileRef
): Promise<SiteSourceFileContent | null> {
  const octokit = createOctokit(token);
  try {
    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
        owner: repository.owner,
        repo: repository.repo,
        path: file.path,
        ref: file.ref,
        headers: GITHUB_API_VERSION_HEADERS,
      }
    );
    if (Array.isArray(data) || data.type !== "file" || !("content" in data)) {
      return null;
    }
    return {
      content: Buffer.from(data.content, "base64").toString("utf8"),
      sha: data.sha,
    };
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

/** A file's blob SHA without downloading it; works past the 1 MB content limit. */
export async function readRepositoryBlobSha(
  repository: SiteRepository,
  token: string,
  file: RepositoryFileRef
): Promise<string | null> {
  try {
    const { data } = await createOctokit(token).request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
        owner: repository.owner,
        repo: repository.repo,
        path: file.path,
        ref: file.ref,
        headers: {
          ...GITHUB_API_VERSION_HEADERS,
          accept: "application/vnd.github.object+json",
        },
      }
    );
    return Array.isArray(data) || data.type !== "file" ? null : data.sha;
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

export async function createRepositoryBranch(
  repository: SiteRepository,
  token: string,
  branch: RepositoryBranchInput
): Promise<void> {
  await createOctokit(token).request("POST /repos/{owner}/{repo}/git/refs", {
    owner: repository.owner,
    repo: repository.repo,
    ref: `refs/heads/${branch.name}`,
    sha: branch.sha,
    headers: GITHUB_API_VERSION_HEADERS,
  });
}

export async function commitRepositoryFiles(
  repository: SiteRepository,
  token: string,
  commit: RepositoryCommitInput
): Promise<string> {
  const result = await createOctokit(
    token
  ).graphql<CreateCommitOnBranchResponse>(
    GITHUB_CREATE_COMMIT_ON_BRANCH_MUTATION,
    {
      input: {
        branch: {
          repositoryNameWithOwner: `${repository.owner}/${repository.repo}`,
          branchName: commit.branch,
        },
        message: { headline: commit.headline },
        expectedHeadOid: commit.expectedHeadOid,
        fileChanges: {
          additions: commit.additions,
          deletions: commit.deletions.map((path) => ({ path })),
        },
      },
    }
  );
  return result.createCommitOnBranch.commit.oid;
}

export async function openRepositoryPullRequest(
  repository: SiteRepository,
  token: string,
  pullRequest: RepositoryPullRequestInput
): Promise<string> {
  const octokit = createOctokit(token);
  const params = {
    owner: repository.owner,
    repo: repository.repo,
    title: pullRequest.title,
    head: pullRequest.head,
    base: pullRequest.base,
    body: pullRequest.body,
    headers: GITHUB_API_VERSION_HEADERS,
  };
  try {
    const { data } = await octokit.request("POST /repos/{owner}/{repo}/pulls", {
      ...params,
      draft: pullRequest.draft ?? false,
    });
    return data.html_url;
  } catch (error) {
    if (
      !pullRequest.draft ||
      !(error instanceof Error) ||
      Reflect.get(error, "status") !== 422 ||
      !/draft pull requests? (?:are |is )?not supported/i.test(error.message)
    ) {
      if (error instanceof Error && /no commits between/i.test(error.message)) {
        throw new SiteInputError(
          "No commits between this branch and the deployment branch. Save a change before opening a pull request."
        );
      }
      throw error;
    }
    const { data } = await octokit.request(
      "POST /repos/{owner}/{repo}/pulls",
      params
    );
    return data.html_url;
  }
}
