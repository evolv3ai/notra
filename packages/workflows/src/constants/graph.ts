import type { WorkflowPort } from "../types/graph";

export const WORKFLOW_NODE_KINDS = [
  "trigger",
  "task",
  "ai",
  "integration",
  "condition",
  "switch",
  "workflow",
] as const;

export const WORKFLOW_ERROR_POLICIES = ["fail", "continue", "route"] as const;

export const WORKFLOW_STARTED_BY = ["schedule", "call", "both"] as const;

export const WORKFLOW_RULE_OPERATORS = [
  "equals",
  "not_equals",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
  "exists",
  "in",
] as const;

export const WORKFLOW_DEFAULT_OUTPUT_PORT = "out";

export const WORKFLOW_ERROR_PORT = "error";

export const WORKFLOW_OTHERWISE_PORT = "otherwise";

export const WORKFLOW_TRIGGER_TYPE = "core.trigger";

export const WORKFLOW_IF_TYPE = "core.if";

export const WORKFLOW_SWITCH_TYPE = "core.switch";

export const WORKFLOW_CALL_TYPE = "core.run-workflow";

export const WORKFLOW_CORE_TYPE_PREFIX = "core.";

export const WORKFLOW_FAILURE_NODE_ID = "$failure";

export const WORKFLOW_MAX_CALL_DEPTH = 3;

export const WORKFLOW_IF_PORTS: WorkflowPort[] = [
  { id: "true", label: "Yes" },
  { id: "false", label: "No" },
];
