import type { AutopilotObservationJob } from "@/types/autopilot-runtime";

export const AUTOPILOT_OBSERVATION_STEPS: {
  job: AutopilotObservationJob;
  title: string;
}[] = [
  { job: "keywords", title: "Find content gaps" },
  { job: "commits", title: "Read merged pull requests" },
  { job: "prompts", title: "Review tracked prompts" },
  { job: "competitors", title: "Summarize competitors" },
];

export const AUTOPILOT_TOPIC_ALREADY_TAKEN_MESSAGE =
  "This topic is already being written, proposed, merged or dismissed";

export const AUTOPILOT_WORKFLOW_COLUMN_WIDTH = 320;
export const AUTOPILOT_WORKFLOW_ROW_HEIGHT = 190;
export const AUTOPILOT_WORKFLOW_RUN_REFERENCE = "{{trigger.autopilotRunId}}";
