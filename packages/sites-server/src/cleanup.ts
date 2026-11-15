import { siteDeployments } from "@notra/db/schema";
import {
  SITE_DEPLOYMENT_IN_PROGRESS_STATUSES,
  SITE_R2_KEYS,
} from "@notra/sites-core/constants/sites";
import { isPostPreviewKey } from "@notra/sites-core/utils/hosts";
import { removePreviewFromState } from "@notra/sites-core/utils/serving-state";
import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";

import { readLiveDeployments } from "./activation";
import { DEPLOYMENT_SETTLE_MS } from "./constants/deployments";
import {
  allocateGeneration,
  cancelPreviewBuilds,
  getProductionDeploymentHistory,
  getSite,
  transitionDeployment,
} from "./deployments";
import { publishSiteDeploymentChange } from "./live";
import { readPostPreviewSource } from "./post-preview-source";
import { r2DeleteKey, r2DeletePrefix, r2ListPrefixes } from "./r2";
import { mutateServingState, readServingState } from "./state";
import type { SiteStorageTransaction } from "./types/deployments";
import type { Site, SiteCleanupResult } from "./types/sites";
import { withSiteStorageLock } from "./utils/site-storage-lock";

/** Called under the same lock as source writes, access changes and activation. */
async function expirePostPreviews(site: Site, tx: SiteStorageTransaction) {
  const serving = await readServingState(site.id);
  const sourceRoot = `previews/${site.id}/`;
  const keys = new Set(Object.keys(serving?.state.previews ?? {}));
  // Also find sources from failed builds and interrupted removals with no pointer.
  for (const prefix of await r2ListPrefixes(sourceRoot)) {
    keys.add(prefix.slice(sourceRoot.length).replace(/\/$/, ""));
  }
  const now = new Date();
  let expired = 0;
  for (const previewKey of keys) {
    if (!isPostPreviewKey(previewKey)) {
      continue;
    }
    const source = await readPostPreviewSource(site.id, previewKey);
    // A source may have been extended before a serving-state write failed.
    const expiresAt =
      source?.access.expiresAt ??
      serving?.state.previews[previewKey]?.expiresAt;
    if (!expiresAt || !(Date.parse(expiresAt) <= now.getTime())) {
      continue;
    }
    const { lastGeneration } = await allocateGeneration(tx, site.id);
    await mutateServingState(
      site,
      (state) => ({
        write: removePreviewFromState(state, previewKey, lastGeneration, now),
        result: undefined,
      }),
      tx
    );
    await cancelPreviewBuilds(site.id, previewKey, lastGeneration, tx);
    // Do not take removePostPreviewSource's lock again inside this transaction.
    await r2DeleteKey(SITE_R2_KEYS.previewSource(site.id, previewKey));
    expired += 1;
  }
  return expired;
}

async function listUnsettledDeploymentIds(
  siteId: string,
  tx: SiteStorageTransaction,
  deploymentId?: string
) {
  const settledBefore = new Date(Date.now() - DEPLOYMENT_SETTLE_MS);
  return await tx
    .select({ id: siteDeployments.id })
    .from(siteDeployments)
    .where(
      and(
        eq(siteDeployments.siteId, siteId),
        deploymentId ? eq(siteDeployments.id, deploymentId) : undefined,
        or(
          inArray(siteDeployments.status, [
            ...SITE_DEPLOYMENT_IN_PROGRESS_STATUSES,
          ]),
          and(
            eq(siteDeployments.status, "ready"),
            or(
              isNull(siteDeployments.finishedAt),
              gt(siteDeployments.finishedAt, settledBefore)
            )
          )
        )
      )
    );
}

export async function cleanupSiteDeployments(
  siteId: string
): Promise<SiteCleanupResult> {
  const cleanup = await withSiteStorageLock(siteId, async (tx) => {
    const site = await getSite(siteId, tx);
    if (!site) {
      return { deleted: [], organizationId: null, expiredPreviews: 0 };
    }
    const expiredPreviews = await expirePostPreviews(site, tx);
    const [unsettled, history] = await Promise.all([
      listUnsettledDeploymentIds(site.id, tx),
      getProductionDeploymentHistory(site.id, tx),
    ]);
    const { ids: protectedIds } = await readLiveDeployments(site.id);
    for (const row of [...unsettled, ...history]) {
      protectedIds.add(row.id);
    }
    const root = `deployments/${site.id}/`;
    const deleted: string[] = [];
    for (const prefix of await r2ListPrefixes(root)) {
      const deploymentId = prefix.slice(root.length).replace(/\/$/, "");
      if (protectedIds.has(deploymentId)) {
        continue;
      }
      if (
        (await listUnsettledDeploymentIds(site.id, tx, deploymentId)).length > 0
      ) {
        continue;
      }
      await r2DeletePrefix(prefix);
      await transitionDeployment(deploymentId, "expired", {}, tx);
      deleted.push(deploymentId);
    }
    return { deleted, organizationId: site.organizationId, expiredPreviews };
  });
  if (
    cleanup.organizationId &&
    (cleanup.deleted.length > 0 || cleanup.expiredPreviews > 0)
  ) {
    await publishSiteDeploymentChange(cleanup.organizationId, siteId);
  }
  return { deleted: cleanup.deleted };
}
