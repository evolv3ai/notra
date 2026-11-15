import { NOTRA_BRANCH_PREFIX } from "@notra/sites-core/constants/sites";

import {
  SITE_BRANCH_BLOCKED_MESSAGE,
  SITE_BRANCH_WRITABLE_CACHE_MS,
  SITE_EDIT_BRANCH_BLOCKED_MESSAGE,
} from "../constants/branches";
import { SiteInputError } from "../errors/sites";
import { getBranchHead } from "../github";
import type { BranchHead, SiteRepositoryAccess } from "../types/github";
import type { Site } from "../types/sites";
import { requiresPullRequest } from "./branch-protection";

// Only "writable" answers are remembered, so a blocked or failed check is
// retried on the next request instead of sticking for the whole TTL.
const writable = new Map<string, number>();

function cacheKey(site: Site, branch: string) {
  return JSON.stringify([site.id, site.repositoryId, branch]);
}

/** Whether GitHub accepts direct commits to a branch. The deployment branch is always checked fresh. */
export async function siteBranchWritable(
  site: Site,
  access: SiteRepositoryAccess,
  branch: string
): Promise<boolean> {
  const key = cacheKey(site, branch);
  const cacheable = branch !== site.productionBranch;
  if (cacheable && (writable.get(key) ?? 0) > Date.now()) {
    return true;
  }
  const required = await requiresPullRequest(
    access.repository,
    access.token,
    branch
  );
  if (required || !cacheable) {
    writable.delete(key);
    return !required;
  }
  if (writable.size >= 1000) {
    writable.clear();
  }
  writable.set(key, Date.now() + SITE_BRANCH_WRITABLE_CACHE_MS);
  return true;
}

/** Rejects saves and commits on missing or protected branches; protection reads are skipped for a known-good branch. */
export async function assertSiteBranchWritable(
  site: Site,
  access: SiteRepositoryAccess,
  branch: string,
  head?: BranchHead
) {
  const key = cacheKey(site, branch);
  // The cache only covers protection: existence is read every time, so a
  // branch deleted on GitHub stops accepting saves immediately.
  const [exists, allowed] = await Promise.allSettled([
    head ?? getBranchHead(access.repository, access.token, branch),
    siteBranchWritable(site, access, branch),
  ]);
  // A missing or unreachable branch is reported as such, not as protection.
  if (exists.status === "rejected") {
    writable.delete(key);
    throw exists.reason;
  }
  if (allowed.status === "rejected") {
    throw allowed.reason;
  }
  if (!allowed.value) {
    throw new SiteInputError(
      branch.startsWith(NOTRA_BRANCH_PREFIX)
        ? SITE_EDIT_BRANCH_BLOCKED_MESSAGE
        : SITE_BRANCH_BLOCKED_MESSAGE
    );
  }
}

export function forgetSiteBranchWritable(site: Site, branch: string) {
  writable.delete(cacheKey(site, branch));
}
