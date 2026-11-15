import {
  SITE_EDIT_BRANCH_PREFIX,
  NOTRA_BRANCH_PREFIX,
} from "@notra/sites-core/constants/sites";
import { isValidGitBranch } from "@notra/sites-core/utils/git-branch";

import { SiteInputError } from "../errors/sites";
import { siteRepositoryAccess } from "../github";
import type { SiteRepositoryAccess } from "../types/github";
import type { Site } from "../types/sites";
import { timestampedBranchName } from "./branch-name";
import { branchPullRequest } from "./branch-pull-request";

export function assertSiteFeatureBranch(site: Site, branch: string) {
  if (branch === site.productionBranch) {
    throw new SiteInputError(
      "The deployment branch cannot be renamed or deleted"
    );
  }
  if (!branch.startsWith(NOTRA_BRANCH_PREFIX) || !isValidGitBranch(branch)) {
    throw new SiteInputError("Only Notra branches can be renamed or deleted");
  }
}

export function assertSiteEditableBranch(site: Site, branch: string) {
  if (
    !isValidGitBranch(branch) ||
    (branch !== site.productionBranch &&
      !branch.startsWith(NOTRA_BRANCH_PREFIX))
  ) {
    throw new SiteInputError("Branch not found");
  }
}

export function siteEditBranchName(title: string) {
  if (!title.trim()) {
    return `${timestampedBranchName(SITE_EDIT_BRANCH_PREFIX, new Date())}-${crypto.randomUUID().slice(0, 6)}`;
  }
  const slug = title
    .trim()
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) {
    throw new SiteInputError(
      "Enter a branch name containing letters or numbers"
    );
  }
  const name = `${SITE_EDIT_BRANCH_PREFIX}${slug}`;
  if (!isValidGitBranch(name)) {
    throw new SiteInputError("Enter a valid branch name");
  }
  return name;
}

export async function assertSiteContentBranch(
  site: Site,
  branch: string,
  access?: SiteRepositoryAccess
) {
  assertSiteEditableBranch(site, branch);
  if (
    branch === site.productionBranch ||
    branch.startsWith(SITE_EDIT_BRANCH_PREFIX)
  ) {
    return;
  }
  const { repository, token } =
    access ??
    (await siteRepositoryAccess(site, {
      contents: "read",
      pull_requests: "read",
    }));
  const pr = await branchPullRequest(
    repository,
    token,
    branch,
    site.productionBranch
  );
  if (pr?.state !== "OPEN") {
    throw new SiteInputError("Branch not found");
  }
}
