import { db } from "@notra/db/drizzle";
import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";
import {
  SITE_IMAGE_UPLOAD_FILE,
  SITE_IMAGE_UPLOAD_PRUNE_GRACE_MS,
} from "@notra/sites-core/constants/uploads";
import {
  isSiteImageDraftPath,
  sitePublicAssetPath,
} from "@notra/sites-core/utils/image-drafts";
import { and, eq, inArray } from "drizzle-orm";

import type { SiteDraftSummary } from "../types/editor";
import type { Site } from "../types/sites";
import { siteDraftTable } from "./site-draft-table";

/**
 * Uploads nothing references anymore, e.g. a background replaced before
 * publishing. Existing repository files never count. An upload only counts
 * once the config was saved after it, or it has sat unreferenced for a while,
 * so a flush racing the config save that will reference it can't drop it.
 * Without a config draft the published config is a reference too; without
 * `readPublishedConfig` such uploads are all kept.
 */
export async function unreferencedUploads<T extends SiteDraftSummary>(
  site: Site,
  branch: string,
  drafts: T[],
  storage: Pick<typeof db, "select">,
  readPublishedConfig?: () => Promise<string>
): Promise<T[]> {
  const config = drafts.find((draft) => draft.path === SITE_CONFIG_FILENAME);
  const settledBefore =
    config && !config.deleted
      ? config.updatedAt.getTime()
      : Date.now() - SITE_IMAGE_UPLOAD_PRUNE_GRACE_MS;
  const candidates = drafts.filter(
    (draft) =>
      !draft.deleted &&
      draft.baseBlobSha === null &&
      SITE_IMAGE_UPLOAD_FILE.test(draft.path) &&
      draft.updatedAt.getTime() < settledBefore
  );
  // A deleted config draft still keeps what the published config references.
  const needsPublished = !config || config.deleted;
  if (candidates.length === 0 || (needsPublished && !readPublishedConfig)) {
    return [];
  }
  const siteDrafts = siteDraftTable(branch, site.productionBranch);
  const textIds = drafts
    .filter((draft) => !draft.deleted && !isSiteImageDraftPath(draft.path))
    .map((draft) => draft.id);
  const references =
    textIds.length > 0
      ? (
          await storage
            .select({ content: siteDrafts.content })
            .from(siteDrafts)
            .where(inArray(siteDrafts.id, textIds))
        ).map((draft) => draft.content)
      : [];
  if (needsPublished && readPublishedConfig) {
    references.push(await readPublishedConfig());
  }
  return candidates.filter((draft) => {
    const served = sitePublicAssetPath(draft.path).slice(1);
    return !references.some((text) => text.includes(served));
  });
}

/**
 * Returns the drafts without unreferenced uploads and deletes those that have
 * sat unreferenced for the grace period. Newer ones are only skipped: the
 * browser may still be waiting on the upload response before it adds the path.
 */
export async function pruneUnreferencedUploads<T extends SiteDraftSummary>(
  site: Site,
  branch: string,
  drafts: T[],
  storage: Pick<typeof db, "select" | "delete">,
  readPublishedConfig: () => Promise<string>
): Promise<T[]> {
  const orphans = await unreferencedUploads(
    site,
    branch,
    drafts,
    storage,
    readPublishedConfig
  );
  const siteDrafts = siteDraftTable(branch, site.productionBranch);
  const settled = Date.now() - SITE_IMAGE_UPLOAD_PRUNE_GRACE_MS;
  for (const orphan of orphans) {
    if (orphan.updatedAt.getTime() >= settled) {
      continue;
    }
    await storage
      .delete(siteDrafts)
      .where(
        and(
          eq(siteDrafts.id, orphan.id),
          eq(siteDrafts.revision, orphan.revision)
        )
      );
  }
  return drafts.filter((draft) => !orphans.includes(draft));
}
