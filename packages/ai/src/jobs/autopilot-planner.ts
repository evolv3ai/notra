import { AUTOPILOT_ACTION_CHOICE_OPEN } from "../constants/autopilot-planner";
import {
  AUTOPILOT_PLANNER_INSTRUCTIONS,
  buildAutopilotActionEvaluation,
  buildAutopilotPlannerPrompt,
} from "../prompts/autopilot-planner";
import { autopilotPlannerOutputSchema } from "../schemas/autopilot-planner";
import type {
  AutopilotActionEvaluation,
  AutopilotPlannedAction,
  AutopilotPlannerInput,
  AutopilotPlannerOutput,
  AutopilotPlannerState,
  AutopilotTopic,
} from "../types/autopilot-planner";
import { applyPlannerOutput } from "../utils/autopilot-planner";

/**
 * One planning pass: the model links observations into topics and proposes
 * at most one action, then Jev rates that action. The caller supplies both
 * calls, so the dashboard and the evals run the same logic on any model.
 */
export async function planAutopilotRun(params: {
  input: AutopilotPlannerInput;
  runId: string;
  now: Date;
  generate: (call: {
    instructions: string;
    prompt: string;
    schema: typeof autopilotPlannerOutputSchema;
  }) => Promise<AutopilotPlannerOutput>;
  /** Probabilities per choice of the act question, or null when Jev is down. */
  evaluate: (
    evaluation: AutopilotActionEvaluation
  ) => Promise<Record<string, number> | null>;
}): Promise<{
  output: AutopilotPlannerOutput;
  state: AutopilotPlannerState;
  action: AutopilotPlannedAction;
  topic: AutopilotTopic | null;
  actionConfidence: number | null;
}> {
  const output = await params.generate({
    instructions: AUTOPILOT_PLANNER_INSTRUCTIONS,
    prompt: buildAutopilotPlannerPrompt(params.input),
    schema: autopilotPlannerOutputSchema,
  });
  const { state, action } = applyPlannerOutput({
    state: params.input.state,
    output,
    observations: params.input.observations,
    runId: params.runId,
    now: params.now,
  });
  const topic =
    action.topicSlug === null
      ? null
      : (state.topics.find((row) => row.slug === action.topicSlug) ?? null);
  if (!(topic && action.type !== "none")) {
    return { output, state, action, topic, actionConfidence: null };
  }
  const probabilities = await params.evaluate(
    buildAutopilotActionEvaluation({ input: params.input, topic, action })
  );
  return {
    output,
    state,
    action,
    topic,
    actionConfidence: probabilities
      ? (probabilities[AUTOPILOT_ACTION_CHOICE_OPEN] ?? 0)
      : null,
  };
}
