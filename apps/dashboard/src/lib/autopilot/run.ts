import { AUTOPILOT_SCHEDULED_TRIGGERS } from "@notra/db/constants/autopilot";
import { db } from "@notra/db/drizzle";
import {
  autopilotFindings,
  autopilotRuns,
  autopilotSettings,
  brandSettings,
  organizations,
  projects,
} from "@notra/db/schema";
import type { AutopilotJobKind } from "@notra/db/types/autopilot";
import { and, asc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

import {
  AUTOPILOT_DEFAULT_JOBS,
  AUTOPILOT_RUN_EXPIRED_MESSAGE,
  AUTOPILOT_RUN_LEASE_MS,
} from "@/constants/autopilot";
import {
  runCommitsJob,
  runCompetitorsJob,
  runKeywordsJob,
} from "@/lib/autopilot/blog";
import { buildAutopilotBrief, postAutopilotBrief } from "@/lib/autopilot/brief";
import { syncFindingPullRequests } from "@/lib/autopilot/findings";
import { isAutopilotEnabledForOrganization } from "@/lib/autopilot/flag";
import {
  withAutopilotRunLease,
  renewAutopilotRunLease,
} from "@/lib/autopilot/leases";
import { createAutopilotLogger } from "@/lib/autopilot/log";
import { runPromptsJob } from "@/lib/autopilot/prompts";
import { failWorkflowRunTrees } from "@/lib/workflow-engine/store";
import type {
  AutopilotJobResult,
  AutopilotRunContext,
} from "@/types/autopilot";
import type {
  AutopilotObservationJob,
  AutopilotRunTrigger,
} from "@/types/autopilot-runtime";
import { toAutopilotCommitFilters } from "@/utils/autopilot-commit-filters";
import { toErrorMessage } from "@/utils/error-message";

export class AutopilotUnavailableError extends Error {
  override name = "AutopilotUnavailableError";
}

/** Creates the run row; a run already in progress is returned instead of a new one. */
export async function claimAutopilotRun(
  organizationId: string,
  trigger: AutopilotRunTrigger,
  workflowKey: string
): Promise<{ runId: string; alreadyRunning: boolean }> {
  // A launch that died before the workflow started leaves a running row behind;
  // past the lease it is marked failed so it stops blocking new runs.
  const expired = await db
    .update(autopilotRuns)
    .set({
      status: "failed",
      finishedAt: new Date(),
      errorMessage: AUTOPILOT_RUN_EXPIRED_MESSAGE,
    })
    .where(
      and(
        eq(autopilotRuns.organizationId, organizationId),
        eq(autopilotRuns.status, "running"),
        lt(
          autopilotRuns.heartbeatAt,
          new Date(Date.now() - AUTOPILOT_RUN_LEASE_MS)
        )
      )
    )
    .returning({ id: autopilotRuns.id });
  await failWorkflowRunTrees(
    organizationId,
    expired.map((run) => run.id),
    AUTOPILOT_RUN_EXPIRED_MESSAGE
  );
  const runId = nanoid();
  const inserted = await db
    .insert(autopilotRuns)
    // Set from the app clock like finishedAt, so durations never mix in the database timezone.
    .values({
      id: runId,
      organizationId,
      trigger,
      workflowKey,
      startedAt: new Date(),
      heartbeatAt: new Date(),
    })
    .onConflictDoNothing()
    .returning({ id: autopilotRuns.id });
  if (inserted.length > 0) {
    return { runId, alreadyRunning: false };
  }
  const running = await db.query.autopilotRuns.findFirst({
    columns: { id: true },
    where: and(
      eq(autopilotRuns.organizationId, organizationId),
      eq(autopilotRuns.status, "running"),
      inArray(autopilotRuns.trigger, [...AUTOPILOT_SCHEDULED_TRIGGERS])
    ),
  });
  if (!running) {
    throw new Error("Could not claim an Autopilot run");
  }
  return { runId: running.id, alreadyRunning: true };
}

/** A run for one item (a mention, a merge, a suggestion); it may overlap the scheduled run. */
export async function createItemAutopilotRun(
  organizationId: string,
  trigger: "github" | "suggestion"
) {
  const runId = nanoid();
  await db.insert(autopilotRuns).values({
    id: runId,
    organizationId,
    trigger,
    startedAt: new Date(),
    heartbeatAt: new Date(),
  });
  return runId;
}

/** The saved GEO project, or the workspace's first one when none is saved. */
export function findAutopilotProject(
  organizationId: string,
  projectId: string | null
) {
  return projectId
    ? db.query.projects.findFirst({
        where: and(
          eq(projects.id, projectId),
          eq(projects.organizationId, organizationId)
        ),
      })
    : db.query.projects.findFirst({
        where: eq(projects.organizationId, organizationId),
        orderBy: [asc(projects.createdAt)],
      });
}

export async function buildAutopilotRunContext(
  organizationId: string,
  runId: string
): Promise<AutopilotRunContext> {
  if (!(await isAutopilotEnabledForOrganization(organizationId))) {
    throw new AutopilotUnavailableError(
      "Autopilot is not available for this workspace."
    );
  }
  const [settings, organization] = await Promise.all([
    db.query.autopilotSettings.findFirst({
      where: eq(autopilotSettings.organizationId, organizationId),
    }),
    db.query.organizations.findFirst({
      columns: { slug: true },
      where: eq(organizations.id, organizationId),
    }),
  ]);
  if (!(settings && organization)) {
    throw new AutopilotUnavailableError("Autopilot is not set up");
  }
  if (!settings.enabled) {
    throw new AutopilotUnavailableError(
      "Autopilot is turned off for this workspace."
    );
  }
  const project = await findAutopilotProject(
    organizationId,
    settings.projectId
  );
  const brand = project
    ? await db.query.brandSettings.findFirst({
        where: eq(brandSettings.id, project.brandSettingsId),
      })
    : null;

  const repository =
    settings.repositoryOwner && settings.repositoryName
      ? {
          owner: settings.repositoryOwner,
          name: settings.repositoryName,
          branch: settings.repositoryBranch ?? "main",
        }
      : null;

  return {
    organizationId,
    organizationSlug: organization.slug,
    runId,
    projectId: project?.id ?? null,
    repository,
    contentPath: settings.contentPath,
    jobs: { ...AUTOPILOT_DEFAULT_JOBS, ...settings.jobs },
    maxOpenPullRequests: settings.maxOpenPullRequests,
    stalePullRequestDays: settings.stalePullRequestDays,
    commitFilters: toAutopilotCommitFilters(settings.commitFilters),
    brand: brand
      ? {
          name: brand.companyName ?? brand.name,
          websiteUrl: brand.websiteUrl,
          description: brand.companyDescription ?? "",
          audience: brand.audience ?? null,
          language: brand.language ?? "English",
          customInstructions: brand.customInstructions ?? null,
          settingsId: brand.id,
        }
      : null,
  };
}

const OBSERVATION_JOBS = {
  keywords: runKeywordsJob,
  commits: runCommitsJob,
  prompts: runPromptsJob,
  competitors: runCompetitorsJob,
} satisfies Partial<
  Record<
    AutopilotJobKind,
    (ctx: AutopilotRunContext) => Promise<AutopilotJobResult>
  >
>;

export async function runAutopilotJob(
  ctx: AutopilotRunContext,
  kind: AutopilotObservationJob
): Promise<AutopilotJobResult> {
  const empty: AutopilotJobResult = { findingIds: [], insights: [] };
  const log = createAutopilotLogger(ctx, kind);
  if (!(await renewAutopilotRunLease(ctx))) {
    await log.skip("This run no longer owns its lease");
    return empty;
  }
  // Competitors is one line in the brief, not an automation with a switch.
  if (!(kind === "competitors" || ctx.jobs[kind])) {
    await log.skip("Turned off in settings");
    return empty;
  }
  return await withAutopilotRunLease(ctx, () => OBSERVATION_JOBS[kind](ctx));
}

export async function deliverAutopilotBrief(params: {
  ctx: AutopilotRunContext;
  insights: string[];
  previousRunAt: Date | null;
}) {
  const { ctx } = params;
  const recorded = await db.query.autopilotRuns.findFirst({
    columns: { slackMessageTs: true },
    where: and(
      eq(autopilotRuns.id, ctx.runId),
      eq(autopilotRuns.organizationId, ctx.organizationId)
    ),
  });
  if (recorded?.slackMessageTs) {
    return recorded.slackMessageTs;
  }
  if (!(await renewAutopilotRunLease(ctx))) {
    throw new Error("The run no longer owns its delivery lease");
  }
  await syncFindingPullRequests(ctx.organizationId);
  // Item workflows are independent of the daily run. Announce each state once,
  // even after disconnected Slack or a failed earlier brief.
  const findings = await db.query.autopilotFindings.findMany({
    where: and(
      eq(autopilotFindings.organizationId, ctx.organizationId),
      inArray(autopilotFindings.status, ["suggested", "proposed"]),
      sql`not coalesce((${autopilotFindings.evidence}->'briefed') ? ${autopilotFindings.status}, false)`
    ),
    orderBy: [asc(autopilotFindings.createdAt)],
    limit: 10,
  });
  const merged = params.previousRunAt
    ? await db.query.autopilotFindings.findMany({
        where: and(
          eq(autopilotFindings.organizationId, ctx.organizationId),
          eq(autopilotFindings.status, "merged"),
          gte(autopilotFindings.mergedAt, params.previousRunAt)
        ),
      })
    : [];
  const brief = buildAutopilotBrief({
    organizationSlug: ctx.organizationSlug,
    proposed: findings.filter((finding) => finding.status === "proposed"),
    suggested: findings.filter((finding) => finding.status === "suggested"),
    merged,
    insights: params.insights,
  });
  const log = createAutopilotLogger(ctx, null);
  if (!brief) {
    await log.skip("No brief: nothing proposed, merged or worth knowing");
    return null;
  }
  try {
    if (!(await renewAutopilotRunLease(ctx))) {
      throw new Error("The run no longer owns its delivery lease");
    }
    const delivery = await postAutopilotBrief(
      ctx.organizationId,
      brief,
      ctx.runId
    );
    if (delivery) {
      await db.transaction(async (tx) => {
        const recorded = await tx
          .update(autopilotRuns)
          .set({ slackMessageTs: delivery.ts })
          .where(
            and(
              eq(autopilotRuns.id, ctx.runId),
              eq(autopilotRuns.organizationId, ctx.organizationId),
              eq(autopilotRuns.status, "running")
            )
          )
          .returning({ id: autopilotRuns.id });
        if (!recorded.length) {
          throw new Error("The run lost its delivery lease");
        }
        for (const status of ["suggested", "proposed"] as const) {
          const ids = delivery.items
            .filter((item) => item.status === status)
            .map((item) => item.findingId);
          if (!ids.length) {
            continue;
          }
          await tx
            .update(autopilotFindings)
            .set({
              evidence: sql`jsonb_set(${autopilotFindings.evidence}, '{briefed}', coalesce(${autopilotFindings.evidence}->'briefed', '[]'::jsonb) || jsonb_build_array(${status}::text))`,
            })
            .where(
              and(
                eq(autopilotFindings.organizationId, ctx.organizationId),
                inArray(autopilotFindings.id, ids)
              )
            );
        }
      });
      await log.action("Posted the brief to Slack");
    } else {
      await log.skip("No brief sent: Slack is not connected");
    }
    return delivery?.ts ?? null;
  } catch (error) {
    await log.error("Could not post the brief", {
      error: toErrorMessage(error, String(error)),
    });
    return null;
  }
}

export async function finishAutopilotRun(params: {
  organizationId: string;
  runId: string;
  results: AutopilotJobResult[];
  slackMessageTs: string | null;
  error?: string;
  /** Mention runs leave the schedule alone so the daily run still happens. */
  scheduled?: boolean;
}) {
  const findingIds = params.results.flatMap((result) => result.findingIds);
  const findings = await db
    .select({ status: autopilotFindings.status })
    .from(autopilotFindings)
    .where(
      and(
        eq(autopilotFindings.organizationId, params.organizationId),
        findingIds.length > 0
          ? or(
              eq(autopilotFindings.runId, params.runId),
              inArray(autopilotFindings.id, findingIds)
            )
          : eq(autopilotFindings.runId, params.runId)
      )
    );
  const finishedAt = new Date();
  const completed = await db
    .update(autopilotRuns)
    .set({
      status: params.error ? "failed" : "completed",
      errorMessage: params.error ?? null,
      slackMessageTs: params.slackMessageTs ?? undefined,
      finishedAt,
      summary: {
        findings: findings.length,
        proposed: findings.filter((row) => row.status === "proposed").length,
        failed: findings.filter((row) => row.status === "failed").length,
        insights: params.results.flatMap((result) => result.insights),
      },
    })
    .where(
      and(
        eq(autopilotRuns.id, params.runId),
        eq(autopilotRuns.organizationId, params.organizationId),
        eq(autopilotRuns.status, "running")
      )
    )
    .returning({ id: autopilotRuns.id });
  if (params.scheduled === false || completed.length === 0) {
    return;
  }
  await db
    .update(autopilotSettings)
    .set({ lastRunAt: finishedAt })
    .where(eq(autopilotSettings.organizationId, params.organizationId));
}
