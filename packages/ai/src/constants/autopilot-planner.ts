/**
 * One call per run links observations into topics and picks at most one
 * action. Pinned on its own eval (`bun run evals run autopilot-planner`), not
 * tied to the agent default: Sonnet 5 passed 91% of scenarios, Luna 77%.
 */
export const AUTOPILOT_PLANNER_MODEL_ID = "anthropic/claude-sonnet-5";
/**
 * Thinking takes most of it: a busy week of merges measured 6.6k to 9.5k
 * output tokens, so 8k cut real plans off.
 */
export const AUTOPILOT_PLANNER_MAX_OUTPUT_TOKENS = 16_000;
/**
 * A plan that still runs out of tokens is asked again with less thinking.
 * Not the default: medium and low passed fewer eval scenarios.
 */
export const AUTOPILOT_PLANNER_RETRY_REASONING = "medium";

/** Jev rates the concrete action, not whether any candidate is interesting. */
export const AUTOPILOT_ACTION_JEV_MODEL_ID = "typesafe-ai/jev-1.14.0";
export const AUTOPILOT_ACTION_MIN_CONFIDENCE = 0.85;
/**
 * Distinct observations a topic needs before a pull request. A gap or pull
 * request seen again on a later run is still one.
 */
export const AUTOPILOT_TOPIC_MIN_SIGNALS = 2;
/** Autonomous pull requests per workspace and window, so a bad gate cannot spam. */
export const AUTOPILOT_AUTONOMOUS_PR_BUDGET = { count: 1, days: 7 } as const;

export const AUTOPILOT_TOPIC_MAX_SIGNALS = 10;
export const AUTOPILOT_SIGNAL_DETAIL_MAX_CHARS = 280;
/** planner.md is preloaded; it is trimmed to stay under the 16 KB hard limit. */
export const AUTOPILOT_PLANNER_FILE_MAX_BYTES = 14 * 1024;
export const AUTOPILOT_TRIMMED_SIGNAL_DETAIL_CHARS = 80;
/** Topics nobody saw again in this long are forgotten, unless something was opened for them. */
export const AUTOPILOT_TOPIC_STALE_DAYS = 30;
export const AUTOPILOT_PLANNER_STATE_FENCE = "notra-planner-state";
export const AUTOPILOT_PLANNER_STATE_BLOCK = new RegExp(
  `\`\`\`json ${AUTOPILOT_PLANNER_STATE_FENCE}\\n([\\s\\S]*?)\\n\`\`\``
);
export const AUTOPILOT_TOPIC_SLUG_SEPARATORS = /[^a-z0-9]+/g;
export const AUTOPILOT_TOPIC_SLUG_EDGE_DASHES = /^-+|-+$/g;
export const AUTOPILOT_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The next step of a topic whose status follows its finding. The planner does
 * not update these topics, so code keeps the step in line with the finding.
 */
export const AUTOPILOT_FOLLOWED_TOPIC_NEXT_STEP = {
  in_progress: "Follow the pull request until it is merged or closed.",
  ready: "Wait for someone to start the saved idea.",
  done: "Nothing: the post is merged.",
  dismissed: "Nothing, unless new evidence changes the picture.",
} as const;

export const AUTOPILOT_ACTION_CHOICE_OPEN = "open";
export const AUTOPILOT_ACTION_CHOICE_WAIT = "wait";
