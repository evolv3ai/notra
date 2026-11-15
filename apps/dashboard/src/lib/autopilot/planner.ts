import {
  AUTOPILOT_ACTION_JEV_MODEL_ID,
  AUTOPILOT_AUTONOMOUS_PR_BUDGET,
  AUTOPILOT_DAY_MS,
  AUTOPILOT_PLANNER_MAX_OUTPUT_TOKENS,
  AUTOPILOT_PLANNER_MODEL_ID,
  AUTOPILOT_PLANNER_RETRY_REASONING,
} from "@notra/ai/constants/autopilot-planner";
import { getEvaluationClient } from "@notra/ai/evaluation/client";
import { planAutopilotRun } from "@notra/ai/jobs/autopilot-planner";
import type {
  AutopilotGateResult,
  AutopilotPlannedAction,
  AutopilotPlannerState,
  AutopilotTopic,
} from "@notra/ai/types/autopilot-planner";
import {
  countIndependentSignals,
  evaluateAutopilotGate,
  fitPlannerState,
  followFinding,
  markTopicActed,
  parsePlannerState,
  renderPlannerState,
  resolveAutopilotOutcome,
  topicHasActiveWork,
} from "@notra/ai/utils/autopilot-planner";
import { MEMORY_PATHS } from "@notra/memory/constants/memory";
import { openMemorySnapshot, updateMemory } from "@notra/memory/memory";

import { listBlogPostPaths } from "@/lib/autopilot/blog";
import {
  countAutonomousProposals,
  countOpenPullRequests,
  listActiveBlogFindings,
  listFindingStatuses,
  syncFindingPullRequests,
} from "@/lib/autopilot/findings";
import { generateAutopilotObject } from "@/lib/autopilot/llm";
import { createAutopilotLogger } from "@/lib/autopilot/log";
import { loadDecisionMemory } from "@/lib/autopilot/rules";
import type {
  AutopilotRunContext,
  AutopilotRunObservation,
} from "@/types/autopilot";
import type {
  AutopilotLogger,
  AutopilotPlanActed,
  AutopilotPlanDecision,
} from "@/types/autopilot-runtime";
import { toErrorMessage } from "@/utils/error-message";

function describeChecks(checks: AutopilotGateResult["checks"]) {
  return checks.map(
    (check) =>
      `${check.ok ? "passed" : "failed"} ${check.name}: ${check.detail}`
  );
}

/** Topics follow their finding once Autopilot acted on them. */
async function syncTopicsWithFindings(
  organizationId: string,
  state: AutopilotPlannerState
): Promise<AutopilotPlannerState> {
  const linked = state.topics.flatMap((topic) =>
    topic.findingId ? [topic.findingId] : []
  );
  const findings = new Map(
    (await listFindingStatuses(organizationId, linked)).map((row) => [
      row.id,
      row,
    ])
  );
  return {
    ...state,
    topics: state.topics.map((topic): AutopilotTopic => {
      const finding = topic.findingId ? findings.get(topic.findingId) : null;
      if (!(topic.findingId && finding)) {
        return topic.findingId
          ? { ...topic, findingId: null, status: "watching" }
          : topic;
      }
      const pullRequestUrl = finding.pullRequestUrl ?? topic.pullRequestUrl;
      switch (finding.status) {
        case "merged":
          return followFinding(topic, { status: "done", pullRequestUrl });
        case "dismissed":
          return followFinding(topic, { status: "dismissed", pullRequestUrl });
        case "suggested":
          return followFinding(topic, { status: "ready", pullRequestUrl });
        case "open":
        case "proposed":
          return followFinding(topic, {
            status: "in_progress",
            pullRequestUrl,
          });
        default:
          // Failed, expired or closed without a change: watch it again.
          return { ...topic, status: "watching", findingId: null };
      }
    }),
  };
}

/**
 * The observation from this run that becomes the finding: the newest one, or
 * for a page update the newest that names the page. Without such a page an
 * update has no target, so there is nothing to act on.
 */
function primaryObservation(
  topic: AutopilotTopic,
  observations: readonly AutopilotRunObservation[],
  action: AutopilotPlannedAction["type"]
) {
  const byId = new Map(observations.map((row) => [row.id, row]));
  for (const signal of [...topic.signals].reverse()) {
    const observation = byId.get(signal.observationId);
    if (observation && (action !== "update_page" || observation.updatePage)) {
      return observation;
    }
  }
  return null;
}

async function writePlannerMemory(params: {
  ctx: AutopilotRunContext;
  log: AutopilotLogger;
  state: AutopilotPlannerState;
}) {
  const { ctx, log } = params;
  const files = {
    [MEMORY_PATHS.planner]: renderPlannerState(fitPlannerState(params.state)),
  };
  try {
    const result = await updateMemory({
      organizationId: ctx.organizationId,
      actor: "autopilot-run",
      message: `Autopilot run ${ctx.runId}`,
      mutate: async () => files,
    });
    await log.action("Updated the workspace memory", {
      commit: result.sha,
      changed: result.changed,
      overSoftLimit: result.overSoftLimit,
    });
  } catch (error) {
    // The plan already happened; a lost memory write must never redo it.
    await log.error("Could not update the workspace memory", {
      error: toErrorMessage(error, String(error)),
    });
  }
}

export async function decideAutopilotPlan(
  ctx: AutopilotRunContext,
  observations: AutopilotRunObservation[]
): Promise<AutopilotPlanDecision> {
  const log = createAutopilotLogger(ctx, null);
  if (!ctx.repository) {
    return { outcome: "skip", memory: null };
  }
  const snapshot = await openMemorySnapshot(ctx.organizationId);
  const [decisionMemory, plannerFile] = await Promise.all([
    loadDecisionMemory(ctx.organizationId),
    snapshot.read(MEMORY_PATHS.planner),
  ]);
  const stored = parsePlannerState(plannerFile);
  if (stored.lastRunId === ctx.runId) {
    await log.skip("This run already planned");
    return { outcome: "skip", memory: null };
  }
  if (observations.length === 0 && stored.topics.length === 0) {
    await log.skip("Nothing observed and no open topics to plan");
    return { outcome: "skip", memory: null };
  }
  await syncFindingPullRequests(ctx.organizationId);
  // Acting needs something seen this run, so without observations the model
  // has nothing to decide: only follow the findings the topics point at.
  if (observations.length === 0) {
    await log.skip("Nothing observed this run");
    return {
      outcome: "wait",
      memory: {
        ...(await syncTopicsWithFindings(ctx.organizationId, stored)),
        lastRunId: ctx.runId,
      },
    };
  }
  const [synced, existingPosts, activeWork, openPullRequests, autonomous] =
    await Promise.all([
      syncTopicsWithFindings(ctx.organizationId, stored),
      listBlogPostPaths(ctx),
      listActiveBlogFindings(ctx.organizationId),
      countOpenPullRequests(ctx.organizationId),
      countAutonomousProposals(
        ctx.organizationId,
        new Date(
          Date.now() - AUTOPILOT_AUTONOMOUS_PR_BUDGET.days * AUTOPILOT_DAY_MS
        )
      ),
    ]);
  const input = {
    brand: {
      name: ctx.brand?.name ?? "",
      about: ctx.brand?.description ?? "",
      audience: ctx.brand?.audience ?? "",
    },
    rules: decisionMemory.rules,
    feedback: decisionMemory.feedback,
    state: synced,
    observations: observations.map(
      ({ id, source, title, detail, updatePage }) => ({
        id,
        source,
        title,
        detail,
        updatePage: updatePage ?? null,
      })
    ),
    existingPosts,
    activeWork: activeWork.map((row) => ({
      title: row.title,
      status: row.status,
    })),
  };

  const plan = await planAutopilotRun({
    input,
    runId: ctx.runId,
    now: new Date(),
    generate: (call) =>
      generateAutopilotObject({
        organizationId: ctx.organizationId,
        modelId: AUTOPILOT_PLANNER_MODEL_ID,
        tag: "planner",
        log,
        schema: call.schema,
        instructions: call.instructions,
        prompt: call.prompt,
        maxOutputTokens: AUTOPILOT_PLANNER_MAX_OUTPUT_TOKENS,
        retryReasoning: AUTOPILOT_PLANNER_RETRY_REASONING,
      }),
    evaluate: async (evaluation) => {
      const verdict = await getEvaluationClient().tryEvaluate({
        feature: "autopilot-action",
        organizationId: ctx.organizationId,
        modelId: AUTOPILOT_ACTION_JEV_MODEL_ID,
        state: evaluation.state,
        questions: evaluation.questions,
      });
      return verdict?.answers.act.probabilities ?? null;
    },
  });

  const linked = plan.state.topics.filter((topic) =>
    topic.signals.some((signal) => signal.runId === ctx.runId)
  );
  await log.decision(
    `Linked ${observations.length} observations into ${linked.length} topics`,
    {
      model: AUTOPILOT_PLANNER_MODEL_ID,
      memory: decisionMemory.sha,
      topics: linked.map(
        (topic) =>
          `${topic.title}: ${topic.status}, ${topic.signals.length} signals`
      ),
    }
  );

  const gate = evaluateAutopilotGate({
    action: plan.action,
    topic: plan.topic,
    actionConfidence: plan.actionConfidence,
    // By the finding the topic points at, or one that names the topic: a
    // crash before the memory write must not let the next run act twice.
    activeWork: plan.topic ? topicHasActiveWork(plan.topic, activeWork) : false,
    autonomousPullRequestsInWindow: autonomous,
    draftSlotsFree: openPullRequests < ctx.maxOpenPullRequests,
  });
  const outcome = resolveAutopilotOutcome({
    action: plan.action,
    topic: plan.topic,
    gate,
    observations,
  });
  const observation = plan.topic
    ? primaryObservation(plan.topic, observations, plan.action.type)
    : null;
  if (plan.action.type === "none" || !plan.topic) {
    await log.decision(`Waiting: ${plan.action.reason}`, {
      reason: plan.action.reason,
    });
    return { outcome: "wait", memory: plan.state };
  }
  if (!(outcome && observation)) {
    // resolveAutopilotOutcome and primaryObservation agree: no outcome
    // without a usable observation from this run.
    await log.decision(`Not acting on "${plan.topic.title}" yet`, {
      reason: plan.action.reason,
      checks: describeChecks(gate.checks),
      failed: gate.checks
        .filter((check) => !check.ok)
        .map((check) => check.name),
      ...(gate.open || gate.suggest
        ? {
            observation:
              plan.action.type === "update_page"
                ? "Nothing seen this run names the page to update"
                : "Nothing seen this run to act on",
          }
        : {}),
    });
    return { outcome: "wait", memory: plan.state };
  }
  const { topic, action } = plan;
  await log.decision(
    outcome === "open"
      ? `Writing "${action.brief?.topic ?? topic.title}"`
      : `Saved "${action.brief?.topic ?? topic.title}" as an idea: no room for an automatic pull request`,
    {
      reason: action.reason,
      confidence: plan.actionConfidence,
      checks: describeChecks(gate.checks),
    }
  );
  const evidence = topic.signals
    .map((signal) => `- ${signal.detail}`)
    .join("\n");
  return {
    outcome,
    memory: plan.state,
    topicSlug: topic.slug,
    confidence: plan.actionConfidence,
    proposal: {
      ...observation.proposal,
      // A post is named after the planner's brief, not the observation
      // that triggered it; an update keeps the page it names.
      title:
        action.type === "write_post"
          ? `Blog post: ${action.brief?.topic ?? topic.title}`
          : observation.proposal.title,
      evidence: {
        ...observation.proposal.evidence,
        ...(action.type === "update_page" ? {} : { updatePage: null }),
        topic: {
          slug: topic.slug,
          title: topic.title,
          signals: countIndependentSignals(topic),
        },
        gate: gate.checks,
      },
    },
    brief: {
      topic: action.brief?.topic ?? observation.brief.topic,
      angle: action.brief?.angle ?? observation.brief.angle,
      evidence: `${observation.brief.evidence}\n\nRelated signals:\n${evidence}`,
    },
  };
}

export async function rememberAutopilotPlan(params: {
  ctx: AutopilotRunContext;
  decision: AutopilotPlanDecision;
  acted: AutopilotPlanActed | null;
}) {
  const { ctx, decision } = params;
  if (!decision.memory) {
    return false;
  }
  const log = createAutopilotLogger(ctx, null);
  const snapshot = await openMemorySnapshot(ctx.organizationId);
  const stored = parsePlannerState(await snapshot.read(MEMORY_PATHS.planner));
  if (stored.lastRunId === ctx.runId) {
    return false;
  }
  const state =
    params.acted && "topicSlug" in decision
      ? markTopicActed(decision.memory, decision.topicSlug, params.acted)
      : decision.memory;
  await writePlannerMemory({ ctx, log, state });
  return true;
}
