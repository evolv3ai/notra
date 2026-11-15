import { db } from "@notra/db/drizzle";
import {
  SITE_IMAGE_UPLOAD_DIRECTORY,
  SITE_IMAGE_UPLOAD_MAX_BYTES,
} from "@notra/sites-core/constants/uploads";
import { sitePublicAssetPath } from "@notra/sites-core/utils/image-drafts";

import {
  listSiteDraftSummaries,
  readPublishedFile,
  readSiteDraft,
  saveSiteDraft,
} from "./editor";
import { SiteInputError, SitePublishConflictError } from "./errors/sites";
import type {
  SaveSiteImageDraftInput,
  SiteDraft,
  SiteDraftSummary,
} from "./types/editor";
import type { Site } from "./types/sites";
import { gitBlobSha, sniffSiteImageExtension } from "./utils/image-type";
import { imageTooLargeError } from "./utils/site-draft-codec";
import { unreferencedUploads } from "./utils/unreferenced-uploads";

function uploadStem(fileName: string): string {
  return (
    fileName
      .replace(/\.[^.]*$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "image"
  );
}

/** Store an uploaded image as a draft under public/images; publish commits it. */
export async function saveSiteImageDraft(
  site: Site,
  input: SaveSiteImageDraftInput
): Promise<{ path: string; draft: SiteDraft | null }> {
  if (input.bytes.byteLength > SITE_IMAGE_UPLOAD_MAX_BYTES) {
    throw imageTooLargeError();
  }
  const extension = sniffSiteImageExtension(input.bytes);
  if (!extension) {
    throw new SiteInputError(
      "Upload a PNG, JPEG, WebP, AVIF, GIF, SVG or ICO image"
    );
  }
  const blobSha = gitBlobSha(input.bytes);
  // The content hash keeps names unique and busts caches when an image changes.
  const path = `${SITE_IMAGE_UPLOAD_DIRECTORY}/${uploadStem(input.fileName)}-${blobSha.slice(0, 10)}${extension}`;
  const served = sitePublicAssetPath(path);
  const branch = input.branch ?? site.productionBranch;
  const content = Buffer.from(input.bytes).toString("base64");
  const holdsUpload = (draft: SiteDraft) =>
    !draft.deleted && draft.content === content;
  const [existing, published] = await Promise.all([
    readSiteDraft(site, path, branch),
    readPublishedFile(site, path, branch),
  ]);
  // Reusing a draft must renew its grace period too: another tab can publish
  // while this request is still returning the path for the next config save.
  if (!existing && published?.sha === blobSha) {
    return { path: served, draft: null };
  }
  try {
    const draft = await saveSiteDraft(site, {
      branch: input.branch,
      path,
      content,
      baseBlobSha: existing ? existing.baseBlobSha : (published?.sha ?? null),
      baseCommitSha: input.baseCommitSha,
      draftId: existing?.id ?? null,
      draftRevision: existing?.revision ?? null,
      sourceContext: input.sourceContext,
      userId: input.userId,
    });
    return { path: served, draft };
  } catch (error) {
    // The same file dropped into two fields at once: the other upload won.
    const raced = await readSiteDraft(site, path, branch);
    if (
      error instanceof SitePublishConflictError &&
      raced &&
      holdsUpload(raced)
    ) {
      return { path: served, draft: raced };
    }
    throw error;
  }
}

/**
 * The drafts the next publish commits: uploads the saved config stopped
 * referencing are left out. Only the database is read.
 */
export async function listPendingSiteDraftSummaries(
  site: Site,
  branch = site.productionBranch
): Promise<SiteDraftSummary[]> {
  const drafts = await listSiteDraftSummaries(site.id, branch);
  const orphans = await unreferencedUploads(site, branch, drafts, db);
  return drafts.filter((draft) => !orphans.includes(draft));
}
