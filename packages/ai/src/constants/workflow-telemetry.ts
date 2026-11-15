const workflowFields = ["runId", "workflow"];
const snapshotFields = [
  ...workflowFields,
  "sweepId",
  "jobStatus",
  "queueWaitMs",
];

export const WORKFLOW_TELEMETRY_FIELDS: Readonly<
  Record<string, readonly string[]>
> = {
  "job.queued": workflowFields,
  "job.completed": workflowFields,
  "job.failed": workflowFields,
  "job.snapshot": snapshotFields,
  "job.step.snapshot": [
    ...workflowFields,
    "sweepId",
    "stepId",
    "stepStatus",
    "attempt",
  ],
  "monitoring.operation.failed": [
    "sweepId",
    "runId",
    "jobStatus",
    "operation",
    "errorName",
  ],
  "monitoring.sweep.completed": [
    "sweepId",
    "runs",
    "pendingRuns",
    "runningRuns",
    "steps",
    "statusesChecked",
    "errors",
    "activeTruncated",
    "terminalTruncated",
    "stepsTruncated",
    "budgetExceeded",
    "operation",
    "errorName",
  ],
  "backend.dependency.checked": ["dependency", "errorName"],
};

export const WORKFLOW_TELEMETRY_IDENTIFIERS = new Set([
  "runId",
  "sweepId",
  "stepId",
]);
export const WORKFLOW_TELEMETRY_COUNTS = new Set([
  "runs",
  "pendingRuns",
  "runningRuns",
  "steps",
  "statusesChecked",
  "errors",
  "attempt",
]);
export const WORKFLOW_TELEMETRY_FLAGS = new Set([
  "activeTruncated",
  "terminalTruncated",
  "stepsTruncated",
  "budgetExceeded",
]);
export const WORKFLOW_TELEMETRY_ENUMS: Readonly<
  Record<string, ReadonlySet<string>>
> = {
  workflow: new Set([
    "brand-analysis",
    "brand-guidelines",
    "chat",
    "onboarding-agent",
    "schedule-content",
    "event-content",
    "social-analytics-sync",
    "geo-scan",
    "geo-writer",
    "agent-readiness",
    "gsc-sync",
    "on-demand-content",
    "content-email-digest",
    "geoSentimentWorkflow",
  ]),
  jobStatus: new Set([
    "pending",
    "running",
    "failed",
    "cancelled",
    "completed",
  ]),
  stepStatus: new Set([
    "pending",
    "running",
    "failed",
    "cancelled",
    "completed",
    "retrying",
  ]),
  operation: new Set([
    "workflow.world",
    "workflow.runs.list",
    "workflow.steps.list",
  ]),
  dependency: new Set(["postgres", "redis"]),
  errorName: new Set([
    "Error",
    "TimeoutError",
    "UnknownError",
    "AbortError",
    "TypeError",
    "MonitoringOperationError",
  ]),
};
