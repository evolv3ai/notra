import { db } from "@notra/db/drizzle";
import { siteDeployments } from "@notra/db/schema";
import {
  POST_PREVIEW_LIFETIMES,
  SITE_PREVIEW_PASSWORD_MAX_LENGTH,
} from "@notra/sites-core/constants/sites";
import {
  branchPreviewKey,
  postPreviewKey,
} from "@notra/sites-core/utils/hosts";
import { hashPreviewPassword } from "@notra/sites-core/utils/preview-password";
import { isCollectedSiteSourcePath } from "@notra/sites-core/utils/source-files";
import { and, desc, eq } from "drizzle-orm";

import { MAX_POST_PREVIEW_BYTES } from "./constants/editor";
import { SANDBOX_UPLOAD_CHUNK_BYTES } from "./constants/sandbox";
import { deployBranchHead } from "./deploy";
import { allocateGeneration, enqueuePreviewRemoval } from "./deployments";
import { SiteInputError } from "./errors/sites";
import {
  readPostPreviewSource,
  writePostPreviewSource,
} from "./post-preview-source";
import { mutateServingState } from "./state";
import type { SiteDeployment } from "./types/deployments";
import type {
  BranchPreviewResult,
  CreatePostPreviewInput,
  PostPreviewLifetime,
  PostPreviewSource,
  Site,
  UpdatePostPreviewAccessInput,
} from "./types/sites";
import { postPreviewPointerAccess } from "./utils/post-preview-access";
import { withSiteStorageLock } from "./utils/site-storage-lock";

function assertPreviewsEnabled(site: Site) {
  if (!site.previewsEnabled) {
    throw new SiteInputError("Previews are turned off for this site");
  }
}

export async function createBranchPreview(
  site: Site,
  branch: string,
  userId: string
): Promise<BranchPreviewResult> {
  assertPreviewsEnabled(site);
  if (branch === site.productionBranch) {
    throw new SiteInputError("The production branch is already deployed live");
  }
  const previewKey = branchPreviewKey(branch, site.slug);
  const jobId = await deployBranchHead(site, {
    trigger: "manual",
    userId,
    branch,
    previewKey,
  });
  return { jobId, previewKey };
}

function previewExpiry(lifetime: PostPreviewLifetime, now: Date): string {
  return new Date(
    now.getTime() + POST_PREVIEW_LIFETIMES[lifetime] * 1000
  ).toISOString();
}

async function hashPassword(password: string | null) {
  if (password === null) {
    return null;
  }
  if (password.length > SITE_PREVIEW_PASSWORD_MAX_LENGTH) {
    throw new SiteInputError("The password is too long");
  }
  return await hashPreviewPassword(password);
}

/**
 * Builds the production branch with a post's files laid on top, without
 * touching the repository. Each post keeps one preview that the next call
 * replaces.
 */
export async function createPostPreview(
  site: Site,
  input: CreatePostPreviewInput
): Promise<BranchPreviewResult> {
  assertPreviewsEnabled(site);
  let totalBytes = 0;
  for (const file of input.files) {
    if (!isCollectedSiteSourcePath(file.path)) {
      throw new SiteInputError(`${file.path} is not a site file`);
    }
    if (file.contents.byteLength > SANDBOX_UPLOAD_CHUNK_BYTES) {
      throw new SiteInputError(`${file.path} is too large to preview`);
    }
    totalBytes += file.contents.byteLength;
  }
  if (totalBytes > MAX_POST_PREVIEW_BYTES) {
    throw new SiteInputError(
      "The post and its images are too large to preview"
    );
  }
  const previewKey = postPreviewKey(input.postId, site.slug);
  const hashedPassword =
    input.password === undefined
      ? undefined
      : await hashPassword(input.password);
  // Under the storage lock, with a fresh generation, so a removal queued
  // earlier can tell this source is newer and leave it alone.
  await withSiteStorageLock(site.id, async (tx) => {
    const { lastGeneration } = await allocateGeneration(tx, site.id);
    const password =
      hashedPassword === undefined
        ? ((await readPostPreviewSource(site.id, previewKey))?.access
            .password ?? null)
        : hashedPassword;
    await writePostPreviewSource(site.id, previewKey, {
      generation: lastGeneration,
      pagePath: input.pagePath,
      files: input.files.map((file) => ({
        path: file.path,
        content: Buffer.from(file.contents).toString("base64"),
      })),
      access: {
        lifetime: input.lifetime,
        expiresAt: previewExpiry(input.lifetime, new Date()),
        password,
      },
    });
  });
  const jobId = await deployBranchHead(site, {
    trigger: "manual",
    userId: input.userId,
    previewKey,
    commitMessage: `Preview: ${input.title}`,
  });
  return { jobId, previewKey };
}

/** Changes how long a post preview stays open and its password, without a rebuild. */
export async function updatePostPreviewAccess(
  site: Site,
  previewKey: string,
  input: UpdatePostPreviewAccessInput
): Promise<PostPreviewSource["access"]> {
  const password =
    input.password === undefined
      ? undefined
      : await hashPassword(input.password);
  // Shares the lock with activation and new builds so neither can write
  // back stale access over this change.
  return await withSiteStorageLock(site.id, async (tx) => {
    const source = await readPostPreviewSource(site.id, previewKey);
    if (!source) {
      throw new SiteInputError("This post has no preview yet");
    }
    const access = {
      lifetime: input.lifetime ?? source.access.lifetime,
      expiresAt: input.lifetime
        ? previewExpiry(input.lifetime, new Date())
        : source.access.expiresAt,
      password: password === undefined ? source.access.password : password,
    };
    await writePostPreviewSource(site.id, previewKey, { ...source, access });
    await mutateServingState(
      site,
      (state) => {
        const pointer = state.previews[previewKey];
        if (!pointer) {
          return { skip: true, result: undefined };
        }
        return {
          write: {
            ...state,
            previews: {
              ...state.previews,
              [previewKey]: { ...pointer, ...postPreviewPointerAccess(access) },
            },
            updatedAt: new Date().toISOString(),
          },
          result: undefined,
        };
      },
      tx
    );
    return access;
  });
}

export async function deletePreview(
  site: Site,
  previewKey: string
): Promise<string> {
  return await enqueuePreviewRemoval(site.id, previewKey);
}

export async function latestPreviewDeployment(
  siteId: string,
  previewKey: string
): Promise<SiteDeployment | null> {
  const [deployment] = await db
    .select()
    .from(siteDeployments)
    .where(
      and(
        eq(siteDeployments.siteId, siteId),
        eq(siteDeployments.previewKey, previewKey)
      )
    )
    .orderBy(desc(siteDeployments.createdAt))
    .limit(1);
  return deployment ?? null;
}
