import {
  createScopedGitHubAppInstallationToken,
  listGitHubAppInstallationsByOrganization,
} from "@notra/ai/integrations/github";
import type { GitHubMentionFileChange } from "@notra/ai/types/github-mention";
import {
  commitFilesToPullRequest,
  createDraftPullRequest,
  createGitHubBranch,
  getGitHubBranchHeadSha,
  githubStatus,
} from "@notra/ai/utils/github-pr-commit";
import { createOctokit } from "@notra/ai/utils/octokit";

import {
  AUTOPILOT_BRANCH_PREFIX,
  AUTOPILOT_PULL_REQUEST_FOOTER,
  AUTOPILOT_TREE_MAX_PATHS,
} from "@/constants/autopilot";
import type { AutopilotRepository } from "@/types/autopilot";
import type { AutopilotOctokit } from "@/types/autopilot-runtime";

export class AutopilotRepositoryAccessError extends Error {
  override name = "AutopilotRepositoryAccessError";
}

export async function getRepositoryOctokit(
  organizationId: string,
  repository: Pick<AutopilotRepository, "owner" | "name">
): Promise<AutopilotOctokit> {
  const installations =
    await listGitHubAppInstallationsByOrganization(organizationId);
  const installation = installations.find(
    (row) => row.accountLogin.toLowerCase() === repository.owner.toLowerCase()
  );
  if (!installation) {
    throw new AutopilotRepositoryAccessError(
      `The GitHub App is not installed on ${repository.owner}`
    );
  }
  const token = await createScopedGitHubAppInstallationToken(
    installation.installationId,
    {
      repositories: [repository.name],
      permissions: {
        contents: "write",
        pull_requests: "write",
        issues: "write",
        metadata: "read",
      },
    }
  );
  // Autopilot calls GitHub again after long agent runs, when pooled sockets are often stale.
  return createOctokit(token, { avoidStaleSockets: true });
}

export async function getInstallationOctokit(
  organizationId: string,
  accountLogin: string
): Promise<AutopilotOctokit | null> {
  const installations =
    await listGitHubAppInstallationsByOrganization(organizationId);
  const installation = installations.find(
    (row) => row.accountLogin.toLowerCase() === accountLogin.toLowerCase()
  );
  if (!installation) {
    return null;
  }
  const token = await createScopedGitHubAppInstallationToken(
    installation.installationId,
    {
      permissions: {
        contents: "read",
        pull_requests: "read",
        metadata: "read",
      },
    }
  );
  return createOctokit(token, { avoidStaleSockets: true });
}

export async function listRepositoryPaths(
  octokit: AutopilotOctokit,
  repository: AutopilotRepository,
  ref: string = repository.branch
): Promise<string[]> {
  const { data } = await octokit.request(
    "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
    {
      owner: repository.owner,
      repo: repository.name,
      tree_sha: ref,
      recursive: "1",
    }
  );
  return data.tree
    .filter((entry) => entry.type === "blob" && typeof entry.path === "string")
    .map((entry) => entry.path as string)
    .filter((path) => !path.includes("node_modules/"))
    .slice(0, AUTOPILOT_TREE_MAX_PATHS * 4);
}

export function getBaseBranchSha(
  octokit: AutopilotOctokit,
  repository: AutopilotRepository
) {
  return getGitHubBranchHeadSha({
    octokit,
    owner: repository.owner,
    repo: repository.name,
    branch: repository.branch,
  });
}

/** Returns the full file; callers trim it for prompts. */
export async function readRepositoryFile(
  octokit: AutopilotOctokit,
  repository: AutopilotRepository,
  path: string,
  ref: string = repository.branch
): Promise<string | null> {
  try {
    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
        owner: repository.owner,
        repo: repository.name,
        path,
        ref,
      }
    );
    if (Array.isArray(data) || data.type !== "file" || !("content" in data)) {
      return null;
    }
    return Buffer.from(data.content, "base64").toString("utf8");
  } catch {
    return null;
  }
}

async function findOpenPullRequestForBranch(
  octokit: AutopilotOctokit,
  repository: AutopilotRepository,
  branch: string
) {
  const { data } = await octokit.request("GET /repos/{owner}/{repo}/pulls", {
    owner: repository.owner,
    repo: repository.name,
    head: `${repository.owner}:${branch}`,
    state: "open",
    per_page: 1,
  });
  const pull = data[0];
  return pull
    ? {
        number: pull.number,
        url: pull.html_url,
        branch,
        headSha: pull.head.sha,
      }
    : null;
}

/**
 * Whether a path exists at a commit. The recursive tree can be truncated on
 * large repositories, so a path missing from it is not proof it is new.
 */
export async function repositoryPathExists(
  octokit: AutopilotOctokit,
  repository: AutopilotRepository,
  path: string,
  ref: string
) {
  try {
    await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
      owner: repository.owner,
      repo: repository.name,
      path,
      ref,
    });
    return true;
  } catch (error) {
    if (githubStatus(error) === 404) {
      return false;
    }
    throw error;
  }
}

/** Closes a pull request Autopilot opened but no longer owns, and drops its branch. */
export async function closeAutopilotPullRequest(
  octokit: AutopilotOctokit,
  repository: AutopilotRepository,
  pullRequest: { number: number; branch: string }
) {
  await octokit.request("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", {
    owner: repository.owner,
    repo: repository.name,
    pull_number: pullRequest.number,
    state: "closed",
  });
  await octokit
    .request("DELETE /repos/{owner}/{repo}/git/refs/{ref}", {
      owner: repository.owner,
      repo: repository.name,
      ref: `heads/${pullRequest.branch}`,
    })
    .catch(() => undefined);
}

export async function requestAutopilotReviewers(
  octokit: AutopilotOctokit,
  repository: AutopilotRepository,
  pullNumber: number,
  reviewers: string[]
) {
  await octokit.request(
    "POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers",
    {
      owner: repository.owner,
      repo: repository.name,
      pull_number: pullNumber,
      reviewers,
    }
  );
}

export async function openAutopilotPullRequest(params: {
  octokit: AutopilotOctokit;
  repository: AutopilotRepository;
  slug: string;
  title: string;
  body: string;
  files: GitHubMentionFileChange[];
  /** Commit the files were read at, so the PR never reverts newer changes. */
  baseSha?: string;
}): Promise<{
  number: number;
  url: string;
  branch: string;
  headSha: string;
}> {
  const { octokit, repository } = params;
  const branch = `${AUTOPILOT_BRANCH_PREFIX}/${params.slug}`;
  // An earlier attempt for this finding got as far as the pull request:
  // return it as is, so a retry never commits over someone's review edits.
  const existing = await findOpenPullRequestForBranch(
    octokit,
    repository,
    branch
  );
  if (existing) {
    return existing;
  }
  const baseSha =
    params.baseSha ??
    (await getGitHubBranchHeadSha({
      octokit,
      owner: repository.owner,
      repo: repository.name,
      branch: repository.branch,
    }));
  await createGitHubBranch({
    octokit,
    owner: repository.owner,
    repo: repository.name,
    branch,
    sha: baseSha,
  });
  const headSha = await getGitHubBranchHeadSha({
    octokit,
    owner: repository.owner,
    repo: repository.name,
    branch,
  });
  if (headSha !== baseSha) {
    // Left over from an attempt that died before opening its pull request;
    // nobody reviews a branch without one, so it starts over from the base.
    await octokit.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
      owner: repository.owner,
      repo: repository.name,
      ref: `heads/${branch}`,
      sha: baseSha,
      force: true,
    });
  }
  const commitSha = await commitFilesToPullRequest({
    octokit,
    owner: repository.owner,
    repo: repository.name,
    branch,
    expectedHeadOid: baseSha,
    headline: params.title,
    files: params.files,
  });
  const pullRequest = await createDraftPullRequest({
    octokit,
    owner: repository.owner,
    repo: repository.name,
    title: params.title,
    body: `${params.body.trim()}\n\n---\n\n${AUTOPILOT_PULL_REQUEST_FOOTER}`,
    head: branch,
    base: repository.branch,
  });
  return {
    number: pullRequest.number,
    url: pullRequest.htmlUrl,
    branch,
    headSha: commitSha,
  };
}
