import "server-only";
import { db } from "@notra/db/drizzle";
import { siteDeployments, siteJobs, sites } from "@notra/db/schema";
import { SITE_DEPLOYMENT_IN_PROGRESS_STATUSES } from "@notra/sites-core/constants/sites";
import type { SiteMounts } from "@notra/sites-core/types/deployment";
import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  or,
  sql,
} from "drizzle-orm";

import {
  SITE_DEPLOYMENTS_LIMIT,
  SITE_FAILED_JOBS_LIMIT,
  SITE_OVERVIEW_WINDOW_MS,
} from "@/constants/sites";
import {
  getWorkspaceOwner,
  getWorkspaceSiteCounts,
} from "@/lib/moderation/queries";
import { readLiveBuildLog, readServingState } from "@/lib/sites/r2";
import type {
  SiteAdminDeployment,
  SiteAdminDeploymentDetail,
  SiteAdminDetail,
  SiteAdminListItem,
  SiteAdminOverview,
  SiteBuildActivityDay,
  SiteRecentBuild,
  SiteDeploymentRow,
  SiteServingState,
} from "@/types/sites";

function primaryMountUrl(origin: string, mounts: SiteMounts): string {
  const mount = mounts.blog ?? mounts.changelog;
  return `${origin}${mount && mount !== "/" ? mount : "/"}`;
}

function liveDeploymentIds(state: SiteServingState | null): Set<string> {
  const live = new Set<string>();
  if (state?.production) {
    live.add(state.production.deploymentId);
  }
  for (const pointer of Object.values(state?.previews ?? {})) {
    live.add(pointer.deploymentId);
  }
  return live;
}

function serializeDeployment(
  deployment: SiteDeploymentRow,
  live: Set<string>
): SiteAdminDeployment {
  return {
    id: deployment.id,
    kind: deployment.kind,
    previewKey: deployment.previewKey,
    trigger: deployment.trigger,
    status: deployment.status,
    live: live.has(deployment.id),
    generation: deployment.generation,
    branch: deployment.branch,
    commitSha: deployment.commitSha,
    commitMessage: deployment.commitMessage,
    commitAuthor: deployment.commitAuthor,
    pullRequestNumber: deployment.pullRequestNumber,
    url: primaryMountUrl(
      deployment.target.publicOrigin,
      deployment.target.mounts
    ),
    toolchainVersion: deployment.toolchainVersion,
    fileCount: deployment.fileCount,
    totalBytes: deployment.totalBytes,
    buildDurationMs: deployment.buildDurationMs,
    diagnostics: deployment.diagnostics,
    errorMessage: deployment.errorMessage,
    createdAt: deployment.createdAt,
    startedAt: deployment.startedAt,
    finishedAt: deployment.finishedAt,
  };
}

// Builds, jobs and domains are written by the dashboard, so the global query
// cache would never see them change. Every site read skips it.

export async function getSitesOverview(): Promise<SiteAdminOverview> {
  const since = new Date(Date.now() - SITE_OVERVIEW_WINDOW_MS);
  const now = new Date();
  const [siteCounts, deploymentCounts, jobCounts] = await Promise.all([
    db
      .select({
        total: count(),
        suspended: count(
          sql`case when ${sites.status} = 'suspended' then 1 end`
        ),
      })
      .from(sites)
      .$withCache(false),
    db
      .select({
        total: count(
          sql`case when ${gte(siteDeployments.createdAt, since)} then 1 end`
        ),
        failed: count(
          sql`case when ${siteDeployments.status} = 'failed' then 1 end`
        ),
        ready: count(
          sql`case when ${siteDeployments.status} = 'ready' then 1 end`
        ),
        inProgress: count(
          sql`case when ${inArray(siteDeployments.status, [...SITE_DEPLOYMENT_IN_PROGRESS_STATUSES])} then 1 end`
        ),
      })
      .from(siteDeployments)
      .where(
        or(
          gte(siteDeployments.createdAt, since),
          inArray(siteDeployments.status, [
            ...SITE_DEPLOYMENT_IN_PROGRESS_STATUSES,
          ])
        )
      )
      .$withCache(false),
    db
      .select({
        failed: count(sql`case when ${siteJobs.status} = 'failed' then 1 end`),
        stuck: count(
          sql`case when ${siteJobs.status} = 'running' and ${siteJobs.leaseUntil} < ${now} then 1 end`
        ),
        pending: count(
          sql`case when ${siteJobs.status} = 'pending' then 1 end`
        ),
      })
      .from(siteJobs)
      .where(
        or(
          gte(siteJobs.createdAt, since),
          eq(siteJobs.status, "pending"),
          and(eq(siteJobs.status, "running"), lt(siteJobs.leaseUntil, now))
        )
      )
      .$withCache(false),
  ]);

  const deploymentsRow = deploymentCounts[0];
  return {
    sites: siteCounts[0]?.total ?? 0,
    suspended: siteCounts[0]?.suspended ?? 0,
    deployments: deploymentsRow?.total ?? 0,
    failedDeployments: deploymentsRow?.failed ?? 0,
    readyDeployments: deploymentsRow?.ready ?? 0,
    inProgressDeployments: deploymentsRow?.inProgress ?? 0,
    failedJobs: jobCounts[0]?.failed ?? 0,
    stuckJobs: jobCounts[0]?.stuck ?? 0,
    pendingJobs: jobCounts[0]?.pending ?? 0,
  };
}

export async function listAdminSites(): Promise<SiteAdminListItem[]> {
  const rows = await db.query.sites.findMany({
    orderBy: [desc(sites.createdAt)],
    with: {
      organization: {
        columns: { id: true, name: true, slug: true },
      },
      domains: { columns: { status: true } },
      deployments: {
        orderBy: [desc(siteDeployments.createdAt)],
        limit: 1,
      },
    },
  });

  return Promise.all(
    rows.map(async (site) => {
      const latest = site.deployments[0];
      const live = new Set(
        site.activeProductionDeploymentId
          ? [site.activeProductionDeploymentId]
          : []
      );
      if (latest?.kind === "preview") {
        const state = await readServingState(site.id).catch(() => null);
        for (const pointer of Object.values(state?.previews ?? {})) {
          live.add(pointer.deploymentId);
        }
      }
      return {
        id: site.id,
        name: site.name,
        slug: site.slug,
        status: site.status,
        organization: site.organization,
        repository:
          site.repositoryOwner && site.repositoryName
            ? `${site.repositoryOwner}/${site.repositoryName}`
            : null,
        liveUrl: primaryMountUrl(site.publicOrigin, site.mounts),
        domains: site.domains.length,
        activeDomains: site.domains.filter(
          (domain) => domain.status === "active"
        ).length,
        latestDeployment: latest ? serializeDeployment(latest, live) : null,
        createdAt: site.createdAt,
      };
    })
  );
}

export async function getAdminSite(
  siteId: string
): Promise<SiteAdminDetail | null> {
  const site = await db.query.sites.findFirst({
    where: eq(sites.id, siteId),
    with: {
      organization: {
        columns: { id: true, name: true, slug: true, suspendedAt: true },
      },
      domains: true,
      deployments: {
        orderBy: [desc(siteDeployments.createdAt)],
        limit: SITE_DEPLOYMENTS_LIMIT,
      },
    },
  });
  if (!site) {
    return null;
  }

  const [state, owner, siteCounts, failedJobs] = await Promise.all([
    readServingState(site.id).catch(() => null),
    getWorkspaceOwner(site.organizationId, site.createdByUserId),
    getWorkspaceSiteCounts(site.organizationId),
    db
      .select({
        id: siteJobs.id,
        kind: siteJobs.kind,
        deploymentId: siteJobs.deploymentId,
        attempts: siteJobs.attempts,
        maxAttempts: siteJobs.maxAttempts,
        lastError: siteJobs.lastError,
        createdAt: siteJobs.createdAt,
      })
      .from(siteJobs)
      .where(and(eq(siteJobs.siteId, site.id), eq(siteJobs.status, "failed")))
      .orderBy(desc(siteJobs.createdAt))
      .limit(SITE_FAILED_JOBS_LIMIT)
      .$withCache(false),
  ]);

  const live = liveDeploymentIds(state);
  if (!state && site.activeProductionDeploymentId) {
    live.add(site.activeProductionDeploymentId);
  }

  return {
    site: {
      id: site.id,
      name: site.name,
      slug: site.slug,
      status: site.status,
      suspendedReason: site.suspendedReason,
      suspendedBy: site.suspendedBy,
      suspendedWithOrganization: site.suspendedWithOrganization,
      organization: { ...site.organization, ...siteCounts },
      owner,
      repository:
        site.repositoryOwner && site.repositoryName
          ? { owner: site.repositoryOwner, name: site.repositoryName }
          : null,
      productionBranch: site.productionBranch,
      rootDirectory: site.rootDirectory,
      publicOrigin: site.publicOrigin,
      liveUrl: primaryMountUrl(site.publicOrigin, site.mounts),
      previewsEnabled: site.previewsEnabled,
      analyticsEnabled: site.analyticsEnabled,
      liveSince: state?.production?.activatedAt ?? null,
      createdAt: site.createdAt,
    },
    domains: site.domains.map((domain) => ({
      id: domain.id,
      hostname: domain.hostname,
      kind: domain.kind,
      status: domain.status,
      lastError: domain.lastError,
      lastCheckedAt: domain.lastCheckedAt,
      verifiedAt: domain.verifiedAt,
      isPrimary: site.publicOrigin === `https://${domain.hostname}`,
    })),
    deployments: site.deployments.map((deployment) =>
      serializeDeployment(deployment, live)
    ),
    failedJobs,
  };
}

export async function getAdminSiteDeployment(
  siteId: string,
  deploymentId: string
): Promise<SiteAdminDeploymentDetail | null> {
  const deployment = await db.query.siteDeployments.findFirst({
    where: and(
      eq(siteDeployments.id, deploymentId),
      eq(siteDeployments.siteId, siteId)
    ),
    with: {
      site: {
        columns: { id: true, name: true, activeProductionDeploymentId: true },
      },
      requestedByUser: { columns: { id: true, name: true, email: true } },
      telemetry: true,
    },
  });
  if (!deployment) {
    return null;
  }

  const building =
    deployment.status === "building" || deployment.status === "uploading";
  const [liveLog, state] = await Promise.all([
    building || !deployment.telemetry
      ? readLiveBuildLog(siteId, deploymentId).catch(() => null)
      : Promise.resolve(null),
    readServingState(siteId).catch(() => null),
  ]);
  const live = liveDeploymentIds(state);
  if (!state && deployment.site.activeProductionDeploymentId) {
    live.add(deployment.site.activeProductionDeploymentId);
  }

  return {
    site: { id: deployment.site.id, name: deployment.site.name },
    deployment: serializeDeployment(deployment, live),
    requestedBy: deployment.requestedByUser,
    log: building
      ? (liveLog ?? deployment.telemetry?.log ?? null)
      : (deployment.telemetry?.log ?? liveLog ?? null),
    metrics: deployment.telemetry?.metrics ?? null,
  };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Builds per UTC day by outcome, oldest day first. */
export async function getBuildActivity(
  days: number,
  siteId?: string
): Promise<SiteBuildActivityDay[]> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const since = new Date(today.getTime() - (days - 1) * MS_PER_DAY);
  const day = sql<string>`to_char(date_trunc('day', ${siteDeployments.createdAt}), 'YYYY-MM-DD')`;

  const rows = await db
    .select({
      day,
      ready: count(
        sql`case when ${siteDeployments.status} = 'ready' then 1 end`
      ),
      failed: count(
        sql`case when ${siteDeployments.status} = 'failed' then 1 end`
      ),
      other: count(
        sql`case when ${siteDeployments.status} not in ('ready', 'failed') then 1 end`
      ),
    })
    .from(siteDeployments)
    .where(
      siteId
        ? and(
            gte(siteDeployments.createdAt, since),
            eq(siteDeployments.siteId, siteId)
          )
        : gte(siteDeployments.createdAt, since)
    )
    .groupBy(day)
    .$withCache(false);

  const byDay = new Map(rows.map((row) => [row.day, row]));
  return Array.from({ length: days }, (_, index) => {
    const key = dayKey(new Date(since.getTime() + index * MS_PER_DAY));
    const row = byDay.get(key);
    return {
      day: key,
      ready: row?.ready ?? 0,
      failed: row?.failed ?? 0,
      other: row?.other ?? 0,
    };
  });
}

/** The latest finished builds with a duration, oldest first. */
export async function getRecentBuilds(
  limit: number,
  siteId?: string
): Promise<SiteRecentBuild[]> {
  const finished = and(
    inArray(siteDeployments.status, ["ready", "failed"]),
    isNotNull(siteDeployments.buildDurationMs)
  );
  const rows = await db
    .select({
      id: siteDeployments.id,
      siteId: siteDeployments.siteId,
      siteName: sites.name,
      status: siteDeployments.status,
      kind: siteDeployments.kind,
      commitSha: siteDeployments.commitSha,
      commitMessage: siteDeployments.commitMessage,
      durationMs: siteDeployments.buildDurationMs,
      createdAt: siteDeployments.createdAt,
    })
    .from(siteDeployments)
    .innerJoin(sites, eq(sites.id, siteDeployments.siteId))
    .where(
      siteId ? and(finished, eq(siteDeployments.siteId, siteId)) : finished
    )
    .orderBy(desc(siteDeployments.createdAt))
    .limit(limit)
    .$withCache(false);

  return rows.reverse().map((row) => ({
    ...row,
    status: row.status === "failed" ? "failed" : "ready",
    durationMs: row.durationMs ?? 0,
  }));
}
