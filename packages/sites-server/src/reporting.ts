import { db } from "@notra/db/drizzle";
import { organizations, siteDeployments, sites } from "@notra/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { Effect } from "effect";

import {
  CHECK_RUN_ANNOTATION_MAX_LENGTH,
  CHECK_RUN_LOCK_TIMEOUT_MS,
  CHECK_RUN_NAME,
  CHECK_RUN_SUMMARY_MAX_LENGTH,
  CHECK_RUN_STATE_TIMEOUT_MS,
} from "./constants/github";
import {
  completeCheckRun,
  createCheckRun,
  siteRepositoryAccess,
  upsertPreviewComment,
} from "./github";
import { readServingStateEffect } from "./state";
import type { DeploymentOutcome, SiteDeployment } from "./types/deployments";
import type { Site } from "./types/sites";
import { deploymentCheckReport } from "./utils/deployment-check-report";
import { errorMessage } from "./utils/errors";
import { previewCommentBody } from "./utils/preview-comment";
import { runSitesEffect } from "./utils/run-sites-effect";
import { deploymentDashboardUrl } from "./utils/urls";

async function safely<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    console.warn(`sites.${label}_failed`, errorMessage(error));
    return null;
  }
}

async function dashboardUrl(
  site: Site,
  deployment: SiteDeployment
): Promise<string> {
  const [organization] = await db
    .select({ slug: organizations.slug })
    .from(organizations)
    .where(eq(organizations.id, site.organizationId))
    .limit(1);
  return deploymentDashboardUrl({
    organizationSlug: organization?.slug ?? site.organizationId,
    siteId: site.id,
    deploymentId: deployment.id,
  });
}

export async function openCheckRun(
  site: Site,
  deployment: SiteDeployment
): Promise<SiteDeployment> {
  await reportPreviewComment(site, deployment);
  if (deployment.checkRunId) {
    return deployment;
  }
  const checkRunId = await safely("check_create", async () => {
    const { repository, token } = await siteRepositoryAccess(site, {
      checks: "write",
    });
    return await createCheckRun(repository, token, {
      name:
        deployment.kind === "production"
          ? CHECK_RUN_NAME
          : `${CHECK_RUN_NAME} preview`,
      headSha: deployment.commitSha,
      detailsUrl: await dashboardUrl(site, deployment),
      externalId: deployment.id,
      title: "Building",
      summary: `Building ${deployment.kind === "production" ? "the live site" : "a preview"} from ${deployment.commitSha.slice(0, 7)}.`,
    });
  });
  if (!checkRunId) {
    return deployment;
  }
  await db
    .update(siteDeployments)
    .set({ checkRunId })
    .where(eq(siteDeployments.id, deployment.id));
  return { ...deployment, checkRunId };
}

export async function reportOutcome(
  site: Site,
  deployment: SiteDeployment,
  outcome: DeploymentOutcome
): Promise<void> {
  await reportPreviewComment(site, deployment, outcome);
  const checkRunId = deployment.checkRunId;
  if (!checkRunId) {
    return;
  }
  await safely("check_complete", async () => {
    const { repository, token } = await siteRepositoryAccess(site, {
      checks: "write",
    });
    const fallbackUrl = await dashboardUrl(site, deployment);
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('lock_timeout', ${`${CHECK_RUN_LOCK_TIMEOUT_MS}ms`}, true)`
      );
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`sites-check:${checkRunId}`}, 0))`
      );
      let currentOutcome = outcome;
      if (outcome.kind === "held" && deployment.kind === "production") {
        const serving = await runSitesEffect(
          readServingStateEffect(site.id).pipe(
            Effect.timeout(CHECK_RUN_STATE_TIMEOUT_MS)
          )
        );
        if (serving?.state.production?.deploymentId === deployment.id) {
          currentOutcome = { kind: "live" };
        } else if (serving && !serving.state.productionRollback) {
          currentOutcome = { kind: "not_live" };
        }
      }
      const check = deploymentCheckReport(deployment, currentOutcome);
      await completeCheckRun(repository, token, {
        checkRunId,
        conclusion: check.conclusion,
        title: check.title,
        summary: check.summary.slice(0, CHECK_RUN_SUMMARY_MAX_LENGTH),
        detailsUrl: check.liveUrl ?? fallbackUrl,
        annotations:
          outcome.kind === "failed"
            ? outcome.diagnostics
                .filter((diagnostic) => diagnostic.file)
                .map((diagnostic) => ({
                  path: [site.rootDirectory, diagnostic.file]
                    .filter(Boolean)
                    .join("/"),
                  start_line: diagnostic.line ?? 1,
                  end_line: diagnostic.line ?? 1,
                  annotation_level:
                    diagnostic.severity === "error"
                      ? ("failure" as const)
                      : ("warning" as const),
                  message: diagnostic.message.slice(
                    0,
                    CHECK_RUN_ANNOTATION_MAX_LENGTH
                  ),
                }))
            : undefined,
      });
    });
  });
}

async function reportPreviewComment(
  site: Site,
  deployment: SiteDeployment,
  outcome?: DeploymentOutcome
): Promise<void> {
  const pullRequestNumber = deployment.pullRequestNumber;
  if (deployment.kind !== "preview" || !pullRequestNumber) {
    return;
  }
  await safely("preview_comment", () =>
    db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`sites-preview-comment:${site.id}:${pullRequestNumber}`}, 0))`
      );
      const [currentSite] = await tx
        .select()
        .from(sites)
        .where(eq(sites.id, site.id))
        .limit(1);
      if (
        !currentSite ||
        currentSite.status !== "active" ||
        !currentSite.previewsEnabled ||
        !currentSite.previewCommentsEnabled
      ) {
        return;
      }
      const [latest] = await tx
        .select()
        .from(siteDeployments)
        .where(
          and(
            eq(siteDeployments.siteId, site.id),
            eq(siteDeployments.kind, "preview"),
            eq(siteDeployments.pullRequestNumber, pullRequestNumber)
          )
        )
        .orderBy(desc(siteDeployments.generation))
        .limit(1);
      if (
        latest?.id !== deployment.id ||
        (!outcome &&
          !["queued", "building", "uploading"].includes(latest.status)) ||
        (outcome?.kind === "failed" && latest.status !== "failed") ||
        ((outcome?.kind === "live" || outcome?.kind === "not_live") &&
          latest.status !== "ready") ||
        (outcome?.kind === "skipped" &&
          !["canceled", "superseded", "skipped"].includes(latest.status))
      ) {
        return;
      }
      const { repository, token } = await siteRepositoryAccess(site, {
        pull_requests: "write",
      });
      await upsertPreviewComment(repository, token, {
        marker: `<!-- notra-preview:${site.id} -->`,
        pullRequestNumber,
        commitSha: latest.commitSha,
        productionBranch: currentSite.productionBranch,
        body: previewCommentBody(
          currentSite,
          latest,
          await dashboardUrl(currentSite, latest),
          outcome
        ),
      });
    })
  );
}
