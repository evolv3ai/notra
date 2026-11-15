import type { WorkflowRunSummary } from "../types/workflow";

export const WORKFLOW_RUNS: WorkflowRunSummary[] = [
  {
    durationMs: 14_200,
    id: "Run #128",
    startedAt: "Today, 09:00",
    status: "success",
    steps: 11,
    trigger: "Schedule",
  },
  {
    durationMs: 16_100,
    id: "Run #127",
    startedAt: "Oct 20, 09:00",
    status: "success",
    steps: 11,
    trigger: "Schedule",
  },
  {
    durationMs: 6_400,
    id: "Run #126",
    startedAt: "Oct 17, 14:12",
    status: "error",
    steps: 5,
    trigger: "Manual",
  },
  {
    durationMs: 15_800,
    id: "Run #125",
    startedAt: "Oct 13, 09:00",
    status: "success",
    steps: 11,
    trigger: "Schedule",
  },
  {
    durationMs: 17_300,
    id: "Run #124",
    startedAt: "Oct 6, 09:00",
    status: "success",
    steps: 11,
    trigger: "Schedule",
  },
];
