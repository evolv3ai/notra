import { db } from "@notra/db/drizzle";
import { sites } from "@notra/db/schema";
import { SITE_R2_KEYS } from "@notra/sites-core/constants/sites";
import type {
  PreviewActivationResult,
  ProductionActivationResult,
} from "@notra/sites-core/types/serving-state";
import { hashBuildTarget } from "@notra/sites-core/utils/build-target";
import { isPostPreviewKey } from "@notra/sites-core/utils/hosts";
import { referencedDeploymentIds } from "@notra/sites-core/utils/serving-state";
import { eq } from "drizzle-orm";

import {
  allocateGeneration,
  getProductionDeploymentHistory,
} from "./deployments";
import { SiteActivationContentionError, SiteInputError } from "./errors/sites";
import { readPostPreviewSource } from "./post-preview-source";
import { r2GetText } from "./r2";
import { reportOutcome } from "./reporting";
import {
  activatePreviewDeployment,
  activateProductionDeployment,
  readServingState,
  reconcileProductionProjection,
} from "./state";
import type {
  ActivationOutcome,
  LiveDeployments,
  SiteDeployment,
} from "./types/deployments";
import type { Site } from "./types/sites";
import { invalidateSiteIngestCaches } from "./utils/ingest-cache";
import { postPreviewPointerAccess } from "./utils/post-preview-access";
import { withSiteStorageLock } from "./utils/site-storage-lock";
import { buildTargetForDeployment } from "./utils/urls";

async function hasStoredFiles(
  site: Site,
  deployment: SiteDeployment
): Promise<boolean> {
  return Boolean(
    await r2GetText(SITE_R2_KEYS.manifest(site.id, deployment.id))
  );
}

function liveUnlessSuperseded(
  outcome: ProductionActivationResult | PreviewActivationResult
): ActivationOutcome {
  if (outcome.outcome === "held") {
    return "held";
  }
  return outcome.outcome === "superseded" ? "not_live" : "live";
}

export async function activateDeployment(
  site: Site,
  deployment: SiteDeployment
): Promise<ActivationOutcome> {
  let generation = deployment.generation;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const activationGeneration = generation;
    const outcome = await withSiteStorageLock(site.id, async (tx) => {
      const [currentSite] = await tx
        .select()
        .from(sites)
        .where(eq(sites.id, site.id))
        .for("update");
      if (
        !currentSite ||
        currentSite.status !== "active" ||
        // A build of the previous repository must not replace the switch.
        (deployment.githubRepositoryId !== null &&
          deployment.githubRepositoryId !== currentSite.githubRepositoryId) ||
        (deployment.kind === "preview" && !currentSite.previewsEnabled) ||
        !(await hasStoredFiles(currentSite, deployment))
      ) {
        return "not_live";
      }
      if (deployment.kind === "production") {
        const serving = await readServingState(site.id);
        const current = serving?.state.production;
        if (
          !serving?.state.productionRollback &&
          current &&
          current.generation >= activationGeneration &&
          deployment.generation >
            (current.buildGeneration ?? current.generation)
        ) {
          return "reserve_generation";
        }
        return liveUnlessSuperseded(
          await activateProductionDeployment(
            currentSite,
            {
              deploymentId: deployment.id,
              generation: activationGeneration,
              buildGeneration: deployment.generation,
            },
            tx
          )
        );
      }
      if (!deployment.previewKey) {
        throw new Error("Preview deployment without a preview key");
      }
      // Read under the lock that access changes take, so they can't be lost.
      let ownAccess = null;
      if (isPostPreviewKey(deployment.previewKey)) {
        const source = await readPostPreviewSource(
          site.id,
          deployment.previewKey
        );
        // A build finishing after expiry/cleanup must not recreate an open link.
        if (!source || Date.parse(source.access.expiresAt) <= Date.now()) {
          return "not_live";
        }
        ownAccess = source.access;
      }
      return liveUnlessSuperseded(
        await activatePreviewDeployment(
          currentSite,
          deployment.previewKey,
          {
            deploymentId: deployment.id,
            sequence: deployment.generation,
            ...(ownAccess
              ? postPreviewPointerAccess(ownAccess)
              : { visibility: currentSite.previewVisibility, expiresAt: null }),
          },
          tx
        )
      );
    });
    if (outcome === "reserve_generation") {
      generation = (await allocateGeneration(db, site.id, site.organizationId))
        .lastGeneration;
      continue;
    }
    if (outcome === "live" && deployment.kind === "production") {
      await invalidateSiteIngestCaches(site);
    }
    return outcome;
  }
  throw new SiteActivationContentionError(
    "Production changed while activating this build. Retry activation."
  );
}

export async function selectProductionDeployment(
  site: Site,
  deploymentId: string | null
): Promise<void> {
  const { lastGeneration } = await allocateGeneration(
    db,
    site.id,
    site.organizationId
  );
  const selected = await withSiteStorageLock(site.id, async (tx) => {
    const [currentSite] = await tx
      .select()
      .from(sites)
      .where(eq(sites.id, site.id))
      .for("update");
    if (
      !currentSite ||
      currentSite.organizationId !== site.organizationId ||
      currentSite.status !== "active"
    ) {
      throw new SiteInputError(
        "Only active sites can switch production builds"
      );
    }
    const serving = await readServingState(site.id);
    if (
      deploymentId !== null &&
      serving?.state.production?.deploymentId === deploymentId
    ) {
      if (!serving.state.productionRollback) {
        throw new SiteInputError("This deployment is already live");
      }
      await reconcileProductionProjection(currentSite, tx);
      return;
    }
    const history = await getProductionDeploymentHistory(site.id, tx);
    const target =
      deploymentId === null
        ? history[0]
        : history.find((deployment) => deployment.id === deploymentId);
    if (!target) {
      throw new SiteInputError(
        "Only the last ten successful production builds can be restored"
      );
    }
    if (deploymentId !== null && history[0]?.id === target.id) {
      throw new SiteInputError(
        "Use Promote to publish the latest successful build"
      );
    }
    const currentTarget = buildTargetForDeployment({
      site: currentSite,
      kind: "production",
      previewKey: null,
    });
    if ((await hashBuildTarget(currentTarget)) !== target.configHash) {
      throw new SiteInputError(
        "This deployment was built for a different domain, path or branding setting. Redeploy its commit instead."
      );
    }
    if (!(await hasStoredFiles(currentSite, target))) {
      throw new SiteInputError(
        "This deployment's files were already cleaned up. Redeploy its commit instead."
      );
    }
    const outcome = await activateProductionDeployment(
      currentSite,
      {
        deploymentId: target.id,
        generation: lastGeneration,
        buildGeneration: target.generation,
      },
      tx,
      deploymentId !== null
    );
    if (outcome.outcome === "superseded") {
      throw new SiteInputError(
        "Production changed while switching builds. Try again."
      );
    }
    return { site: currentSite, deployment: target };
  });
  await invalidateSiteIngestCaches(site);
  if (selected && deploymentId === null) {
    await reportOutcome(selected.site, selected.deployment, { kind: "live" });
  }
}

export async function readLiveDeployments(
  siteId: string
): Promise<LiveDeployments> {
  const serving = await readServingState(siteId);
  return {
    previews: serving?.state.previews ?? {},
    ids: serving ? referencedDeploymentIds(serving.state) : new Set(),
  };
}
