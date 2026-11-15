import { setTimeout as delay } from "node:timers/promises";

import {
  GITHUB_CREATE_COMMIT_ON_BRANCH_MUTATION,
  GITHUB_API_VERSION_HEADERS,
} from "@notra/ai/constants/github";
import { generateSiteCommitHeadline } from "@notra/ai/utils/content-commit-message";
import { db } from "@notra/db/drizzle";
import { sites } from "@notra/db/schema";
import { validateSite } from "@notra/sites-compiler/validate";
import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";
import {
  SITE_IGNORE_FILENAME,
  SITE_IGNORE_MAX_BYTES,
} from "@notra/sites-core/constants/source";
import { createDefaultSiteConfig } from "@notra/sites-core/utils/default-config";
import { isSiteImageDraftPath } from "@notra/sites-core/utils/image-drafts";
import { createSiteIgnore } from "@notra/sites-core/utils/site-ignore";
import {
  isCollectedSiteSourcePath,
  isSiteSourcePath,
} from "@notra/sites-core/utils/source-files";
import { and, eq, getTableColumns, sql, or, isNull } from "drizzle-orm";

import {
  EDITABLE_PATH_SEGMENT,
  GENERATED_HEADLINE_DEADLINE_MS,
  EDITABLE_TEXT_FILE,
  MAX_PUBLISH_BYTES,
  MAX_GENERATED_HEADLINE_FILES,
  MAX_PUBLISH_HEADLINE_LENGTH,
  SITE_EDITOR_READ_CONCURRENCY,
  SITE_VALIDATE_MAX_FILE_BYTES,
  SITE_VALIDATE_MAX_FILES,
  SITE_VALIDATE_MAX_TOTAL_BYTES,
  STALE_HEAD_ERROR_PATTERN,
  VALIDATED_MARKDOWN_FILE,
  VALIDATED_SOURCE_FILE,
} from "./constants/editor";
import { SiteInputError, SitePublishConflictError } from "./errors/sites";
import { getBranchHead, siteRepositoryAccess } from "./github";
import {
  commitRepositoryFiles,
  openRepositoryPullRequest,
  readRepositoryBlobSha,
  readRepositoryFile,
} from "./repository";
import type { SiteStorageTransaction } from "./types/deployments";
import type {
  CreateCommitOnBranchResponse,
  PublishSiteDraftsInput,
  PublishSiteDraftsResult,
  RepositoryCommitInput,
  RepositoryPullRequestInput,
  RepositoryFileRef,
  RepositoryBranchInput,
  SaveSiteDraftInput,
  SiteDraftMutationInput,
  SiteDraft,
  SiteDraftSummary,
  SiteSourceEntry,
  SiteValidationDraftBudget,
  SitePublishedFile,
  SiteSourceFileContent,
  SiteSourceListing,
} from "./types/editor";
import type { SiteRepositoryAccess, SiteRepository } from "./types/github";
import type { Site } from "./types/sites";
import { createSiteBranchOctokit as createOctokit } from "./utils/branch-octokit";
import { branchPullRequest } from "./utils/branch-pull-request";
import { mapWithConcurrency } from "./utils/concurrency";
import { errorMessage, isNotFoundError } from "./utils/errors";
import { prefixedId } from "./utils/ids";
import { repositoryPath } from "./utils/root-directory";
import {
  lockSiteBranchEdits,
  withSiteBranchLock,
} from "./utils/site-branch-lock";
import { assertSiteBranchWritable } from "./utils/site-branch-writable";
import { siteDraftCodec } from "./utils/site-draft-codec";
import { siteDraftTable } from "./utils/site-draft-table";
import {
  assertSiteEditableBranch,
  assertSiteContentBranch,
} from "./utils/site-edit-branch";
import {
  cacheSourceBlob,
  readCachedSourceBlob,
} from "./utils/source-blob-cache";
import { pruneUnreferencedUploads } from "./utils/unreferenced-uploads";

function assertEditablePath(path: string): void {
  if (path === SITE_IGNORE_FILENAME) {
    return;
  }
  const editable =
    isSiteSourcePath(path) &&
    (EDITABLE_TEXT_FILE.test(path) || isSiteImageDraftPath(path)) &&
    path
      .split("/")
      .every(
        (segment) =>
          !segment.startsWith(".") && EDITABLE_PATH_SEGMENT.test(segment)
      );
  if (!editable) {
    throw new SiteInputError(`${path} is not an editable site file`);
  }
}

/** Drafts with changes GitHub hasn't received yet. */
function pendingDrafts(siteDrafts: ReturnType<typeof siteDraftTable>) {
  return or(
    isNull(siteDrafts.committedRevision),
    sql`${siteDrafts.revision} > ${siteDrafts.committedRevision}`
  );
}

/** Whether the published file already holds this draft's content. */
function draftMatchesFile(
  draft: Pick<SiteDraft, "path" | "content" | "deleted">,
  file: SitePublishedFile | null
): boolean {
  if (draft.deleted || !file) {
    return draft.deleted && !file;
  }
  return siteDraftCodec(draft.path).matches(draft.content, file);
}

function readAccess(site: Site) {
  return siteRepositoryAccess(site, { contents: "read" });
}

export async function listSiteSourceFiles(
  site: Site,
  branch = site.productionBranch,
  access?: SiteRepositoryAccess,
  commitSha?: string
): Promise<SiteSourceListing> {
  assertSiteEditableBranch(site, branch);
  await assertSiteContentBranch(site, branch);
  const { repository, token } = access ?? (await readAccess(site));
  const headSha =
    commitSha ?? (await getBranchHead(repository, token, branch)).sha;
  const { data: tree } = await createOctokit(token).request(
    "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
    {
      owner: repository.owner,
      repo: repository.repo,
      tree_sha: headSha,
      recursive: "1",
      headers: GITHUB_API_VERSION_HEADERS,
    }
  );
  const prefix = site.rootDirectory ? `${site.rootDirectory}/` : "";
  if (tree.truncated) {
    throw new SiteInputError(
      "The repository file listing is incomplete. Choose a smaller site repository before validating or publishing."
    );
  }
  const files: SiteSourceEntry[] = [];
  for (const entry of tree.tree) {
    if (!entry.path || !entry.path.startsWith(prefix)) {
      continue;
    }
    const path = entry.path.slice(prefix.length);
    if (path === SITE_IGNORE_FILENAME) {
      if (
        entry.type !== "blob" ||
        !entry.sha ||
        !["100644", "100755"].includes(entry.mode ?? "") ||
        entry.size === undefined ||
        !Number.isSafeInteger(entry.size) ||
        entry.size < 0 ||
        entry.size > SITE_IGNORE_MAX_BYTES
      ) {
        throw new SiteInputError(
          `${SITE_IGNORE_FILENAME} must be a regular file of at most ${SITE_IGNORE_MAX_BYTES / 1024} KB`
        );
      }
    } else if (
      entry.type !== "blob" ||
      !entry.sha ||
      (entry.mode !== undefined &&
        !["100644", "100755"].includes(entry.mode)) ||
      !isCollectedSiteSourcePath(path)
    ) {
      continue;
    }
    files.push({ path, sha: entry.sha, size: entry.size ?? 0 });
  }
  return {
    commitSha: headSha,
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
  };
}

export async function readSiteSourceFile(
  site: Site,
  path: string,
  ref = site.productionBranch,
  access?: SiteRepositoryAccess
): Promise<SiteSourceFileContent | null> {
  if (!access) {
    assertSiteEditableBranch(site, ref);
    await assertSiteContentBranch(site, ref);
  }
  assertEditablePath(path);
  const { repository, token } = access ?? (await readAccess(site));
  return await readRepositoryFile(repository, token, {
    path: repositoryPath(site.rootDirectory, path),
    ref,
  });
}

/** The config committed at `ref`; empty when the repository has none. */
export async function publishedConfig(
  site: Site,
  ref: string,
  access: SiteRepositoryAccess
): Promise<string> {
  return (
    (await readSiteSourceFile(site, SITE_CONFIG_FILENAME, ref, access))
      ?.content ?? ""
  );
}

/** The published file in the form its draft codec compares against. */
export async function readPublishedFile(
  site: Site,
  path: string,
  ref = site.productionBranch,
  access?: SiteRepositoryAccess
): Promise<SitePublishedFile | null> {
  if (siteDraftCodec(path).published === "content") {
    return await readSiteSourceFile(site, path, ref, access);
  }
  if (!access) {
    assertSiteEditableBranch(site, ref);
    await assertSiteContentBranch(site, ref);
  }
  assertEditablePath(path);
  const { repository, token } = access ?? (await readAccess(site));
  const sha = await readRepositoryBlobSha(repository, token, {
    path: repositoryPath(site.rootDirectory, path),
    ref,
  });
  return sha ? { sha, content: null } : null;
}

/** The draft table and filter for a site branch's pending drafts. */
async function pendingDraftScope(
  storage: Pick<typeof db, "select">,
  siteId: string,
  branch?: string
) {
  const [site] = await storage
    .select({ productionBranch: sites.productionBranch })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1);
  if (!site) {
    return null;
  }
  const activeBranch = branch ?? site.productionBranch;
  const siteDrafts = siteDraftTable(activeBranch, site.productionBranch);
  return {
    siteDrafts,
    where: and(
      eq(siteDrafts.siteId, siteId),
      eq(siteDrafts.branch, activeBranch),
      pendingDrafts(siteDrafts)
    ),
  };
}

export async function listSiteDrafts(
  siteId: string,
  branch?: string,
  storage: Pick<typeof db, "select"> = db
): Promise<SiteDraft[]> {
  const scope = await pendingDraftScope(storage, siteId, branch);
  return scope
    ? await storage.select().from(scope.siteDrafts).where(scope.where)
    : [];
}

/** Draft rows without their content; image drafts can be megabytes. */
export async function listSiteDraftSummaries(
  siteId: string,
  branch?: string,
  storage: Pick<typeof db, "select"> = db
): Promise<SiteDraftSummary[]> {
  const scope = await pendingDraftScope(storage, siteId, branch);
  if (!scope) {
    return [];
  }
  const { content: _content, ...columns } = getTableColumns(scope.siteDrafts);
  return await storage
    .select(columns)
    .from(scope.siteDrafts)
    .where(scope.where);
}

export async function readSiteDraft(
  site: Site,
  path: string,
  branch = site.productionBranch
): Promise<SiteDraft | null> {
  const siteDrafts = siteDraftTable(branch, site.productionBranch);
  const [draft] = await db
    .select()
    .from(siteDrafts)
    .where(
      and(
        eq(siteDrafts.siteId, site.id),
        eq(siteDrafts.branch, branch),
        eq(siteDrafts.path, path),
        pendingDrafts(siteDrafts)
      )
    )
    .limit(1);
  return draft ?? null;
}

async function lockSourceContext(
  tx: SiteStorageTransaction,
  siteId: string,
  input: Pick<SiteDraftMutationInput, "path" | "sourceContext">,
  action: "saving" | "discarding"
): Promise<void> {
  const [current] = await tx
    .select()
    .from(sites)
    .where(eq(sites.id, siteId))
    .for("update");
  if (
    !current ||
    (current.githubRepositoryId ?? "") !== input.sourceContext.repositoryId ||
    current.productionBranch !== input.sourceContext.productionBranch ||
    current.rootDirectory !== input.sourceContext.rootDirectory
  ) {
    throw new SitePublishConflictError(
      [input.path],
      `The site's source changed. Reload the editor before ${action}.`
    );
  }
}

export async function saveSiteDraft(
  site: Site,
  input: SaveSiteDraftInput,
  rebase = false
): Promise<SiteDraft> {
  assertEditablePath(input.path);
  if (!input.deleted) {
    siteDraftCodec(input.path).assertValid(input.path, input.content);
  }
  const branch = input.branch ?? site.productionBranch;
  assertSiteEditableBranch(site, branch);
  await assertSiteContentBranch(site, branch);
  const siteDrafts = siteDraftTable(branch, site.productionBranch);
  const access =
    branch === site.productionBranch ? null : await readAccess(site);
  return await db.transaction(async (tx) => {
    await lockSiteBranchEdits(tx, site.id, branch);
    if (access) {
      await assertSiteBranchWritable(site, access, branch);
    }
    // A flush can consume this exact revision while the UPDATE waits for its
    // row lock. Keep its content so recreation can prove GitHub accepted it.
    const [observed] =
      input.draftId !== null && branch === site.productionBranch
        ? await tx
            .select()
            .from(siteDrafts)
            .where(
              and(
                eq(siteDrafts.siteId, site.id),
                eq(siteDrafts.branch, branch),
                eq(siteDrafts.path, input.path),
                eq(siteDrafts.id, input.draftId),
                eq(siteDrafts.revision, input.draftRevision ?? -1)
              )
            )
            .limit(1)
        : [];
    await lockSourceContext(tx, site.id, input, "saving");
    if ((input.draftId === null) !== (input.draftRevision === null)) {
      throw new SiteInputError(
        "A draft ID and revision must be supplied together"
      );
    }
    const values = {
      content: input.content,
      baseBlobSha: input.baseBlobSha,
      baseCommitSha: input.baseCommitSha,
      deleted: input.deleted ?? false,
      updatedByUserId: input.userId,
      // Always written from here: the column has no time zone, and the
      // database default would use the server's local time instead of UTC.
      // Pruning uploads compares these timestamps across rows.
      updatedAt: new Date(),
    };
    let [draft] =
      input.draftId === null
        ? await tx
            .insert(siteDrafts)
            .values({
              id: prefixedId("drf"),
              siteId: site.id,
              branch: input.branch ?? site.productionBranch,
              path: input.path,
              ...values,
            })
            .onConflictDoUpdate({
              target:
                branch === site.productionBranch
                  ? [siteDrafts.siteId, siteDrafts.path]
                  : [siteDrafts.siteId, siteDrafts.branch, siteDrafts.path],
              set: {
                ...values,
                branch,
                revision: sql`${siteDrafts.revision} + 1`,
              },
              setWhere: eq(siteDrafts.revision, siteDrafts.committedRevision),
            })
            .returning()
        : await tx
            .update(siteDrafts)
            .set({
              ...values,
              baseBlobSha: rebase ? input.baseBlobSha : siteDrafts.baseBlobSha,
              baseCommitSha: rebase
                ? input.baseCommitSha
                : siteDrafts.baseCommitSha,
              revision: sql`${siteDrafts.revision} + 1`,
            })
            .where(
              and(
                eq(siteDrafts.siteId, site.id),
                eq(siteDrafts.branch, input.branch ?? site.productionBranch),
                eq(siteDrafts.path, input.path),
                eq(siteDrafts.id, input.draftId),
                eq(siteDrafts.revision, input.draftRevision ?? -1)
              )
            )
            .returning();
    if (!draft && observed) {
      const access = await readAccess(site);
      const head = await getBranchHead(access.repository, access.token, branch);
      const published = await readPublishedFile(
        site,
        input.path,
        head.sha,
        access
      );
      if (
        head.sha !== observed.baseCommitSha &&
        draftMatchesFile(observed, published)
      ) {
        [draft] = await tx
          .insert(siteDrafts)
          .values({
            id: observed.id,
            siteId: site.id,
            branch,
            path: input.path,
            ...values,
            revision: observed.revision + 1,
            baseBlobSha: published?.sha ?? null,
            baseCommitSha: head.sha,
          })
          .onConflictDoNothing()
          .returning();
      }
    }
    if (!draft) {
      throw new SitePublishConflictError(
        [input.path],
        "This draft changed in another editor. Reload it before saving."
      );
    }
    return draft;
  });
}

export async function rebaseSiteDraft(
  site: Site,
  input: SiteDraftMutationInput,
  userId: string
): Promise<SiteDraft | null> {
  assertSiteEditableBranch(site, input.branch ?? site.productionBranch);
  await assertSiteContentBranch(site, input.branch ?? site.productionBranch);
  const siteDrafts = siteDraftTable(
    input.branch ?? site.productionBranch,
    site.productionBranch
  );
  const { path } = input;
  const [draft] = await db
    .select()
    .from(siteDrafts)
    .where(
      and(
        eq(siteDrafts.siteId, site.id),
        eq(siteDrafts.branch, input.branch ?? site.productionBranch),
        eq(siteDrafts.path, path)
      )
    )
    .limit(1);
  if (!draft) {
    if (input.draftId !== null) {
      throw new SitePublishConflictError(
        [path],
        "This draft was removed in another editor. Reload it before rebasing."
      );
    }
    return null;
  }
  const current = await readSiteSourceFile(
    site,
    path,
    input.branch ?? site.productionBranch
  );
  return await saveSiteDraft(
    site,
    {
      ...input,
      content: draft.content,
      deleted: draft.deleted,
      baseBlobSha: current?.sha ?? null,
      baseCommitSha: draft.baseCommitSha,
      userId,
    },
    true
  );
}

export async function discardSiteDraft(
  site: Site,
  input: SiteDraftMutationInput
): Promise<void> {
  const branch = input.branch ?? site.productionBranch;
  assertSiteEditableBranch(site, branch);
  await assertSiteContentBranch(site, branch);
  const siteDrafts = siteDraftTable(branch, site.productionBranch);
  await db.transaction(async (tx) => {
    await lockSiteBranchEdits(tx, site.id, branch, true);
    await lockSourceContext(tx, site.id, input, "discarding");
    if (input.draftId === null || input.draftRevision === null) {
      const [existing] = await tx
        .select()
        .from(siteDrafts)
        .where(
          and(
            eq(siteDrafts.siteId, site.id),
            eq(siteDrafts.branch, input.branch ?? site.productionBranch),
            eq(siteDrafts.path, input.path)
          )
        )
        .limit(1);
      if (existing) {
        throw new SitePublishConflictError(
          [input.path],
          "This draft changed in another editor. Reload it before discarding."
        );
      }
      return;
    }
    const removed = await tx
      .delete(siteDrafts)
      .where(
        and(
          eq(siteDrafts.siteId, site.id),
          eq(siteDrafts.branch, input.branch ?? site.productionBranch),
          eq(siteDrafts.path, input.path),
          eq(siteDrafts.id, input.draftId),
          eq(siteDrafts.revision, input.draftRevision)
        )
      )
      .returning({ id: siteDrafts.id });
    if (removed.length === 0) {
      const [remaining] = await tx
        .select({ id: siteDrafts.id })
        .from(siteDrafts)
        .where(
          and(
            eq(siteDrafts.siteId, site.id),
            eq(siteDrafts.branch, branch),
            eq(siteDrafts.path, input.path)
          )
        )
        .limit(1);
      if (!remaining) {
        return;
      }
      throw new SitePublishConflictError(
        [input.path],
        "This draft changed in another editor. Reload it before discarding."
      );
    }
  });
}

/**
 * Markdown parses super-linearly, so oversized Markdown stays unread (the build
 * still checks it). Scripts are always read, since pages import their exports.
 * Drafts count toward the same total.
 */
function withinValidationBudget(
  entries: readonly SiteSourceEntry[],
  drafts: SiteValidationDraftBudget
) {
  const readable = entries.filter(
    (entry) =>
      entry.size <= SITE_VALIDATE_MAX_FILE_BYTES ||
      !VALIDATED_MARKDOWN_FILE.test(entry.path)
  );
  const totalBytes = readable.reduce(
    (sum, entry) => sum + entry.size,
    drafts.bytes
  );
  if (
    readable.length + drafts.count > SITE_VALIDATE_MAX_FILES ||
    totalBytes > SITE_VALIDATE_MAX_TOTAL_BYTES
  ) {
    throw new SiteInputError(
      "This site has too much content to check in the editor."
    );
  }
  return readable;
}

async function validateWithDrafts(
  site: Site,
  drafts: SiteDraft[],
  branch = site.productionBranch,
  providedAccess?: SiteRepositoryAccess,
  source?: SiteSourceListing
) {
  const access = providedAccess ?? (await readAccess(site));
  const { files: tree, commitSha } =
    source ?? (await listSiteSourceFiles(site, branch, access));
  const files = new Map<string, string | null>();
  for (const entry of tree) {
    files.set(entry.path, null);
  }
  const draftPaths = new Set(drafts.map((draft) => draft.path));
  const ignoreDraft = drafts.find(
    (draft) => draft.path === SITE_IGNORE_FILENAME
  );
  if (ignoreDraft) {
    if (ignoreDraft.deleted) {
      files.delete(SITE_IGNORE_FILENAME);
    } else {
      files.set(SITE_IGNORE_FILENAME, ignoreDraft.content);
    }
  } else if (files.has(SITE_IGNORE_FILENAME)) {
    const ignoreFile = await readSiteSourceFile(
      site,
      SITE_IGNORE_FILENAME,
      commitSha,
      access
    );
    files.set(SITE_IGNORE_FILENAME, ignoreFile?.content ?? null);
  }
  const isIgnored = createSiteIgnore(files.get(SITE_IGNORE_FILENAME) ?? "");
  const validatedDrafts = drafts.filter(
    (draft) => !draft.deleted && VALIDATED_SOURCE_FILE.test(draft.path)
  );
  const draftBudget = {
    count: validatedDrafts.length,
    bytes: validatedDrafts.reduce(
      (sum, draft) => sum + Buffer.byteLength(draft.content, "utf8"),
      0
    ),
  };
  const needsContent = withinValidationBudget(
    tree.filter(
      (entry) =>
        (VALIDATED_SOURCE_FILE.test(entry.path) ||
          entry.path === SITE_CONFIG_FILENAME) &&
        !draftPaths.has(entry.path) &&
        !isIgnored(entry.path)
    ),
    draftBudget
  );
  const contents = await mapWithConcurrency(
    needsContent,
    SITE_EDITOR_READ_CONCURRENCY,
    (entry) => readSourceEntry(site, entry, commitSha, access)
  );
  for (const [index, entry] of needsContent.entries()) {
    files.set(entry.path, contents[index]?.content ?? null);
  }
  for (const draft of drafts) {
    if (draft.deleted) {
      files.delete(draft.path);
    } else {
      files.set(
        draft.path,
        siteDraftCodec(draft.path).toValidator(draft.content)
      );
    }
  }
  return validateSite({
    files,
    defaultConfig: createDefaultSiteConfig(site.name),
  });
}

/** A listed source file, served from the blob cache when this instance has read it before. */
async function readSourceEntry(
  site: Site,
  entry: SiteSourceEntry,
  ref: string,
  access: SiteRepositoryAccess
) {
  const cached = readCachedSourceBlob(access.repository, entry.sha);
  if (cached) {
    return cached;
  }
  const file = await readSiteSourceFile(site, entry.path, ref, access);
  if (file?.sha === entry.sha) {
    cacheSourceBlob(access.repository, file);
  }
  return file;
}

export async function validateSiteDrafts(
  site: Site,
  branch = site.productionBranch,
  commitSha?: string
) {
  const access = commitSha ? await readAccess(site) : undefined;
  const source = commitSha
    ? await listSiteSourceFiles(site, branch, access, commitSha)
    : undefined;
  return await validateWithDrafts(
    site,
    await listSiteDrafts(site.id, branch),
    branch,
    access,
    source
  );
}

function fallbackPublishHeadline(drafts: readonly SiteDraft[]) {
  if (drafts.every(({ path }) => path === SITE_CONFIG_FILENAME)) {
    return "style: update site design";
  }
  if (drafts.every(({ path }) => /\.mdx?$/.test(path))) {
    return "docs: update blog posts";
  }
  return "chore: update site";
}

async function generatePublishHeadline(
  site: Site,
  drafts: readonly SiteDraft[],
  ref: string,
  access: SiteRepositoryAccess
) {
  const fallback = fallbackPublishHeadline(drafts);
  if (drafts.length === 0) {
    return fallback;
  }
  const changes = await mapWithConcurrency(
    drafts.slice(0, MAX_GENERATED_HEADLINE_FILES),
    SITE_EDITOR_READ_CONCURRENCY,
    async (draft) => {
      if (siteDraftCodec(draft.path).published !== "content") {
        return { path: draft.path, deleted: draft.deleted };
      }
      const previous = draft.baseBlobSha
        ? await readSourceEntry(
            site,
            { path: draft.path, sha: draft.baseBlobSha, size: 0 },
            ref,
            access
          ).catch(() => null)
        : null;
      return {
        path: draft.path,
        deleted: draft.deleted,
        previous: previous?.content ?? null,
        next: draft.deleted ? null : draft.content,
      };
    }
  );
  return await generateSiteCommitHeadline({
    organizationId: site.organizationId,
    changes: [
      ...changes,
      ...drafts
        .slice(MAX_GENERATED_HEADLINE_FILES)
        .map((draft) => ({ path: draft.path, deleted: draft.deleted })),
    ],
    fallback,
  });
}

export async function publishSiteDrafts(
  site: Site,
  input: PublishSiteDraftsInput
): Promise<PublishSiteDraftsResult> {
  const branch = input.branch ?? site.productionBranch;
  if (branch !== site.productionBranch) {
    throw new SiteInputError("Feature branches save automatically");
  }
  return await flushSiteDrafts(site, { ...input, branch });
}

export async function flushSiteDrafts(
  site: Site,
  input: PublishSiteDraftsInput
): Promise<PublishSiteDraftsResult> {
  const branch = input.branch ?? site.productionBranch;
  assertSiteEditableBranch(site, branch);
  await assertSiteContentBranch(site, branch);
  const siteDrafts = siteDraftTable(branch, site.productionBranch);
  const access = await siteRepositoryAccess(site, {
    contents: "write",
    pull_requests: "write",
  });
  return await withSiteBranchLock(
    site.id,
    branch,
    async (tx) => {
      const [currentSite] = await tx
        .select()
        .from(sites)
        .where(eq(sites.id, site.id));
      if (
        !currentSite ||
        currentSite.productionBranch !== site.productionBranch ||
        currentSite.rootDirectory !== site.rootDirectory
      ) {
        throw new SitePublishConflictError(
          [],
          "The site's source changed. Reload the editor."
        );
      }
      const production = branch === site.productionBranch;
      const { repository, token } = access;
      const head = await getBranchHead(repository, token, branch);
      await assertSiteBranchWritable(site, access, branch, head);
      const drafts = await pruneUnreferencedUploads(
        site,
        branch,
        await listSiteDrafts(site.id, branch, tx),
        tx,
        () => publishedConfig(site, head.sha, access)
      );
      if (drafts.length === 0) {
        return { commitSha: head.sha, pullRequestUrl: null };
      }
      // Written while the checks below run; both wait on GitHub.
      const headlinePending = input.message?.trim()
        ? Promise.resolve(
            input.message.trim().slice(0, MAX_PUBLISH_HEADLINE_LENGTH)
          )
        : Promise.race([
            generatePublishHeadline(site, drafts, head.sha, access),
            delay(GENERATED_HEADLINE_DEADLINE_MS, undefined, { ref: false }),
          ]).then(
            (headline) => headline ?? fallbackPublishHeadline(drafts),
            () => fallbackPublishHeadline(drafts)
          );
      const source = await listSiteSourceFiles(site, branch, access, head.sha);
      if (production) {
        const validation = await validateWithDrafts(
          site,
          drafts,
          branch,
          access,
          source
        );
        if (!validation.ok) {
          const first = validation.diagnostics.find(
            (diagnostic) => diagnostic.severity === "error"
          );
          throw new SiteInputError(
            `Fix the errors first: ${first?.file ?? "site"}: ${first?.message ?? "invalid site"}`
          );
        }
      }
      const { commitSha: headSha, files } = source;
      const current = new Map(files.map((file) => [file.path, file.sha]));
      const conflicts: string[] = [];
      const pending: SiteDraft[] = [];
      for (const draft of drafts) {
        if ((current.get(draft.path) ?? null) === draft.baseBlobSha) {
          pending.push(draft);
          continue;
        }
        const file = await readPublishedFile(site, draft.path, headSha, access);
        // A previous attempt may have committed successfully before opening its PR failed.
        if (!draftMatchesFile(draft, file)) {
          conflicts.push(draft.path);
        }
      }
      if (conflicts.length > 0) {
        throw new SitePublishConflictError(
          conflicts,
          `Changed on GitHub since you started editing: ${conflicts.join(", ")}. Reload them and re-apply your edits.`
        );
      }
      const additions = pending.filter((draft) => !draft.deleted);
      const bytes = additions.reduce(
        (total, draft) =>
          total + siteDraftCodec(draft.path).byteSize(draft.content),
        0
      );
      if (bytes > MAX_PUBLISH_BYTES) {
        throw new SiteInputError(
          `These changes are larger than ${MAX_PUBLISH_BYTES / 1024 / 1024} MB. Publish some of them separately.`
        );
      }
      const headline = await headlinePending;
      let commitSha = headSha;
      if (pending.length > 0) {
        try {
          commitSha = await commitRepositoryFiles(repository, token, {
            branch,
            headline,
            expectedHeadOid: headSha,
            additions: additions.map((draft) => ({
              path: repositoryPath(site.rootDirectory, draft.path),
              contents: siteDraftCodec(draft.path).toCommit(draft.content),
            })),
            deletions: pending
              .filter((draft) => draft.deleted)
              .map((draft) => repositoryPath(site.rootDirectory, draft.path)),
          });
        } catch (error) {
          if (STALE_HEAD_ERROR_PATTERN.test(errorMessage(error))) {
            throw new SitePublishConflictError(
              [],
              `${branch} moved while publishing. Try again.`
            );
          }
          throw error;
        }
      }
      let pullRequestUrl: string | null = null;
      if (!production) {
        const existing = await branchPullRequest(
          repository,
          token,
          branch,
          site.productionBranch
        );
        pullRequestUrl =
          existing?.state === "OPEN"
            ? existing.url
            : await openRepositoryPullRequest(repository, token, {
                title: headline,
                head: branch,
                base: site.productionBranch,
                body: "Edited in Notra.",
                draft: true,
              });
      }
      const committed =
        commitSha === headSha
          ? source
          : await listSiteSourceFiles(site, branch, access, commitSha);
      const blobs = new Map(
        committed.files.map((file) => [file.path, file.sha])
      );
      for (const draft of drafts) {
        // Feature branches keep committed text drafts; images would only hold
        // megabytes the branch already has, so they go like on production.
        if (production || isSiteImageDraftPath(draft.path)) {
          await tx
            .delete(siteDrafts)
            .where(
              and(
                eq(siteDrafts.id, draft.id),
                eq(siteDrafts.revision, draft.revision)
              )
            );
        }
        await tx
          .update(siteDrafts)
          .set({
            baseBlobSha: blobs.get(draft.path) ?? null,
            baseCommitSha: commitSha,
            committedRevision: draft.revision,
          })
          .where(
            and(
              eq(siteDrafts.id, draft.id),
              sql`${siteDrafts.baseBlobSha} is not distinct from ${draft.baseBlobSha}`
            )
          );
      }
      return { commitSha, pullRequestUrl };
    },
    false,
    input.skipIfBusy
      ? async () => ({
          commitSha: (
            await getBranchHead(access.repository, access.token, branch)
          ).sha,
          pullRequestUrl: null,
        })
      : undefined
  );
}
