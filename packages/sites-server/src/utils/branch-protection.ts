import { GITHUB_API_VERSION_HEADERS } from "@notra/ai/constants/github";

import { BRANCH_PROTECTION_QUERY } from "../constants/branches";
import type { BranchProtectionResponse } from "../types/branches";
import type { SiteRepository } from "../types/github";
import { createSiteBranchOctokit as createOctokit } from "./branch-octokit";

export async function requiresPullRequest(
  repository: SiteRepository,
  token: string,
  branch: string
): Promise<boolean> {
  const octokit = createOctokit(token);
  const params = {
    owner: repository.owner,
    repo: repository.repo,
    branch,
    headers: GITHUB_API_VERSION_HEADERS,
  };
  try {
    const [head, rules] = await Promise.all([
      octokit.request("GET /repos/{owner}/{repo}/branches/{branch}", params),
      octokit
        .request("GET /repos/{owner}/{repo}/rules/branches/{branch}", params)
        .catch((error: unknown) => {
          // Private repos on GitHub Free cannot have rulesets, so the endpoint
          // answers 403 instead of an empty list.
          if (isRulesetsUnavailable(error)) {
            return { data: [] };
          }
          throw error;
        }),
    ]);
    if (
      typeof head.data?.protected !== "boolean" ||
      !Array.isArray(rules.data)
    ) {
      return true;
    }
    if (
      rules.data.some(
        (rule) => !rule || !["non_fast_forward", "deletion"].includes(rule.type)
      )
    ) {
      return true;
    }
    if (!head.data.protected) {
      return false;
    }
    // A protected ref with no ruleset explanation must fail closed even if
    // classic protection is hidden from this installation token.
    if (rules.data.length === 0) {
      return true;
    }
    // Rulesets also set REST's protected flag. Only a classic protection rule
    // adds a restriction when the active rules allow ordinary commits.
    const classic = await octokit.graphql<BranchProtectionResponse>(
      BRANCH_PROTECTION_QUERY,
      {
        owner: repository.owner,
        repo: repository.repo,
        ref: `refs/heads/${branch}`,
      }
    );
    return classic.repository?.ref?.branchProtectionRule !== null;
  } catch {
    return true;
  }
}

function isRulesetsUnavailable(error: unknown) {
  return (
    error instanceof Error &&
    Reflect.get(error, "status") === 403 &&
    error.message.includes("Upgrade to GitHub Pro")
  );
}
