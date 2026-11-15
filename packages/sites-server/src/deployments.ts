import { db } from "@notra/db/drizzle";
import { siteDeployments, siteJobs, sites, users } from "@notra/db/schema";
import {
  SITE_BUILD_LIMITS,
  SITE_DEPLOYMENT_IN_PROGRESS_STATUSES,
  SITE_DEPLOYMENT_TRANSITIONS,
} from "@notra/sites-core/constants/sites";
import { hashBuildTarget } from "@notra/sites-core/utils/build-target";
import { and, desc, eq, gt, inArray, lte, ne, or, sql } from "drizzle-orm";

import { ROLLBACK_HISTORY } from "./constants/deployments";
import { SiteNotBuildableError } from "./errors/sites";
import { publishSiteDeploymentChange } from "./live";
import { enforceSitePlanBranding } from "./plan-limits";
import type {
  DeploymentExecutor,
  DeploymentTransitionValues,
  EnqueueDeploymentInput,
  EnqueuedDeployment,
  SiteDeployment,
  SiteDeploymentStatus,
  SiteStorageTransaction,
} from "./types/deployments";
import type { SettingsJobAttempt } from "./types/jobs";
import type { Site } from "./types/sites";
import { prefixedId } from "./utils/ids";
import { lockSiteOrganization } from "./utils/site-organization-lock";
import { buildTargetForDeployment } from "./utils/urls";

export async function getProductionDeploymentHistory(
  siteId: string,
  executor: Pick<SiteStorageTransaction, "select"> = db
): Promise<SiteDeployment[]> {
  return await executor
    .select()
    .from(siteDeployments)
    .where(
      and(
        eq(siteDeployments.siteId, siteId),
        eq(siteDeployments.kind, "production"),
        eq(siteDeployments.status, "ready")
      )
    )
    .orderBy(desc(siteDeployments.generation))
    .limit(ROLLBACK_HISTORY);
}

export async function allocateGeneration(
  executor: DeploymentExecutor,
  siteId: string,
  organizationId?: string
): Promise<Site> {
  const [site] = await executor
    .update(sites)
    .set({ lastGeneration: sql`${sites.lastGeneration} + 1` })
    .where(
      and(
        eq(sites.id, siteId),
        organizationId === undefined
          ? undefined
          : eq(sites.organizationId, organizationId)
      )
    )
    .returning();
  if (!site) {
    throw new SiteNotBuildableError("Site not found");
  }
  return site;
}

export async function transitionDeployment(
  id: string,
  to: SiteDeploymentStatus,
  values: DeploymentTransitionValues = {},
  executor: DeploymentExecutor = db
): Promise<boolean> {
  const updated = await executor
    .update(siteDeployments)
    .set({ ...values, status: to })
    .where(
      and(
        eq(siteDeployments.id, id),
        inArray(siteDeployments.status, [...SITE_DEPLOYMENT_TRANSITIONS[to]])
      )
    )
    .returning({
      siteId: siteDeployments.siteId,
      organizationId: siteDeployments.organizationId,
    });
  const [row] = updated;
  // Inside a transaction the caller announces the change once it committed.
  if (row && executor === db) {
    await publishSiteDeploymentChange(row.organizationId, row.siteId);
  }
  return Boolean(row);
}

export async function cancelPreviewBuilds(
  siteId: string,
  previewKey: string,
  generation: number,
  executor: DeploymentExecutor = db
): Promise<void> {
  const canceled = await executor
    .update(siteDeployments)
    .set({ status: "canceled", finishedAt: new Date() })
    .where(
      and(
        eq(siteDeployments.siteId, siteId),
        eq(siteDeployments.previewKey, previewKey),
        lte(siteDeployments.generation, generation),
        inArray(siteDeployments.status, [
          ...SITE_DEPLOYMENT_TRANSITIONS.canceled,
        ])
      )
    )
    .returning({ organizationId: siteDeployments.organizationId });
  const [row] = canceled;
  if (row && executor === db) {
    await publishSiteDeploymentChange(row.organizationId, siteId);
  }
}

export async function enqueueSiteDeployment(
  input: EnqueueDeploymentInput,
  assertCurrentHead?: () => Promise<void>
): Promise<EnqueuedDeployment> {
  await enforceSitePlanBranding(input.siteId);
  const enqueued = await db.transaction(async (tx) => {
    const organizationId = await lockSiteOrganization(tx, input.siteId);
    if (!organizationId) {
      throw new SiteNotBuildableError("Site workspace not found");
    }
    if (input.deduplicateCommit) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify(["sites-deploy-commit", input.siteId, input.kind, input.previewKey, input.commitSha])}, 0))`
      );
      const [existing] = await tx
        .select({ deployment: siteDeployments, jobId: siteJobs.id })
        .from(siteDeployments)
        .innerJoin(
          siteJobs,
          and(
            eq(siteJobs.deploymentId, siteDeployments.id),
            eq(siteJobs.kind, "build")
          )
        )
        .where(
          and(
            eq(siteDeployments.siteId, input.siteId),
            eq(siteDeployments.commitSha, input.commitSha),
            eq(siteDeployments.kind, input.kind),
            eq(siteDeployments.branch, input.branch),
            inArray(siteDeployments.status, [
              "queued",
              "building",
              "uploading",
            ]),
            inArray(siteJobs.status, ["pending", "running"]),
            sql`${siteDeployments.previewKey} is not distinct from ${input.previewKey}`
          )
        )
        .limit(1);
      if (existing) {
        return existing;
      }
    }
    if (assertCurrentHead) {
      // Keep head verification and generation allocation in the same admission order.
      await tx
        .select({ id: sites.id })
        .from(sites)
        .where(eq(sites.id, input.siteId))
        .for("update");
      await assertCurrentHead();
    }
    return await insertDeployment(tx, input, organizationId);
  });
  await publishSiteDeploymentChange(
    enqueued.deployment.organizationId,
    enqueued.deployment.siteId
  );
  return enqueued;
}

async function insertDeployment(
  tx: SiteStorageTransaction,
  input: EnqueueDeploymentInput,
  organizationId: string,
  dedupeKey?: string
): Promise<EnqueuedDeployment> {
  const site = await allocateGeneration(tx, input.siteId, organizationId);
  if (site.status !== "active") {
    throw new SiteNotBuildableError("This site is suspended");
  }
  if (input.kind === "preview" && !site.previewsEnabled) {
    throw new SiteNotBuildableError("Previews are turned off for this site");
  }
  if (
    input.githubRepositoryId &&
    input.githubRepositoryId !== site.githubRepositoryId
  ) {
    throw new SiteNotBuildableError(
      "This build came from a repository the site no longer builds from"
    );
  }
  const buildBudgetReserved = !(
    site.smartDeployments && ["push", "pull_request"].includes(input.trigger)
  );
  if (buildBudgetReserved) {
    await assertBuildBudget(tx, site.organizationId);
  }
  const target = buildTargetForDeployment({
    site,
    kind: input.kind,
    previewKey: input.previewKey,
  });
  const [deployment] = await tx
    .insert(siteDeployments)
    .values({
      id: prefixedId("dep"),
      siteId: site.id,
      organizationId: site.organizationId,
      kind: input.kind,
      previewKey: input.previewKey,
      trigger: input.trigger,
      status: "queued",
      buildBudgetReserved,
      generation: site.lastGeneration,
      githubRepositoryId: site.githubRepositoryId,
      repositoryOwner: site.repositoryOwner,
      repositoryName: site.repositoryName,
      branch: input.branch,
      commitSha: input.commitSha,
      commitMessage: input.commitMessage ?? null,
      commitAuthor: input.commitAuthor ?? null,
      pullRequestNumber: input.pullRequestNumber ?? null,
      target,
      configHash: await hashBuildTarget(target),
      requestedByUserId: input.requestedByUserId ?? null,
    })
    .returning();
  if (!deployment) {
    throw new Error("Could not create deployment");
  }
  const jobId = prefixedId("job");
  await tx.insert(siteJobs).values({
    id: jobId,
    siteId: site.id,
    deploymentId: deployment.id,
    kind: "build",
    dedupeKey: dedupeKey ?? `build:${deployment.id}`,
  });
  return { deployment, jobId };
}

async function assertBuildBudget(
  tx: SiteStorageTransaction,
  organizationId: string,
  excludeId?: string,
  alreadyStarted = false
): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`sites-deployment-budget:${organizationId}`}, 0))`
  );
  if (alreadyStarted) {
    return;
  }
  const [usage] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(siteDeployments)
    .where(
      and(
        eq(siteDeployments.organizationId, organizationId),
        excludeId ? ne(siteDeployments.id, excludeId) : undefined,
        or(
          gt(siteDeployments.startedAt, sql`now() - interval '24 hours'`),
          and(
            eq(siteDeployments.buildBudgetReserved, true),
            eq(siteDeployments.status, "queued"),
            gt(siteDeployments.createdAt, sql`now() - interval '24 hours'`)
          )
        )
      )
    );
  if (
    (usage?.count ?? 0) >= SITE_BUILD_LIMITS.maxDeploymentsPerOrganizationPerDay
  ) {
    throw new SiteNotBuildableError(
      `This workspace reached ${SITE_BUILD_LIMITS.maxDeploymentsPerOrganizationPerDay} deployments in 24 hours. Try again later.`
    );
  }
}

/** Reserve actual builds atomically; smart comparisons can still run at the limit. */
export async function startDeploymentBuild(
  deployment: SiteDeployment,
  startedAt: Date
): Promise<boolean> {
  const started = await db.transaction(async (tx) => {
    const organizationId = await lockSiteOrganization(tx, deployment.siteId);
    if (!organizationId) {
      return false;
    }
    const [site] = await tx
      .select()
      .from(sites)
      .where(eq(sites.id, deployment.siteId))
      .for("update");
    const [current] = await tx
      .select()
      .from(siteDeployments)
      .where(
        and(
          eq(siteDeployments.id, deployment.id),
          eq(siteDeployments.siteId, deployment.siteId),
          eq(siteDeployments.organizationId, organizationId)
        )
      )
      .limit(1);
    if (
      !current ||
      !SITE_DEPLOYMENT_TRANSITIONS.building.includes(current.status)
    ) {
      return false;
    }
    const repositoryChanged = Boolean(
      site &&
      current.githubRepositoryId &&
      current.githubRepositoryId !== site.githubRepositoryId
    );
    if (
      !site ||
      site.status !== "active" ||
      repositoryChanged ||
      (current.kind === "preview" && !site.previewsEnabled)
    ) {
      let errorMessage = "The site is offline.";
      if (site?.status === "active") {
        errorMessage = repositoryChanged
          ? "The site now builds from a different repository."
          : "Previews are turned off for this site.";
      }
      await transitionDeployment(
        current.id,
        "canceled",
        { finishedAt: new Date(), errorMessage },
        tx
      );
      return false;
    }
    await assertBuildBudget(
      tx,
      organizationId,
      deployment.id,
      current.startedAt !== null
    );
    return transitionDeployment(
      current.id,
      "building",
      { startedAt: current.startedAt ?? startedAt },
      tx
    );
  });
  await publishSiteDeploymentChange(
    deployment.organizationId,
    deployment.siteId
  );
  return started;
}

export async function enqueueSettingsDeployment(
  input: EnqueueDeploymentInput,
  attempt: SettingsJobAttempt
): Promise<string | null> {
  await enforceSitePlanBranding(input.siteId);
  const enqueued = await db.transaction(async (tx) => {
    const organizationId = await lockSiteOrganization(tx, input.siteId);
    if (!organizationId) {
      return null;
    }
    const [job] = await tx
      .select()
      .from(siteJobs)
      .where(
        and(
          eq(siteJobs.id, attempt.id),
          eq(siteJobs.siteId, input.siteId),
          eq(siteJobs.kind, "sync_state"),
          eq(siteJobs.status, "running"),
          eq(siteJobs.attempts, attempt.attempts),
          gt(siteJobs.leaseUntil, sql`now()`)
        )
      )
      .for("update");
    if (!job) {
      return null;
    }
    const dedupeKey = `settings-build:${job.id}`;
    const [existing] = await tx
      .select({ id: siteJobs.id })
      .from(siteJobs)
      .where(eq(siteJobs.dedupeKey, dedupeKey));
    if (existing) {
      return { jobId: existing.id, organizationId: null };
    }
    const [site] = await tx
      .select()
      .from(sites)
      .where(
        and(
          eq(sites.id, input.siteId),
          eq(sites.organizationId, organizationId)
        )
      )
      .for("update");
    if (!site || site.status !== "active") {
      return null;
    }
    if (site.productionBranch !== input.branch) {
      throw new Error(
        "Site production branch changed while resolving its head"
      );
    }
    let requestedByUserId = input.requestedByUserId ?? null;
    if (requestedByUserId) {
      const [user] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, requestedByUserId))
        .for("key share");
      requestedByUserId = user?.id ?? null;
    }
    const { jobId } = await insertDeployment(
      tx,
      { ...input, requestedByUserId },
      organizationId,
      dedupeKey
    );
    return { jobId, organizationId };
  });
  if (enqueued?.organizationId) {
    await publishSiteDeploymentChange(enqueued.organizationId, input.siteId);
  }
  return enqueued?.jobId ?? null;
}

export async function enqueuePreviewRemoval(
  siteId: string,
  previewKey: string
): Promise<string> {
  const jobId = prefixedId("job");
  await db.transaction(async (tx) => {
    const { lastGeneration } = await allocateGeneration(tx, siteId);
    await tx.insert(siteJobs).values({
      id: jobId,
      siteId,
      kind: "remove_preview",
      payload: { previewKey, generation: lastGeneration },
    });
  });
  return jobId;
}

export async function hasNewerDeployment(
  deployment: SiteDeployment,
  branchHead: string | null
): Promise<boolean> {
  const slot =
    deployment.kind === "production"
      ? eq(siteDeployments.kind, "production")
      : and(
          eq(siteDeployments.kind, "preview"),
          eq(siteDeployments.previewKey, deployment.previewKey ?? "")
        );
  const [newer] = await db
    .select({ id: siteDeployments.id })
    .from(siteDeployments)
    .where(
      and(
        eq(siteDeployments.siteId, deployment.siteId),
        slot,
        sql`${siteDeployments.generation} > ${deployment.generation}`,
        inArray(siteDeployments.status, [
          ...SITE_DEPLOYMENT_IN_PROGRESS_STATUSES,
          "ready",
        ]),
        branchHead
          ? or(
              eq(siteDeployments.trigger, "redeploy"),
              eq(siteDeployments.commitSha, branchHead)
            )
          : undefined
      )
    )
    .limit(1);
  return Boolean(newer);
}

export async function getDeployment(
  id: string
): Promise<SiteDeployment | null> {
  const [deployment] = await db
    .select()
    .from(siteDeployments)
    .where(eq(siteDeployments.id, id))
    .limit(1);
  return deployment ?? null;
}

export async function getSite(
  id: string,
  executor: Pick<typeof db, "select"> = db
): Promise<Site | null> {
  const [site] = await executor
    .select()
    .from(sites)
    .where(eq(sites.id, id))
    .limit(1);
  return site ?? null;
}

export async function listSiteDeployments(
  siteId: string,
  limit = 50,
  referencedIds: readonly string[] = [],
  kind?: SiteDeployment["kind"]
): Promise<SiteDeployment[]> {
  const recent = await db
    .select()
    .from(siteDeployments)
    .where(
      kind
        ? and(
            eq(siteDeployments.siteId, siteId),
            eq(siteDeployments.kind, kind)
          )
        : eq(siteDeployments.siteId, siteId)
    )
    .orderBy(desc(siteDeployments.createdAt))
    .limit(limit);
  const known = new Set(recent.map((deployment) => deployment.id));
  const missing = [...new Set(referencedIds)].filter((id) => !known.has(id));
  if (missing.length === 0) {
    return recent;
  }
  const referenced = await db
    .select()
    .from(siteDeployments)
    .where(
      and(
        eq(siteDeployments.siteId, siteId),
        inArray(siteDeployments.id, missing)
      )
    );
  return [...recent, ...referenced].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
  );
}
