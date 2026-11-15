import {
  AUTOPILOT_ACTION_JEV_MODEL_ID,
  AUTOPILOT_DAY_MS,
  AUTOPILOT_PLANNER_MAX_OUTPUT_TOKENS,
  AUTOPILOT_PLANNER_RETRY_REASONING,
} from "@notra/ai/constants/autopilot-planner";
import { planAutopilotRun } from "@notra/ai/jobs/autopilot-planner";
import type {
  AutopilotGateResult,
  AutopilotPlannedAction,
  AutopilotPlannerInput,
  AutopilotPlannerOutput,
  AutopilotPlannerState,
  AutopilotTopic,
} from "@notra/ai/types/autopilot-planner";
import {
  applyPlannerOutput,
  countIndependentSignals,
  evaluateAutopilotGate,
  fitPlannerState,
  markTopicActed,
  parsePlannerState,
  renderPlannerState,
  resolveAutopilotOutcome,
  topicHasActiveWork,
  topicSlug,
} from "@notra/ai/utils/autopilot-planner";
import { MEMORY_PATHS } from "@notra/memory/constants/memory";
import { openMemorySnapshot, updateMemory } from "@notra/memory/memory";
import { createInMemoryStore } from "@notra/memory/stores/in-memory";
import type { MemoryStore } from "@notra/memory/types/memory";
import { byteLength } from "@notra/memory/utils/access";
import {
  parseRecords,
  recordId,
  renderRecords,
} from "@notra/memory/utils/records";
import { NoObjectGeneratedError } from "ai";

import {
  EVAL_AUTOPILOT_ACTED_BY_OUTCOME,
  EVAL_AUTOPILOT_ORGANIZATION_ID,
} from "../constants/autopilot-planner";
import {
  SCENARIO_BRAND,
  SCENARIO_START,
} from "../fixtures/autopilot-scenarios";
import {
  callJev,
  callObject,
  runCostDetails,
  toUsage,
} from "../models/gateway";
import type {
  AutopilotScenarioExpected,
  AutopilotScenarioInput,
  AutopilotScenarioOutput,
  PlannerRunResult,
  ScenarioRun,
} from "../types/autopilot-planner";
import type {
  CallContext,
  CallResult,
  DemoContext,
  EvalCase,
  EvalCost,
  TokenUsage,
} from "../types/eval";
import { aggregateCosts } from "../utils/cost";

const runIdAt = (index: number) => `run-${index + 1}`;
const runDate = (index: number) =>
  new Date(new Date(SCENARIO_START).getTime() + index * AUTOPILOT_DAY_MS);

function records(prefix: string, texts: readonly string[]) {
  return texts.map((text) => ({
    id: recordId(prefix, text),
    title: text,
    body: "",
    meta: { source: "dashboard" },
  }));
}

/** Writes the scenario's starting memory as a person would, so rules.md exists. */
async function seedMemory(store: MemoryStore, input: AutopilotScenarioInput) {
  await updateMemory({
    organizationId: EVAL_AUTOPILOT_ORGANIZATION_ID,
    actor: "user",
    message: "Seed eval scenario",
    store,
    mutate: async () => ({
      [MEMORY_PATHS.rules]: renderRecords({
        title: "Rules",
        intro: "Standing rules for Autopilot.",
        records: records("autopilot-rule", input.rules),
      }),
      [MEMORY_PATHS.feedback]: renderRecords({
        title: "Feedback",
        intro: "Notes from the team about past suggestions.",
        records: records("feedback", input.feedback),
      }),
      [MEMORY_PATHS.planner]: renderPlannerState({
        version: 1,
        lastRunId: null,
        topics: input.topics,
      }),
    }),
  });
}

/** Same reads as the dashboard's loadDecisionMemory + runAutopilotPlanner. */
async function readPlannerInput(
  store: MemoryStore,
  input: AutopilotScenarioInput,
  run: ScenarioRun
): Promise<{ plannerInput: AutopilotPlannerInput; rules: string | null }> {
  const snapshot = await openMemorySnapshot(
    EVAL_AUTOPILOT_ORGANIZATION_ID,
    store
  );
  const [rules, feedback, planner] = await Promise.all([
    snapshot.read(MEMORY_PATHS.rules),
    snapshot.read(MEMORY_PATHS.feedback),
    snapshot.read(MEMORY_PATHS.planner),
  ]);
  return {
    rules,
    plannerInput: buildPlannerInput({
      input,
      run,
      state: parsePlannerState(planner),
      rules: parseRecords(rules, "autopilot-rule").map(
        (record) => record.body || record.title
      ),
      feedback: parseRecords(feedback, "feedback").map(
        (record) => record.body || record.title
      ),
    }),
  };
}

function buildPlannerInput(params: {
  input: AutopilotScenarioInput;
  run: ScenarioRun;
  state: AutopilotPlannerState;
  rules: string[];
  feedback: string[];
}): AutopilotPlannerInput {
  return {
    brand: SCENARIO_BRAND,
    rules: params.rules,
    feedback: params.feedback,
    state: params.state,
    observations: params.run.observations,
    existingPosts: params.input.existingPosts,
    activeWork: params.input.activeWork.map(({ title, status }) => ({
      title,
      status,
    })),
  };
}

/** What the dashboard writes after a run: planner.md, trimmed to its limit. */
function memoryFiles(state: AutopilotPlannerState) {
  return { [MEMORY_PATHS.planner]: renderPlannerState(fitPlannerState(state)) };
}

/**
 * What runAutopilotPlanner does after the gate: an open or suggested action
 * with an observation from this run becomes a finding the topic follows.
 */
function settleRun(params: {
  plan: {
    output: AutopilotPlannerOutput;
    state: AutopilotPlannerState;
    action: AutopilotPlannedAction;
    topic: AutopilotTopic | null;
    actionConfidence: number | null;
  };
  run: ScenarioRun;
  runIndex: number;
  openedSoFar: number;
  activeWork: AutopilotScenarioInput["activeWork"];
}): { state: AutopilotPlannerState; result: PlannerRunResult } {
  const { plan, run, runIndex } = params;
  const topic = plan.topic;
  const runId = runIdAt(runIndex);
  const gate: AutopilotGateResult = evaluateAutopilotGate({
    action: plan.action,
    topic: plan.topic,
    actionConfidence: plan.actionConfidence,
    activeWork: topic
      ? topicHasActiveWork(
          topic,
          params.activeWork.map((row) => ({ topicSlug: row.topicSlug ?? null }))
        )
      : false,
    autonomousPullRequestsInWindow:
      (run.autonomousPullRequestsInWindow ?? 0) + params.openedSoFar,
    draftSlotsFree: run.draftSlotsFree ?? true,
  });
  const outcome = resolveAutopilotOutcome({
    action: plan.action,
    topic,
    gate,
    observations: run.observations,
  });
  const acted: PlannerRunResult["acted"] = outcome
    ? EVAL_AUTOPILOT_ACTED_BY_OUTCOME[outcome]
    : null;
  const state: AutopilotPlannerState =
    acted && topic
      ? markTopicActed(plan.state, topic.slug, {
          findingId: `finding_${runId}`,
          status: acted === "opened" ? "in_progress" : "ready",
          pullRequestUrl:
            acted === "opened"
              ? `https://github.com/cartwheel/site/pull/${200 + runIndex}`
              : null,
        })
      : plan.state;
  return {
    state,
    result: {
      runId,
      action: plan.action.type,
      topicSlug: plan.action.topicSlug,
      reason: plan.action.reason,
      brief: plan.action.brief,
      actionConfidence: plan.actionConfidence,
      gate: {
        open: gate.open,
        suggest: gate.suggest,
        failed: gate.checks
          .filter((check) => !check.ok)
          .map((check) => check.name),
      },
      acted,
      signals: Object.fromEntries(
        state.topics
          .filter((topic) =>
            topic.signals.some((signal) => signal.runId === runId)
          )
          .map((topic) => [topic.slug, countIndependentSignals(topic)])
      ),
      plannerBytes: byteLength(memoryFiles(state)[MEMORY_PATHS.planner]),
      memory: { written: [] },
    },
  };
}

function finalTopics(
  state: AutopilotPlannerState
): AutopilotScenarioOutput["topics"] {
  return state.topics.map((topic) => ({
    slug: topic.slug,
    title: topic.title,
    status: topic.status,
    summary: topic.summary,
    observations: [
      ...new Set(topic.signals.map((signal) => signal.observationId)),
    ],
    independentSignals: countIndependentSignals(topic),
  }));
}

function addUsage(total: TokenUsage, usage: TokenUsage) {
  total.inputTokens += usage.inputTokens;
  total.outputTokens += usage.outputTokens;
  total.cachedInputTokens += usage.cachedInputTokens;
}

/**
 * Runs the scenario through the real planAutopilotRun and gate, with the
 * contender as the planner and prod Jev on the act question. State moves
 * between runs only through the in-memory @notra/memory store, written as
 * actor "autopilot-run", so access rules and size limits apply as in prod.
 */
export async function runPlannerScenario(
  input: AutopilotScenarioInput,
  ctx: CallContext
): Promise<CallResult<AutopilotScenarioOutput>> {
  const store = createInMemoryStore();
  await seedMemory(store, input);
  const usage: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
  };
  const costs: Partial<EvalCost>[] = [];
  const transcript: string[] = [];
  const runs: PlannerRunResult[] = [];
  let rulesBefore: string | null = null;
  let opened = 0;

  for (const [index, run] of input.runs.entries()) {
    const { plannerInput, rules } = await readPlannerInput(store, input, run);
    rulesBefore ??= rules;
    const plan = await planAutopilotRun({
      input: plannerInput,
      runId: runIdAt(index),
      now: runDate(index),
      generate: async (call) => {
        const generate = (reasoning?: "low" | "medium") =>
          callObject({
            modelId: ctx.contender.modelId,
            feature: "autopilot-planner",
            schema: call.schema,
            system: call.instructions,
            prompt: call.prompt,
            maxOutputTokens: AUTOPILOT_PLANNER_MAX_OUTPUT_TOKENS,
            reasoning,
            abortSignal: ctx.abortSignal,
          });
        // Same retry as the dashboard's generateAutopilotObject.
        const result = await generate().catch(async (error: unknown) => {
          if (!NoObjectGeneratedError.isInstance(error)) {
            throw error;
          }
          // The failed attempt was billed too.
          const failed = toUsage(error.usage);
          addUsage(usage, failed);
          costs.push(
            await runCostDetails(ctx.contender.modelId, failed, [
              { usage: error.usage },
            ])
          );
          return generate(
            error.finishReason === "length"
              ? AUTOPILOT_PLANNER_RETRY_REASONING
              : undefined
          );
        });
        addUsage(usage, result.usage);
        costs.push(result);
        return result.output;
      },
      evaluate: async (evaluation) => {
        // Prod's tryEvaluate turns a failed Jev call into null, and the gate waits.
        try {
          const result = await callJev({
            modelId: AUTOPILOT_ACTION_JEV_MODEL_ID,
            feature: "autopilot-action",
            state: evaluation.state,
            questions: evaluation.questions,
            abortSignal: ctx.abortSignal,
          });
          costs.push(result);
          return result.output.answers.act.probabilities ?? null;
        } catch (error) {
          if (ctx.abortSignal.aborted) {
            throw error;
          }
          return null;
        }
      },
    });
    const settled = settleRun({
      plan,
      run,
      runIndex: index,
      openedSoFar: opened,
      activeWork: input.activeWork,
    });
    if (settled.result.acted === "opened") {
      opened += 1;
    }
    const files = memoryFiles(settled.state);
    try {
      await updateMemory({
        organizationId: EVAL_AUTOPILOT_ORGANIZATION_ID,
        actor: "autopilot-run",
        message: `Autopilot run ${runIdAt(index)}`,
        store,
        mutate: async () => files,
      });
      settled.result.memory = { written: Object.keys(files) };
    } catch (error) {
      settled.result.memory = {
        written: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
    runs.push(settled.result);
    transcript.push(
      `## ${runIdAt(index)}\n${JSON.stringify(plan.output, null, 2)}\n\ngate: ${JSON.stringify(settled.result.gate)} confidence: ${plan.actionConfidence ?? "n/a"} acted: ${settled.result.acted ?? "no"}`
    );
  }

  const snapshot = await openMemorySnapshot(
    EVAL_AUTOPILOT_ORGANIZATION_ID,
    store
  );
  const [plannerFile, rulesAfter] = await Promise.all([
    snapshot.read(MEMORY_PATHS.planner),
    snapshot.read(MEMORY_PATHS.rules),
  ]);
  return {
    output: {
      runs,
      topics: finalTopics(parsePlannerState(plannerFile)),
      rulesUnchanged: rulesAfter === rulesBefore,
    },
    usage,
    ...aggregateCosts(costs),
    transcript: transcript.join("\n\n"),
  };
}

/** A scripted planner that is right as often as the model's demo skill. */
function demoPlannerOutput(params: {
  testCase: EvalCase<AutopilotScenarioInput, AutopilotScenarioExpected>;
  run: ScenarioRun;
  plannerInput: AutopilotPlannerInput;
  demo: DemoContext;
}): AutopilotPlannerOutput {
  const { testCase, run, plannerInput, demo } = params;
  const { groups, excluded = [] } = testCase.expected;
  const slugFor = (key: string) => {
    const group = groups.find((row) => row.key === key);
    if (!group) {
      return null;
    }
    const ids = new Set(group.observations);
    const known = plannerInput.state.topics.find(
      (topic) =>
        topic.slug === group.slug ||
        topic.signals.some((signal) => ids.has(signal.observationId))
    );
    return known?.slug ?? null;
  };
  const touched = new Set<string>();
  const assignments = run.observations.map((observation) => {
    const group = groups.find((row) =>
      row.observations.includes(observation.id)
    );
    if (!(group && demo.hit())) {
      return {
        observationId: observation.id,
        topicSlug: topicSlug(observation.title),
        newTopicTitle: observation.title,
      };
    }
    touched.add(group.key);
    const slug = slugFor(group.key);
    return {
      observationId: observation.id,
      topicSlug: slug ?? topicSlug(group.title),
      newTopicTitle: slug ? null : group.title,
    };
  });
  const topics = [...touched].map((key) => {
    const group = groups.find((row) => row.key === key);
    const rule = excluded.find((row) => row.group === key);
    const ripe =
      run.expected.group === key && run.expected.action[0] !== "none";
    let status: "dismissed" | "ready" | "watching" = ripe
      ? "ready"
      : "watching";
    if (rule) {
      status = "dismissed";
    }
    return {
      slug: slugFor(key) ?? group?.title ?? key,
      status: demo.pick(status, ["watching", "ready", "dismissed"] as const),
      summary: `${group?.title ?? key}: demo summary`,
      openQuestions: [],
      nextStep: "",
    };
  });
  const type = demo.pick(run.expected.action[0] ?? "none", [
    "none",
    "write_post",
    "update_page",
  ] as const);
  const target = run.expected.group ?? [...touched][0];
  const targetTitle = groups.find((row) => row.key === target)?.title ?? null;
  const slug = target ? (slugFor(target) ?? targetTitle) : null;
  return {
    assignments,
    topics,
    action: {
      type,
      topicSlug: type === "none" ? null : slug,
      reason: "demo",
      brief:
        type === "none"
          ? null
          : { topic: targetTitle ?? "demo", angle: "demo angle" },
    },
  };
}

/**
 * Demo mode: the same applyPlannerOutput, gate and state round trip through
 * planner.md, with a scripted planner and simulated Jev instead of calls.
 */
export function demoPlannerScenario(
  testCase: EvalCase<AutopilotScenarioInput, AutopilotScenarioExpected>,
  demo: DemoContext
): AutopilotScenarioOutput {
  const input = testCase.input;
  let plannerFile = renderPlannerState({
    version: 1,
    lastRunId: null,
    topics: input.topics,
  });
  const runs: PlannerRunResult[] = [];
  let opened = 0;
  for (const [index, run] of input.runs.entries()) {
    const plannerInput = buildPlannerInput({
      input,
      run,
      state: parsePlannerState(plannerFile),
      rules: input.rules,
      feedback: input.feedback,
    });
    const output = demoPlannerOutput({ testCase, run, plannerInput, demo });
    const applied = applyPlannerOutput({
      state: plannerInput.state,
      output,
      observations: run.observations,
      runId: runIdAt(index),
      now: runDate(index),
    });
    const topic =
      applied.state.topics.find(
        (row) => row.slug === applied.action.topicSlug
      ) ?? null;
    const jevSays = demo.hit() ? 0.92 : 0.55;
    const settled = settleRun({
      plan: {
        output,
        ...applied,
        topic,
        actionConfidence: applied.action.type === "none" ? null : jevSays,
      },
      run,
      runIndex: index,
      openedSoFar: opened,
      activeWork: input.activeWork,
    });
    if (settled.result.acted === "opened") {
      opened += 1;
    }
    const files = memoryFiles(settled.state);
    settled.result.memory = { written: Object.keys(files) };
    plannerFile = files[MEMORY_PATHS.planner];
    runs.push(settled.result);
  }
  return {
    runs,
    topics: finalTopics(parsePlannerState(plannerFile)),
    rulesUnchanged: true,
  };
}
