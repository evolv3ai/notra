import { AUTOPILOT_PLANNER_MODEL_ID } from "@notra/ai/constants/autopilot-planner";

import { AUTOPILOT_SCENARIOS } from "../fixtures/autopilot-scenarios";
import {
  demoPlannerScenario,
  runPlannerScenario,
} from "../harness/autopilot-planner";
import { scorePlannerScenario } from "../scoring/autopilot-planner";
import type {
  AutopilotScenarioExpected,
  AutopilotScenarioInput,
  AutopilotScenarioOutput,
} from "../types/autopilot-planner";
import type { EvalSuite } from "../types/eval";

export const autopilotPlannerSuite: EvalSuite<
  AutopilotScenarioInput,
  AutopilotScenarioExpected,
  AutopilotScenarioOutput
> = {
  id: "autopilot-planner",
  name: "Autopilot planner",
  kind: "generation",
  stage: "jobs/autopilot-planner.ts planAutopilotRun",
  description:
    "Multi-run Autopilot scenarios through the real planAutopilotRun + evaluateAutopilotGate. The contender is the planner model; prod Jev rates the act question. State moves between runs through an in-memory @notra/memory store as actor autopilot-run. Covers linking, restraint, rules, prompt injection, budget, coverage, update_page, compaction and in-flight work.",
  cases: AUTOPILOT_SCENARIOS,
  productionModel: AUTOPILOT_PLANNER_MODEL_ID,
  defaultContenders: [
    AUTOPILOT_PLANNER_MODEL_ID,
    "openai/gpt-6-luna",
    "anthropic/claude-haiku-4.5",
    "anthropic/claude-opus-5.5",
  ],
  timeoutMs: 360_000,
  run: runPlannerScenario,
  score: scorePlannerScenario,
  demoOutput: demoPlannerScenario,
  transcript(output) {
    return output.runs
      .map(
        (run) =>
          `${run.runId}: ${run.action}${run.topicSlug ? ` on ${run.topicSlug}` : ""} (${run.reason})\n  gate failed ${run.gate.failed.join(", ") || "nothing"}, acted ${run.acted ?? "no"}, signals ${JSON.stringify(run.signals)}`
      )
      .concat(
        output.topics.map(
          (topic) =>
            `topic ${topic.slug} [${topic.status}] ${topic.observations.join(", ")}`
        )
      )
      .join("\n");
  },
};
