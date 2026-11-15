import { GITHUB_API_VERSION_HEADERS } from "@notra/ai/constants/github";
import { db } from "@notra/db/drizzle";
import { siteBranchDrafts as siteDrafts } from "@notra/db/schema";
import {
  SITE_EDIT_BRANCH_PREFIX,
  NOTRA_BRANCH_PREFIX,
} from "@notra/sites-core/constants/sites";
import { and, eq, inArray } from "drizzle-orm";

import {
  BRANCH_PROTECTION_CACHE_MS,
  BRANCH_PR_PAGE_LIMIT,
  READY_FOR_REVIEW_MUTATION,
} from "./constants/branches";
import {
  listSiteDrafts,
  listSiteDraftSummaries,
  publishedConfig,
  validateSiteDrafts,
} from "./editor";
import { SiteInputError } from "./errors/sites";
import { getBranchHead, siteRepositoryAccess } from "./github";
import {
  createRepositoryBranch,
  openRepositoryPullRequest,
} from "./repository";
import type {
  BranchProtectionCacheEntry,
  CreateSiteBranchInput,
} from "./types/branches";
import type { SiteRepository } from "./types/github";
import type { Site } from "./types/sites";
import { createSiteBranchOctokit as createOctokit } from "./utils/branch-octokit";
import { requiresPullRequest } from "./utils/branch-protection";
import { branchPullRequest, canMergeBranch } from "./utils/branch-pull-request";
import { isNotFoundError } from "./utils/errors";
import { moveSiteBranchDrafts } from "./utils/move-site-branch-drafts";
import {
  lockSiteBranchEdits,
  withSiteBranchLock,
} from "./utils/site-branch-lock";
import {
  forgetSiteBranchWritable,
  siteBranchWritable,
} from "./utils/site-branch-writable";
import { siteDraftTable } from "./utils/site-draft-table";
import {
  assertSiteContentBranch,
  assertSiteFeatureBranch,
  assertSiteEditableBranch,
  siteEditBranchName,
} from "./utils/site-edit-branch";
import { pruneUnreferencedUploads } from "./utils/unreferenced-uploads";

const protectionCache = new Map<string, BranchProtectionCacheEntry>();

export async function siteBranchStatus(
  site: Site,
  branch = site.productionBranch
) {
  assertSiteEditableBranch(site, branch);
  const access = await siteRepositoryAccess(site, {
    contents: "read",
    pull_requests: "read",
  });
  const { repository, token } = access;
  const production = branch === site.productionBranch;
  const cacheKey = JSON.stringify([
    site.id,
    site.repositoryId,
    site.productionBranch,
  ]);
  const cached = protectionCache.get(cacheKey);
  const fresh = cached && cached.expires > Date.now() ? cached : null;
  // Every read below is independent, so the slowest one sets the latency
  // instead of all of them adding up.
  const productionCheck =
    !fresh || (production && fresh.allowed)
      ? requiresPullRequest(repository, token, site.productionBranch)
      : null;
  const pullRequest = production
    ? null
    : branchPullRequest(repository, token, branch, site.productionBranch);
  const editable = production ? true : siteBranchWritable(site, access, branch);
  const featureRefs = octokitFeatureRefs(repository, token);
  const changedFiles = production
    ? 0
    : branchChangedFiles(repository, token, site.productionBranch, branch);
  for (const pending of [
    productionCheck,
    pullRequest,
    editable,
    featureRefs,
    changedFiles,
  ]) {
    if (pending instanceof Promise) {
      pending.catch(() => undefined);
    }
  }
  let head;
  try {
    head = await getBranchHead(repository, token, branch);
  } catch (error) {
    if (isNotFoundError(error)) {
      throw new SiteInputError("Branch not found");
    }
    // An ambiguous protection result must still offer Create branch.
    return {
      branch,
      canPublishDirect: false,
      canEdit: false,
      protected: true,
      pullRequest: null,
      canMerge: false,
      hasFeatureBranches: false,
      changedFiles: 0,
    };
  }
  const allowed =
    fresh && !(production && head.protected !== false && fresh.allowed)
      ? fresh.allowed
      : !(await productionCheck);
  if (protectionCache.size > 1000) {
    protectionCache.clear();
  }
  protectionCache.set(cacheKey, {
    allowed,
    expires: fresh ? fresh.expires : Date.now() + BRANCH_PROTECTION_CACHE_MS,
  });
  const pr = await pullRequest;
  return {
    branch,
    canPublishDirect: allowed,
    canEdit: await editable,
    protected: head.protected,
    pullRequest: pr,
    canMerge: canMergeBranch(pr),
    hasFeatureBranches: (await featureRefs).length > 0,
    changedFiles: await changedFiles,
  };
}

export async function listSiteBranches(site: Site, search = "") {
  const { repository, token } = await siteRepositoryAccess(site, {
    contents: "read",
    pull_requests: "read",
  });
  const octokit = createOctokit(token);
  const params = {
    owner: repository.owner,
    repo: repository.repo,
    headers: GITHUB_API_VERSION_HEADERS,
    per_page: 100,
  };
  const branches = new Map<
    string,
    {
      name: string;
      status: "draft" | "open" | "merged" | "closed" | null;
      exists: boolean;
      title?: string;
    }
  >();
  branches.set(site.productionBranch, {
    name: site.productionBranch,
    status: null,
    exists: true,
  });
  for (const entry of await octokitFeatureRefs(repository, token)) {
    const name = entry.ref.replace("refs/heads/", "");
    if (name.startsWith(SITE_EDIT_BRANCH_PREFIX)) {
      branches.set(name, { name, status: null, exists: true });
    }
  }
  for (let page = 1; page <= BRANCH_PR_PAGE_LIMIT; page++) {
    const { data } = await octokit.request("GET /repos/{owner}/{repo}/pulls", {
      ...params,
      base: site.productionBranch,
      state: "all",
      sort: "created",
      direction: "desc",
      page,
    });
    for (const pr of data) {
      if (
        pr.head.repo?.full_name !== `${repository.owner}/${repository.repo}`
      ) {
        continue;
      }
      const name = pr.head.ref;
      if (
        !name.startsWith(NOTRA_BRANCH_PREFIX) ||
        name === site.productionBranch ||
        (!name.startsWith(SITE_EDIT_BRANCH_PREFIX) && pr.state !== "open")
      ) {
        continue;
      }
      const existing = branches.get(name);
      if (existing?.status) {
        continue;
      }
      branches.set(name, {
        name,
        title: pr.title.replace(/^docs: (add|update) /, ""),
        exists: existing?.exists ?? pr.state === "open",
        status: pr.merged_at
          ? "merged"
          : pr.state === "closed"
            ? "closed"
            : pr.draft
              ? "draft"
              : "open",
      });
    }
    if (data.length < 100) {
      break;
    }
  }
  const orphaned = await db
    .selectDistinct({ branch: siteDrafts.branch })
    .from(siteDrafts)
    .where(eq(siteDrafts.siteId, site.id));
  for (const { branch } of orphaned) {
    if (branch.startsWith(SITE_EDIT_BRANCH_PREFIX) && !branches.has(branch)) {
      branches.set(branch, { name: branch, status: null, exists: false });
    }
  }
  return [...branches.values()]
    .map((entry) => ({
      ...entry,
      hasDraft: orphaned.some(({ branch }) => branch === entry.name),
    }))
    .filter(
      (entry) =>
        entry.name === site.productionBranch ||
        entry.name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) =>
      a.name === site.productionBranch
        ? -1
        : b.name === site.productionBranch
          ? 1
          : a.name.localeCompare(b.name)
    );
}

/**
 * Creating a branch only moves drafts in Postgres and adds one ref on GitHub.
 * The commit and the draft pull request follow with the next autosave, so the
 * editor can switch right away.
 */
export async function createSiteBranch(
  site: Site,
  input: CreateSiteBranchInput
) {
  const source = input.branch ?? site.productionBranch;
  await assertSiteContentBranch(site, source);
  const branch = siteEditBranchName(input.title);
  const { repository, token } = await siteRepositoryAccess(site, {
    contents: "write",
  });
  const sourceDrafts = siteDraftTable(source, site.productionBranch);
  await withSiteBranchLock(
    site.id,
    source,
    async (tx) => {
      const head = await getBranchHead(repository, token, source);
      const drafts = input.bringChanges
        ? await pruneUnreferencedUploads(
            site,
            source,
            await listSiteDrafts(site.id, source, tx),
            tx,
            () => publishedConfig(site, head.sha, { repository, token })
          )
        : [];
      if (drafts.length > 0) {
        await tx.insert(siteDrafts).values(
          drafts.map((draft) => ({
            ...draft,
            id: `drf_${crypto.randomUUID()}`,
            branch,
            revision: 0,
            committedRevision: null,
            updatedByUserId: input.userId,
          }))
        );
        await tx.delete(sourceDrafts).where(
          and(
            eq(sourceDrafts.siteId, site.id),
            inArray(
              sourceDrafts.id,
              drafts.map((draft) => draft.id)
            )
          )
        );
      }
      // Create the ref last: if moving the drafts fails, GitHub is untouched.
      await createRepositoryBranch(repository, token, {
        name: branch,
        sha: head.sha,
      });
    },
    true
  );
  return { branch };
}

export async function renameSiteBranch(
  site: Site,
  branch: string,
  title: string
) {
  try {
    return await renameSiteBranchRef(site, branch, title);
  } finally {
    // Saves to the old name must hit GitHub again and find it gone.
    forgetSiteBranchWritable(site, branch);
  }
}

async function renameSiteBranchRef(site: Site, branch: string, title: string) {
  assertSiteFeatureBranch(site, branch);
  await assertSiteContentBranch(site, branch);
  const name = siteEditBranchName(title);
  const { repository, token } = await siteRepositoryAccess(site, {
    contents: "write",
    pull_requests: "read",
  });
  assertSiteFeatureBranch(site, name);
  let renamed = false;
  let renameAttempted = false;
  const rename = async (from: string, to: string) => {
    try {
      await createOctokit(token).request(
        "POST /repos/{owner}/{repo}/branches/{branch}/rename",
        {
          owner: repository.owner,
          repo: repository.repo,
          branch: from,
          new_name: to,
          headers: GITHUB_API_VERSION_HEADERS,
        }
      );
    } catch (error) {
      if (
        error instanceof Error &&
        [403, 404].includes(Reflect.get(error, "status"))
      ) {
        throw new SiteInputError(
          "GitHub could not rename this branch. Grant the Notra GitHub App Contents: write, or ask a repository admin to rename a default or protected branch."
        );
      }
      throw error;
    }
  };
  // After an ambiguous GitHub response, keep drafts on the one ref that still exists.
  const reconcileRename = () =>
    withSiteBranchLock(
      site.id,
      branch,
      async (tx) => {
        await lockSiteBranchEdits(tx, site.id, name, true);
        const [oldHead, newHead] = await Promise.all(
          [branch, name].map((ref) =>
            createOctokit(token)
              .request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
                owner: repository.owner,
                repo: repository.repo,
                ref: `heads/${ref}`,
                headers: GITHUB_API_VERSION_HEADERS,
              })
              .catch((readError: unknown) => {
                if (isNotFoundError(readError)) {
                  return null;
                }
                throw readError;
              })
          )
        );
        if (!oldHead && newHead) {
          await moveSiteBranchDrafts(tx, site.id, branch, name);
          return name;
        }
        return oldHead ? branch : null;
      },
      true
    );
  try {
    await withSiteBranchLock(
      site.id,
      branch,
      async (tx) => {
        await lockSiteBranchEdits(tx, site.id, name, true);
        const existing = await tx
          .select({ id: siteDrafts.id })
          .from(siteDrafts)
          .where(
            and(eq(siteDrafts.siteId, site.id), eq(siteDrafts.branch, name))
          )
          .limit(1);
        if (existing.length) {
          throw new SiteInputError(
            "The target branch already has drafts. Discard those drafts or choose another name."
          );
        }
        const pr = await branchPullRequest(repository, token, branch);
        if (pr?.state === "OPEN") {
          throw new SiteInputError(
            "This branch has an open pull request. Merge or close it before renaming to preserve its reviews and discussion."
          );
        }
        renameAttempted = true;
        await rename(branch, name);
        renamed = true;
        await moveSiteBranchDrafts(tx, site.id, branch, name);
      },
      true
    );
  } catch (error) {
    if (!renamed) {
      if (renameAttempted && (await reconcileRename()) === name) {
        return { branch: name };
      }
      throw error;
    }
    // The transaction rolled back, so keep the old rows and restore their GitHub branch.
    try {
      await rename(name, branch);
    } catch {
      // The compensation may have landed without a response; follow whichever ref GitHub kept.
      if ((await reconcileRename()) === name) {
        return { branch: name };
      }
    }
    throw error;
  }
  return { branch: name };
}

export async function deleteSiteBranch(site: Site, branch: string) {
  assertSiteFeatureBranch(site, branch);
  await assertSiteContentBranch(site, branch);
  const { repository, token } = await siteRepositoryAccess(site, {
    contents: "write",
    pull_requests: "write",
  });
  await withSiteBranchLock(
    site.id,
    branch,
    async (tx) => {
      const pr = await branchPullRequest(
        repository,
        token,
        branch,
        site.productionBranch
      );
      if (pr?.state === "OPEN") {
        await createOctokit(token).request(
          "PATCH /repos/{owner}/{repo}/pulls/{pull_number}",
          {
            owner: repository.owner,
            repo: repository.repo,
            pull_number: pr.number,
            state: "closed",
            headers: GITHUB_API_VERSION_HEADERS,
          }
        );
      }
      await createOctokit(token).request(
        "DELETE /repos/{owner}/{repo}/git/refs/{ref}",
        {
          owner: repository.owner,
          repo: repository.repo,
          ref: `heads/${branch}`,
          headers: GITHUB_API_VERSION_HEADERS,
        }
      );
      await tx
        .delete(siteDrafts)
        .where(
          and(eq(siteDrafts.siteId, site.id), eq(siteDrafts.branch, branch))
        );
    },
    true
  );
  forgetSiteBranchWritable(site, branch);
}

export async function requestSiteBranchReview(site: Site, branch: string) {
  assertSiteFeatureBranch(site, branch);
  await assertSiteContentBranch(site, branch);
  const { repository, token } = await siteRepositoryAccess(site, {
    contents: "read",
    pull_requests: "write",
  });
  const pr = await branchPullRequest(
    repository,
    token,
    branch,
    site.productionBranch
  );
  if (pr?.state === "OPEN") {
    if (!pr.isDraft) {
      throw new SiteInputError("This branch is already ready for review");
    }
    await createOctokit(token).graphql(READY_FOR_REVIEW_MUTATION, {
      id: pr.id,
    });
    return;
  }
  // A branch can hold committed changes without a pull request, for example
  // one created from a branch whose edits were already saved.
  await openRepositoryPullRequest(repository, token, {
    title: "Update site content",
    head: branch,
    base: site.productionBranch,
    body: "Edited in Notra.",
  });
}

export async function mergeSiteBranch(site: Site, branch: string) {
  assertSiteFeatureBranch(site, branch);
  await assertSiteContentBranch(site, branch);
  if (branch === site.productionBranch) {
    throw new SiteInputError("Choose a feature branch");
  }
  const { repository, token } = await siteRepositoryAccess(site, {
    contents: "write",
    pull_requests: "write",
  });
  const validatedHead = await getBranchHead(repository, token, branch);
  const validation = await validateSiteDrafts(site, branch, validatedHead.sha);
  if (!validation.ok) {
    throw new SiteInputError("Fix the validation errors before merging");
  }
  return await withSiteBranchLock(
    site.id,
    branch,
    async (tx) => {
      const drafts = await pruneUnreferencedUploads(
        site,
        branch,
        await listSiteDraftSummaries(site.id, branch, tx),
        tx,
        () => publishedConfig(site, validatedHead.sha, { repository, token })
      );
      if (drafts.length > 0) {
        throw new SiteInputError(
          "Wait for all branch changes to save before merging"
        );
      }
      const pr = await branchPullRequest(
        repository,
        token,
        branch,
        site.productionBranch
      );
      if (pr?.mergeable === "CONFLICTING") {
        throw new SiteInputError(
          "Resolve this branch's merge conflicts on GitHub before merging."
        );
      }
      if (!pr || !canMergeBranch(pr) || pr.headRefOid !== validatedHead.sha) {
        throw new SiteInputError(
          "GitHub has not allowed this pull request to merge"
        );
      }
      const octokit = createOctokit(token);
      const params = {
        owner: repository.owner,
        repo: repository.repo,
        headers: GITHUB_API_VERSION_HEADERS,
      };
      for (const method of ["squash", "merge", "rebase"] as const) {
        try {
          const { data } = await octokit.request(
            "PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge",
            {
              ...params,
              pull_number: pr.number,
              sha: pr.headRefOid,
              merge_method: method,
            }
          );
          if (!data.merged) {
            throw new SiteInputError("GitHub did not merge the pull request");
          }
          return { branch: site.productionBranch, commitSha: data.sha };
        } catch (error) {
          if (
            !(error instanceof Error) ||
            Reflect.get(error, "status") !== 405 ||
            method === "rebase"
          ) {
            throw error;
          }
        }
      }
      throw new SiteInputError("GitHub did not allow any merge method");
    },
    true
  );
}

async function octokitFeatureRefs(repository: SiteRepository, token: string) {
  const { data } = await createOctokit(token).request(
    "GET /repos/{owner}/{repo}/git/matching-refs/{ref}",
    {
      owner: repository.owner,
      repo: repository.repo,
      ref: `heads/${SITE_EDIT_BRANCH_PREFIX}`,
      headers: GITHUB_API_VERSION_HEADERS,
    }
  );
  return data;
}

/** Files that differ between the deployment branch and `branch`. */
async function branchChangedFiles(
  repository: SiteRepository,
  token: string,
  base: string,
  branch: string
) {
  const { data } = await createOctokit(token).request(
    "GET /repos/{owner}/{repo}/compare/{basehead}",
    {
      owner: repository.owner,
      repo: repository.repo,
      basehead: `${base}...${branch}`,
      headers: GITHUB_API_VERSION_HEADERS,
    }
  );
  return data.ahead_by > 0 ? (data.files?.length ?? 0) : 0;
}

export async function discardDeletedSiteBranchDrafts(
  site: Site,
  branch: string
) {
  assertSiteFeatureBranch(site, branch);
  await assertSiteContentBranch(site, branch);
  const { repository, token } = await siteRepositoryAccess(site, {
    contents: "read",
  });
  await withSiteBranchLock(
    site.id,
    branch,
    async (tx) => {
      try {
        await getBranchHead(repository, token, branch);
      } catch (error) {
        if (!isNotFoundError(error)) {
          throw error;
        }
        await tx
          .delete(siteDrafts)
          .where(
            and(eq(siteDrafts.siteId, site.id), eq(siteDrafts.branch, branch))
          );
        return;
      }
      throw new SiteInputError("This branch still exists on GitHub");
    },
    true
  );
}
