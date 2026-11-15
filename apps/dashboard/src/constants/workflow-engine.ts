import type { AutopilotAutomationKind } from "@/types/autopilot-metrics";

export const WORKFLOW_NODE_MAX_RETRIES = 2;

export const WORKFLOW_STORED_PREVIEW_MAX_CHARS = 4000;

export const WORKFLOW_STORED_VALUE_MAX_CHARS = 32_000;

export const WORKFLOW_RUN_STOPPED_MESSAGE = "The run was stopped";

export const AUTOPILOT_DAILY_WORKFLOW_KEY = "autopilot.daily";

export const AUTOPILOT_CONTENT_WORKFLOW_KEY = "autopilot.content";

export const AUTOPILOT_TEMPLATE_WORKFLOW_KEYS = {
  readiness: "autopilot.readiness",
  keywords: "autopilot.content-gaps",
  commits: "autopilot.releases",
} as const satisfies Record<AutopilotAutomationKind, string>;
