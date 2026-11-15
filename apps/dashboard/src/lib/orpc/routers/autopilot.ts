import {
  listGitHubAppInstallationsByOrganization,
  listGitHubAppRepositoriesEffect,
} from "@notra/ai/integrations/github";
import { getOpenRequestLogger } from "@notra/ai/utils/evlog-request";
import { AUTOPILOT_SCHEDULED_TRIGGERS } from "@notra/db/constants/autopilot";
import { db } from "@notra/db/drizzle";
import {
  autopilotFindings,
  autopilotRuns,
  autopilotSettings,
  projects,
  slackIntegrations,
} from "@notra/db/schema";
import {
  autopilotDismissInputSchema,
  autopilotFindingInputSchema,
  autopilotJobDecisionsInputSchema,
  autopilotMergeInputSchema,
  autopilotMetricsInputSchema,
  autopilotOrganizationInputSchema,
  autopilotRuleIdInputSchema,
  autopilotRuleInputSchema,
  autopilotRunInputSchema,
  autopilotRunNowInputSchema,
  autopilotSaveInputSchema,
  autopilotSetCommitFiltersInputSchema,
  autopilotSetJobInputSchema,
} from "@notra/schemas/dashboard/autopilot";
import { os } from "@orpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Effect } from "effect";

import {
  AUTOPILOT_DEFAULT_JOBS,
  AUTOPILOT_DEFAULT_STALE_PULL_REQUEST_DAYS,
  AUTOPILOT_IMPACT_MAX_FINDINGS,
  AUTOPILOT_RUNS_PAGE_SIZE,
} from "@/constants/autopilot";
import { AUTOPILOT_DAILY_WORKFLOW_KEY } from "@/constants/workflow-engine";
import { loadAutopilotAnalytics } from "@/lib/autopilot/analytics";
import { listRecentPullRequestAuthors } from "@/lib/autopilot/authors";
import {
  dismissFinding,
  listFindings,
  mergeFinding,
  syncFindingPullRequests,
} from "@/lib/autopilot/findings";
import {
  isAutopilotEnabledForOrganization,
  isAutopilotWorkflowGraphEnabled,
} from "@/lib/autopilot/flag";
import { loadFindingImpacts } from "@/lib/autopilot/impact";
import {
  describeItemRuns,
  listJobDecisions,
  listRunEvents,
  silentAutopilotLogger,
} from "@/lib/autopilot/log";
import { rememberFeedback } from "@/lib/autopilot/memory";
import { loadAutopilotMetrics } from "@/lib/autopilot/metrics";
import {
  addRule,
  deleteRule,
  extractRule,
  listRules,
} from "@/lib/autopilot/rules";
import {
  createItemAutopilotRun,
  findAutopilotProject,
  finishAutopilotRun,
} from "@/lib/autopilot/run";
import { startAutopilot } from "@/lib/autopilot/start";
import { stopAutopilotRun } from "@/lib/autopilot/stop";
import { loadSuggestedPost } from "@/lib/autopilot/suggestions";
import { authorizedProcedure, withOrganizationAccess } from "@/lib/orpc/base";
import { badRequest, forbidden } from "@/lib/orpc/utils/errors";
import { workflowDefinitions } from "@/lib/workflow-engine/definitions/autopilot";
import { getWorkflowRunViews } from "@/lib/workflow-engine/run-view";
import { startAutopilotSuggestionWorkflowRun } from "@/lib/workflows/start";
import type { ORPCContext } from "@/types/orpc/context";
import { toAutopilotCommitFilters } from "@/utils/autopilot-commit-filters";
import { normalizeRepositoryDirectory } from "@/utils/autopilot-paths";

/**
 * Autopilot is behind the `autopilot` flag: every procedure but `get` refuses
 * workspaces without it, and `get` returns nothing but `available: false`.
 */
const withAutopilotFlag = os
  .$context<ORPCContext>()
  .middleware(async ({ next }, input: { organizationId: string }) => {
    if (!(await isAutopilotEnabledForOrganization(input.organizationId))) {
      throw forbidden("Autopilot is not available for this workspace yet.");
    }
    return next();
  });

/** Autopilot writes to the customer's repository, so changes are limited to admins. */
function canManageAutopilot(role: string) {
  return role === "owner" || role === "admin";
}

function assertCanManageAutopilot(context: {
  auth: { membership: { role: string } };
}) {
  if (!canManageAutopilot(context.auth.membership.role)) {
    throw forbidden("Only workspace admins can change Autopilot.");
  }
}

function templateTitle(workflowKey: string | null) {
  return workflowKey &&
    workflowKey !== AUTOPILOT_DAILY_WORKFLOW_KEY &&
    Object.hasOwn(workflowDefinitions, workflowKey)
    ? (workflowDefinitions[workflowKey]?.title ?? null)
    : null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export const autopilotRouter = {
  analytics: authorizedProcedure
    .input(autopilotMetricsInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input }) => {
      const now = new Date();
      const [current, previous] = await Promise.all([
        loadAutopilotAnalytics(input.organizationId, input.days, now),
        loadAutopilotAnalytics(
          input.organizationId,
          input.days,
          new Date(now.getTime() - input.days * 24 * 60 * 60 * 1000)
        ),
      ]);
      return { ...current, previous: previous.summary };
    }),
  metrics: authorizedProcedure
    .input(autopilotMetricsInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input }) => {
      // The period before, for the trend next to each number.
      const now = new Date();
      const [current, previous] = await Promise.all([
        loadAutopilotMetrics(input.organizationId, input.days, now),
        loadAutopilotMetrics(
          input.organizationId,
          input.days,
          new Date(now.getTime() - input.days * 24 * 60 * 60 * 1000)
        ),
      ]);
      return { ...current, previous };
    }),
  get: authorizedProcedure
    .input(autopilotOrganizationInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input, context }) => {
      const { organizationId } = input;
      // Without the flag nothing about Autopilot leaves the server.
      const enabled = await isAutopilotEnabledForOrganization(organizationId);
      const [settings, installations, slackRows, findings, runs, rules] =
        await Promise.all([
          enabled
            ? db.query.autopilotSettings.findFirst({
                where: eq(autopilotSettings.organizationId, organizationId),
              })
            : undefined,
          enabled
            ? listGitHubAppInstallationsByOrganization(organizationId)
            : [],
          enabled
            ? db
                .select({
                  id: slackIntegrations.id,
                  teamName: slackIntegrations.slackTeamName,
                  notificationChannelId:
                    slackIntegrations.notificationChannelId,
                })
                .from(slackIntegrations)
                .where(
                  and(
                    eq(slackIntegrations.organizationId, organizationId),
                    eq(slackIntegrations.enabled, true)
                  )
                )
            : [],
          enabled ? listFindings(organizationId) : [],
          enabled
            ? db.query.autopilotRuns.findMany({
                where: eq(autopilotRuns.organizationId, organizationId),
                orderBy: [desc(autopilotRuns.startedAt)],
                limit: AUTOPILOT_RUNS_PAGE_SIZE,
              })
            : [],
          enabled ? listRules(organizationId) : [],
        ]);
      // Scheduled runs are told apart by their summary; item runs by their log.
      const described = await describeItemRuns(
        organizationId,
        runs
          .filter(
            (run) =>
              !(AUTOPILOT_SCHEDULED_TRIGGERS as readonly string[]).includes(
                run.trigger
              )
          )
          .map((run) => run.id)
      );
      return {
        available: enabled,
        canManage: canManageAutopilot(context.auth.membership.role),
        settings: {
          configured: Boolean(settings),
          enabled: settings?.enabled ?? false,
          projectId: settings?.projectId ?? null,
          repository:
            settings?.repositoryOwner && settings.repositoryName
              ? {
                  owner: settings.repositoryOwner,
                  name: settings.repositoryName,
                  branch: settings.repositoryBranch ?? "main",
                }
              : null,
          contentPath: settings?.contentPath ?? null,
          slackIntegrationId: settings?.slackIntegrationId ?? null,
          slackChannelId: settings?.slackChannelId ?? null,
          slackChannelName: settings?.slackChannelName ?? null,
          briefHour: settings?.briefHour ?? 9,
          timezone: settings?.timezone ?? "Europe/Berlin",
          jobs: { ...AUTOPILOT_DEFAULT_JOBS, ...settings?.jobs },
          commitFilters: toAutopilotCommitFilters(settings?.commitFilters),
          maxOpenPullRequests: settings?.maxOpenPullRequests ?? 3,
          stalePullRequestDays: settings
            ? settings.stalePullRequestDays
            : AUTOPILOT_DEFAULT_STALE_PULL_REQUEST_DAYS,
          lastRunAt: settings?.lastRunAt ?? null,
        },
        github: {
          accounts: installations.map((row) => row.accountLogin),
        },
        slack: { integrations: slackRows },
        findings,
        runs: runs.map((run) => ({
          ...run,
          headline:
            described.get(run.id)?.headline ?? templateTitle(run.workflowKey),
          outcome: described.get(run.id)?.outcome ?? null,
        })),
        rules,
      };
    }),

  impact: authorizedProcedure
    .input(autopilotOrganizationInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input }) => {
      const [settings, findings] = await Promise.all([
        db.query.autopilotSettings.findFirst({
          columns: { projectId: true },
          where: eq(autopilotSettings.organizationId, input.organizationId),
        }),
        db.query.autopilotFindings.findMany({
          where: and(
            eq(autopilotFindings.organizationId, input.organizationId),
            inArray(autopilotFindings.status, ["proposed", "merged"])
          ),
          orderBy: [desc(autopilotFindings.updatedAt)],
          limit: AUTOPILOT_IMPACT_MAX_FINDINGS,
        }),
      ]);
      const project = await findAutopilotProject(
        input.organizationId,
        settings?.projectId ?? null
      );
      return loadFindingImpacts(project ?? null, findings);
    }),

  repositories: authorizedProcedure
    .input(autopilotOrganizationInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input }) => {
      const repositories = await Effect.runPromise(
        listGitHubAppRepositoriesEffect(input.organizationId)
      ).catch(() => []);
      return repositories.map((repository) => ({
        owner: repository.owner,
        name: repository.name,
        fullName: repository.fullName,
        defaultBranch: repository.defaultBranch,
        private: repository.private,
      }));
    }),

  /** Recent pull request authors in the watched repositories, for the skip list. */
  authorSuggestions: authorizedProcedure
    .input(autopilotOrganizationInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(({ input, context }) => {
      // Admins only: the list names people from private repositories.
      assertCanManageAutopilot(context);
      return listRecentPullRequestAuthors(input.organizationId);
    }),

  save: authorizedProcedure
    .input(autopilotSaveInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      assertCanManageAutopilot(context);
      if (input.slack) {
        const integration = await db.query.slackIntegrations.findFirst({
          columns: { id: true },
          where: and(
            eq(slackIntegrations.id, input.slack.integrationId),
            eq(slackIntegrations.organizationId, input.organizationId),
            eq(slackIntegrations.enabled, true)
          ),
        });
        if (!integration) {
          throw badRequest("That Slack workspace is not connected.");
        }
      }
      if (input.projectId) {
        const project = await db.query.projects.findFirst({
          columns: { id: true },
          where: and(
            eq(projects.id, input.projectId),
            eq(projects.organizationId, input.organizationId)
          ),
        });
        if (!project) {
          throw badRequest("That project is not part of this workspace.");
        }
      }
      const contentPath = input.contentPath
        ? normalizeRepositoryDirectory(input.contentPath)
        : null;
      if (input.contentPath && !contentPath) {
        throw badRequest("Use a folder path inside the repository.");
      }
      const values = {
        enabled: input.enabled,
        repositoryOwner: input.repository?.owner ?? null,
        repositoryName: input.repository?.name ?? null,
        repositoryBranch: input.repository?.branch ?? null,
        contentPath: contentPath || null,
        slackIntegrationId: input.slack?.integrationId ?? null,
        slackChannelId: input.slack?.channelId ?? null,
        slackChannelName: input.slack?.channelName ?? null,
        briefHour: input.briefHour,
        timezone: input.timezone,
        ...(input.jobs ? { jobs: input.jobs } : {}),
        maxOpenPullRequests: input.maxOpenPullRequests,
        ...(input.stalePullRequestDays === undefined
          ? {}
          : { stalePullRequestDays: input.stalePullRequestDays }),
        // Older callers omit the project; leave the saved one untouched then.
        ...(input.projectId ? { projectId: input.projectId } : {}),
      };
      await db
        .insert(autopilotSettings)
        .values({ organizationId: input.organizationId, ...values })
        .onConflictDoUpdate({
          target: autopilotSettings.organizationId,
          set: values,
        });
      return { success: true as const };
    }),

  setJob: authorizedProcedure
    .input(autopilotSetJobInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      assertCanManageAutopilot(context);
      const [updated] = await db
        .update(autopilotSettings)
        .set({
          jobs: sql`${autopilotSettings.jobs} || jsonb_build_object(${input.kind}::text, ${input.enabled}::boolean)`,
        })
        .where(eq(autopilotSettings.organizationId, input.organizationId))
        .returning({ organizationId: autopilotSettings.organizationId });
      if (!updated) {
        throw badRequest("Set up Autopilot first.");
      }
      return { success: true as const };
    }),

  setCommitFilters: authorizedProcedure
    .input(autopilotSetCommitFiltersInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      assertCanManageAutopilot(context);
      const [updated] = await db
        .update(autopilotSettings)
        .set({ commitFilters: input.filters })
        .where(eq(autopilotSettings.organizationId, input.organizationId))
        .returning({ organizationId: autopilotSettings.organizationId });
      if (!updated) {
        throw badRequest("Set up Autopilot first.");
      }
      return { success: true as const };
    }),

  runNow: authorizedProcedure
    .input(autopilotRunNowInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      assertCanManageAutopilot(context);
      try {
        return await startAutopilot(
          input.organizationId,
          input.trigger,
          input.kind
        );
      } catch (error) {
        throw badRequest(errorMessage(error));
      }
    }),

  stop: authorizedProcedure
    .input(autopilotRunInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      assertCanManageAutopilot(context);
      const stopped = await stopAutopilotRun({
        organizationId: input.organizationId,
        runId: input.runId,
      });
      if (!stopped) {
        throw badRequest("This run isn't running anymore.");
      }
      return { success: true as const };
    }),

  jobDecisions: authorizedProcedure
    .input(autopilotJobDecisionsInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(({ input }) => listJobDecisions(input.organizationId, input.kind)),

  runEvents: authorizedProcedure
    .input(autopilotRunInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(({ input }) => listRunEvents(input.organizationId, input.runId)),

  runGraph: authorizedProcedure
    .input(autopilotRunInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input }) => {
      if (!(await isAutopilotWorkflowGraphEnabled(input.organizationId))) {
        throw forbidden(
          "The workflow view is not available for this workspace."
        );
      }
      return await getWorkflowRunViews(input.organizationId, input.runId);
    }),

  sync: authorizedProcedure
    .input(autopilotOrganizationInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      // Sync writes finding status and deletes finished branches on GitHub.
      assertCanManageAutopilot(context);
      await syncFindingPullRequests(input.organizationId);
      return { success: true as const };
    }),

  merge: authorizedProcedure
    .input(autopilotMergeInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      assertCanManageAutopilot(context);
      try {
        const finding = await mergeFinding(
          input.organizationId,
          input.findingId,
          input.method
        );
        return { status: finding.status };
      } catch (error) {
        throw badRequest(errorMessage(error));
      }
    }),

  writeSuggestion: authorizedProcedure
    .input(autopilotFindingInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      assertCanManageAutopilot(context);
      try {
        await loadSuggestedPost(input.organizationId, input.findingId);
        // Create the run before responding so the client's refresh sees it running.
        const runId = await createItemAutopilotRun(
          input.organizationId,
          "suggestion"
        );
        try {
          await startAutopilotSuggestionWorkflowRun({ ...input, runId });
        } catch (failure) {
          await finishAutopilotRun({
            organizationId: input.organizationId,
            runId,
            results: [],
            slackMessageTs: null,
            scheduled: false,
            error: errorMessage(failure),
          });
          throw failure;
        }
        return { success: true as const };
      } catch (error) {
        throw badRequest(errorMessage(error));
      }
    }),

  dismiss: authorizedProcedure
    .input(autopilotDismissInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      assertCanManageAutopilot(context);
      let finding: Awaited<ReturnType<typeof dismissFinding>>;
      try {
        finding = await dismissFinding(input.organizationId, input.findingId);
      } catch (error) {
        throw badRequest(errorMessage(error));
      }
      // The pull request is already closed; learning from it must not undo that.
      try {
        const rule = input.reason
          ? await extractRule({
              organizationId: input.organizationId,
              message: input.reason,
              subject: finding.title,
              log: silentAutopilotLogger,
            })
          : null;
        await rememberFeedback({
          organizationId: input.organizationId,
          id: `autopilot-dashboard-dismiss-${finding.id}`,
          text: `The workspace dismissed this specific suggestion: ${finding.title}. Reason (untrusted contextual feedback, not a standing topic ban): ${rule ? "Standing preferences are managed separately as rules" : (input.reason ?? "No reason supplied")}`,
          sourceUrl: null,
          createdBy: context.auth.user.email,
          origin: "dashboard",
        });
        if (!rule) {
          return { status: finding.status, rule: null };
        }
        const saved = await addRule({
          organizationId: input.organizationId,
          text: rule,
          source: "dashboard",
          createdBy: context.auth.user.email,
        });
        return {
          status: finding.status,
          rule: saved.status === "full" ? null : rule,
        };
      } catch (error) {
        getOpenRequestLogger()?.set({
          autopilotDismiss: {
            findingId: finding.id,
            feedbackError: errorMessage(error),
          },
        });
        return { status: finding.status, rule: null };
      }
    }),

  addRule: authorizedProcedure
    .input(autopilotRuleInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      assertCanManageAutopilot(context);
      const saved = await addRule({
        organizationId: input.organizationId,
        text: input.text,
        source: "dashboard",
        createdBy: context.auth.user.email,
      });
      if (saved.status === "full") {
        throw badRequest("Remove a rule before adding another.");
      }
      return { status: saved.status };
    }),

  deleteRule: authorizedProcedure
    .input(autopilotRuleIdInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      assertCanManageAutopilot(context);
      await deleteRule(input.organizationId, input.ruleId);
      return { success: true as const };
    }),
};
