import type {
  AutopilotObservation,
  AutopilotPlannedActionType,
  AutopilotSignalSource,
  AutopilotTopic,
  AutopilotTopicStatus,
} from "@notra/ai/types/autopilot-planner";

import type { EvalCase } from "./eval";

/** Observations the scenario says belong to one topic. */
export interface ScenarioGroup {
  key: string;
  title: string;
  observations: string[];
  /** The existing topic these must land in, for follow-up runs. */
  slug?: string;
}

/** What the pipeline may do in one run. */
export interface ScenarioRunExpectation {
  /** Acceptable planner actions; the first one is the ideal. */
  action: AutopilotPlannedActionType[];
  /** The group an action must target. */
  group?: string;
  /** never: no pull request; suggest: capacity blocks it, keep the idea. */
  pr: "never" | "allowed" | "suggest";
}

export interface ScenarioRun {
  observations: AutopilotObservation[];
  /** Automatic pull requests already opened in the budget window. */
  autonomousPullRequestsInWindow?: number;
  draftSlotsFree?: boolean;
  expected: ScenarioRunExpectation;
}

export interface AutopilotScenarioInput {
  rules: string[];
  feedback: string[];
  topics: AutopilotTopic[];
  existingPosts: string[];
  /** Drafts in flight; topicSlug links one to a topic like a finding's evidence. */
  activeWork: { title: string; status: string; topicSlug?: string }[];
  runs: ScenarioRun[];
}

export interface AutopilotScenarioExpected {
  groups: ScenarioGroup[];
  /** Pull requests the whole scenario may open. */
  maxPullRequests: number;
  /** At least one run must propose an action for this group. */
  mustActOn?: string;
  /** Groups that must never be acted on and end in this status. */
  excluded?: { group: string; status: AutopilotTopicStatus }[];
  /** Injected text that must not end up in topic summaries. */
  forbiddenText?: string[];
}

export interface PlannerRunResult {
  runId: string;
  action: AutopilotPlannedActionType;
  topicSlug: string | null;
  reason: string;
  brief: { topic: string; angle: string } | null;
  actionConfidence: number | null;
  gate: { open: boolean; suggest: boolean; failed: string[] };
  /** What the dashboard would do with the gate result. */
  acted: "opened" | "suggested" | null;
  /** Independent signals per topic this run touched. */
  signals: Record<string, number>;
  /** Size of planner.md after the run. */
  plannerBytes: number;
  /** Paths committed to memory, or the write error. */
  memory: { written: string[]; error?: string };
}

export interface PlannerFinalTopic {
  slug: string;
  title: string;
  status: AutopilotTopicStatus;
  summary: string;
  observations: string[];
  independentSignals: number;
}

export interface AutopilotScenarioOutput {
  runs: PlannerRunResult[];
  topics: PlannerFinalTopic[];
  rulesUnchanged: boolean;
}

export type AutopilotScenario = EvalCase<
  AutopilotScenarioInput,
  AutopilotScenarioExpected
>;
