import type { z } from "zod";

import type { buildAutopilotActionEvaluation } from "../prompts/autopilot-planner";
import type { autopilotPlannerOutputSchema } from "../schemas/autopilot-planner";

export type AutopilotSignalSource = "keywords" | "commits";

/**
 * Something a job noticed this run: a content gap, a merged pull request.
 * Observations never act on their own; the planner links them into topics.
 */
export interface AutopilotObservation {
  /** Stable across runs: the finding fingerprint, e.g. commits:acme/app#12. */
  id: string;
  source: AutopilotSignalSource;
  title: string;
  detail: string;
  /** An existing page this would rewrite instead of adding a post. */
  updatePage?: { url: string; title: string } | null;
}

export interface AutopilotTopicSignal {
  observationId: string;
  source: AutopilotSignalSource;
  title: string;
  detail: string;
  runId: string;
  seenAt: string;
}

export type AutopilotTopicStatus =
  | "watching"
  | "researching"
  | "ready"
  | "in_progress"
  | "done"
  | "dismissed";

export interface AutopilotTopic {
  slug: string;
  title: string;
  status: AutopilotTopicStatus;
  summary: string;
  openQuestions: string[];
  /** The condition that would make the topic worth acting on. */
  nextStep: string;
  signals: AutopilotTopicSignal[];
  /** The finding Autopilot opened for this topic, once it acted. */
  findingId: string | null;
  pullRequestUrl: string | null;
  updatedAt: string;
}

export interface AutopilotPlannerState {
  version: 1;
  /** The run that last planned; a replayed step sees its own id and stops. */
  lastRunId: string | null;
  topics: AutopilotTopic[];
}

export interface AutopilotPlannerInput {
  brand: { name: string; about: string; audience: string };
  rules: string[];
  feedback: string[];
  state: AutopilotPlannerState;
  observations: AutopilotObservation[];
  existingPosts: string[];
  /** Drafts and ideas already in flight, so the planner never doubles them. */
  activeWork: { title: string; status: string }[];
}

export type AutopilotPlannedActionType = "none" | "write_post" | "update_page";

export interface AutopilotPlannedAction {
  type: AutopilotPlannedActionType;
  topicSlug: string | null;
  reason: string;
  brief: { topic: string; angle: string } | null;
}

export interface AutopilotGateCheck {
  name:
    | "action"
    | "signals"
    | "confidence"
    | "active_work"
    | "budget"
    | "draft_limit";
  ok: boolean;
  detail: string;
}

export interface AutopilotGateResult {
  /** Every check passed: Autopilot may open the pull request on its own. */
  open: boolean;
  /** Only capacity said no: keep it as an idea someone can start. */
  suggest: boolean;
  checks: AutopilotGateCheck[];
}

export type AutopilotPlannerOutput = z.infer<
  typeof autopilotPlannerOutputSchema
>;

export type AutopilotActionEvaluation = ReturnType<
  typeof buildAutopilotActionEvaluation
>;
