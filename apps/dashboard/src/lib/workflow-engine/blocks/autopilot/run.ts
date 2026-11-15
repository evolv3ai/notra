import {
  defineWorkflowBlock,
  halt,
  next,
  succeed,
} from "@notra/workflows/runtime/registry";
import type { WorkflowBlockStepContext } from "@notra/workflows/types/blocks";

import { AUTOPILOT_OBSERVATION_STEPS as OBSERVATION_STEPS } from "@/constants/autopilot-workflow";
import { closeStalePullRequests } from "@/lib/autopilot/cleanup";
import { createAutopilotLogger } from "@/lib/autopilot/log";
import {
  decideAutopilotPlan,
  rememberAutopilotPlan,
} from "@/lib/autopilot/planner";
import {
  deliverAutopilotBrief,
  finishAutopilotRun,
  runAutopilotJob,
} from "@/lib/autopilot/run";
import {
  autopilotRunConfigSchema,
  briefConfigSchema,
  failRunConfigSchema,
  finishConfigSchema,
  gatherConfigSchema,
  planConfigSchema,
} from "@/schemas/autopilot-workflow";
import type {
  FinishConfig,
  FinishState,
  GatherConfig,
  GatherState,
} from "@/types/autopilot-workflow";
import { toErrorMessage } from "@/utils/error-message";

import {
  autopilotUnavailableReason,
  loadAutopilotContext,
  withRunLease,
} from "./shared";

const rememberStep = {
  id: "remember",
  title: "Update the planner notes",
  optional: true,
  run: async (context: WorkflowBlockStepContext<FinishConfig>) => {
    const { decision, acted } = context.config;
    if (!decision) {
      return next();
    }
    await rememberAutopilotPlan({
      ctx: await loadAutopilotContext(context),
      decision,
      acted: acted[0] ?? null,
    });
    return next();
  },
};

const closeRunStep = (scheduled: boolean) => ({
  id: "finish",
  title: "Close the run",
  run: async (context: WorkflowBlockStepContext<FinishConfig, FinishState>) => {
    const slackMessageTs = context.state.slackMessageTs ?? null;
    const unavailable = await autopilotUnavailableReason(context);
    await finishAutopilotRun({
      organizationId: context.organizationId,
      runId: context.config.autopilotRunId,
      results: [{ findingIds: [], insights: context.config.insights }],
      slackMessageTs,
      error: unavailable ?? undefined,
      scheduled,
    });
    return succeed({ slackMessageTs });
  },
});

export const autopilotRunBlocks = [
  defineWorkflowBlock({
    type: "autopilot.close-stale",
    kind: "integration",
    title: "Close stale drafts",
    logo: "github",
    configSchema: autopilotRunConfigSchema,
    run: async (context) =>
      succeed({
        closed: await closeStalePullRequests(
          await loadAutopilotContext(context)
        ),
      }),
  }),
  defineWorkflowBlock<typeof gatherConfigSchema, GatherState>({
    type: "autopilot.gather",
    kind: "task",
    title: "Gather signals",
    configSchema: gatherConfigSchema,
    steps: OBSERVATION_STEPS.map(({ job, title }) => ({
      id: job,
      title,
      optional: true,
      run: async (
        context: WorkflowBlockStepContext<GatherConfig, GatherState>
      ) => {
        if (context.config.jobs && !context.config.jobs.includes(job)) {
          return next();
        }
        const ctx = await loadAutopilotContext(context);
        try {
          return next<GatherState>({
            [job]: await runAutopilotJob(ctx, job),
          });
        } catch (error) {
          if (context.lastAttempt) {
            await createAutopilotLogger(ctx, job).error("Job failed", {
              error: toErrorMessage(error, String(error)),
            });
          }
          throw error;
        }
      },
    })),
  }),
  defineWorkflowBlock({
    type: "autopilot.plan",
    kind: "ai",
    title: "Plan",
    configSchema: planConfigSchema,
    sideEffect: true,
    run: async (context) => {
      const ctx = await loadAutopilotContext(context);
      const decision = await withRunLease(ctx, () =>
        decideAutopilotPlan(ctx, context.config.observations)
      );
      if (!decision) {
        return halt("This run no longer owns its lease");
      }
      return succeed(decision);
    },
  }),
  defineWorkflowBlock<typeof briefConfigSchema, FinishState>({
    type: "autopilot.brief",
    kind: "integration",
    title: "Brief the team",
    logo: "slack",
    configSchema: briefConfigSchema,
    steps: [
      rememberStep,
      {
        id: "slack",
        title: "Post to Slack",
        optional: true,
        run: async (context) => {
          const slackMessageTs = await deliverAutopilotBrief({
            ctx: await loadAutopilotContext(context),
            insights: context.config.insights,
            previousRunAt: context.config.previousRunAt
              ? new Date(context.config.previousRunAt)
              : null,
          });
          return next(slackMessageTs ? { slackMessageTs } : {});
        },
      },
      closeRunStep(true),
    ],
  }),
  defineWorkflowBlock<typeof finishConfigSchema, FinishState>({
    type: "autopilot.finish",
    kind: "task",
    title: "Close the run",
    configSchema: finishConfigSchema,
    steps: [rememberStep, closeRunStep(false)],
  }),
  defineWorkflowBlock({
    type: "autopilot.fail-run",
    kind: "task",
    title: "Fail the run",
    configSchema: failRunConfigSchema,
    run: async (context) => {
      await finishAutopilotRun({
        organizationId: context.organizationId,
        runId: context.config.autopilotRunId,
        results: [{ findingIds: [], insights: context.config.insights }],
        slackMessageTs: context.config.slackMessageTs,
        error: context.failure?.error ?? "The run failed",
        scheduled: context.config.scheduled,
      });
      return succeed();
    },
  }),
];
