import { db } from "@notra/db/drizzle";
import { siteJobs, sites } from "@notra/db/schema";
import { isPostPreviewKey } from "@notra/sites-core/utils/hosts";
import { and, eq, gt, sql } from "drizzle-orm";

import { BUILDABLE_STATUSES } from "./constants/jobs";
import {
  cancelPreviewBuilds,
  enqueueSettingsDeployment,
  getDeployment,
  getSite,
} from "./deployments";
import { SandboxRequestError } from "./errors/sandbox";
import { SitePermanentBuildError } from "./errors/sites";
import { getBranchHead, siteRepositoryAccess } from "./github";
import {
  claimSiteJob,
  completeSiteJob,
  failSiteJob,
  takeExhaustedSiteJobs,
} from "./jobs";
import { publishSiteDeploymentChange } from "./live";
import { failDeployment, runDeploymentPipeline } from "./pipeline";
import { removePostPreviewSource } from "./post-preview-source";
import {
  reconcileProductionProjection,
  removePreviewDeployment,
  syncServingAccess,
} from "./state";
import type { JobDeployment, SiteJob, SiteJobOutcome } from "./types/jobs";
import { errorMessage } from "./utils/errors";
import { invalidateSiteIngestCaches } from "./utils/ingest-cache";
import { withSiteStorageLock } from "./utils/site-storage-lock";

async function loadJobDeployment(job: SiteJob): Promise<JobDeployment | null> {
  const deployment = job.deploymentId
    ? await getDeployment(job.deploymentId)
    : null;
  const site = deployment ? await getSite(deployment.siteId) : null;
  return deployment && site ? { site, deployment } : null;
}

async function runBuildJob(
  job: SiteJob,
  onFinalized: () => void
): Promise<SiteJobOutcome> {
  const loaded = await loadJobDeployment(job);
  if (!(loaded && BUILDABLE_STATUSES.has(loaded.deployment.status))) {
    await completeSiteJob(job);
    return { status: "skipped" };
  }
  const outcome = await runDeploymentPipeline(
    loaded.site,
    loaded.deployment,
    onFinalized
  );
  await completeSiteJob(job);
  return { status: "done", outcome: outcome.kind };
}

async function runRemovePreviewJob(job: SiteJob): Promise<SiteJobOutcome> {
  const site = await getSite(job.siteId);
  const previewKey =
    "previewKey" in job.payload ? job.payload.previewKey : null;
  if (site && previewKey) {
    const generation =
      "generation" in job.payload ? job.payload.generation : null;
    if (
      !Number.isSafeInteger(generation) ||
      generation === null ||
      generation < 1
    ) {
      throw new SitePermanentBuildError(
        "Preview removal job has no generation"
      );
    }
    await removePreviewDeployment(site, previewKey, generation);
    await cancelPreviewBuilds(site.id, previewKey, generation);
    if (isPostPreviewKey(previewKey)) {
      await removePostPreviewSource(site.id, previewKey, generation);
    }
  }
  await completeSiteJob(job);
  return { status: "done" };
}

async function runSettingsJob(job: SiteJob): Promise<SiteJobOutcome> {
  if (!("rebuild" in job.payload)) {
    throw new SitePermanentBuildError(
      "Settings job has no reconciliation intent"
    );
  }
  const { rebuild, removePreviewsThrough, requestedByUserId } = job.payload;
  const site = await withSiteStorageLock(job.siteId, async (tx) => {
    const [currentJob] = await tx
      .select({ id: siteJobs.id })
      .from(siteJobs)
      .where(
        and(
          eq(siteJobs.id, job.id),
          eq(siteJobs.status, "running"),
          eq(siteJobs.attempts, job.attempts),
          gt(siteJobs.leaseUntil, sql`now()`)
        )
      )
      .for("update");
    if (!currentJob) {
      return null;
    }
    const [current] = await tx
      .select()
      .from(sites)
      .where(eq(sites.id, job.siteId))
      .for("update");
    if (!current) {
      return null;
    }
    const keys = await syncServingAccess(current, tx, removePreviewsThrough);
    if (removePreviewsThrough !== null) {
      await Promise.all(
        keys.map((key) =>
          cancelPreviewBuilds(current.id, key, removePreviewsThrough, tx)
        )
      );
    }
    await reconcileProductionProjection(current, tx);
    return current;
  });
  if (!site) {
    return { status: "skipped" };
  }
  if (removePreviewsThrough !== null) {
    await publishSiteDeploymentChange(site.organizationId, site.id);
  }
  await invalidateSiteIngestCaches(site);
  if (rebuild && site.status === "active") {
    const [existing] = await db
      .select({ id: siteJobs.id })
      .from(siteJobs)
      .where(eq(siteJobs.dedupeKey, `settings-build:${job.id}`));
    if (!existing) {
      const { repository, token } = await siteRepositoryAccess(site, {
        contents: "read",
      });
      const head = await getBranchHead(
        repository,
        token,
        site.productionBranch
      );
      const buildJobId = await enqueueSettingsDeployment(
        {
          siteId: site.id,
          kind: "production",
          previewKey: null,
          trigger: "config",
          branch: site.productionBranch,
          commitSha: head.sha,
          commitMessage: head.message,
          commitAuthor: head.author,
          requestedByUserId,
          githubRepositoryId: repository.githubRepositoryId,
        },
        job
      );
      if (!buildJobId) {
        return { status: "skipped" };
      }
    }
  }
  await completeSiteJob(job);
  return { status: "done" };
}

async function failJobDeployment(job: SiteJob, message: string): Promise<void> {
  const loaded = await loadJobDeployment(job);
  if (loaded) {
    await failDeployment(loaded.site, loaded.deployment, message);
  }
}

export async function runSiteJob(jobId: string): Promise<SiteJobOutcome> {
  const job = await claimSiteJob(jobId);
  if (!job) {
    return { status: "skipped" };
  }
  let finalizationComplete = false;
  try {
    if (job.kind === "sync_state") {
      return await runSettingsJob(job);
    }
    return job.kind === "remove_preview"
      ? await runRemovePreviewJob(job)
      : await runBuildJob(job, () => {
          finalizationComplete = true;
        });
  } catch (error) {
    const message = errorMessage(error);
    console.error("sites.job_failed", {
      jobId,
      siteId: job.siteId,
      deploymentId: job.deploymentId,
      attempt: job.attempts,
      maxAttempts: job.maxAttempts,
      sandbox:
        error instanceof SandboxRequestError
          ? {
              operation: error.operation,
              status: error.status,
              requestId: error.requestId,
              responseBody: error.responseBody,
            }
          : undefined,
      error: error instanceof Error ? error.stack : message,
    });
    const permanent = error instanceof SitePermanentBuildError;
    const result = await failSiteJob(
      job,
      error,
      permanent,
      finalizationComplete
    );
    if (result === "failed") {
      await failJobDeployment(
        job,
        permanent
          ? message
          : `Deployment failed after ${job.attempts} attempts: ${message}`
      );
    }
    return { status: result };
  }
}

export async function reapExhaustedSiteJobs(): Promise<number> {
  const jobs = await takeExhaustedSiteJobs();
  await Promise.all(
    jobs.map((job) =>
      failJobDeployment(
        job,
        "The build stopped responding and ran out of retries. Redeploy to try again."
      )
    )
  );
  return jobs.length;
}
