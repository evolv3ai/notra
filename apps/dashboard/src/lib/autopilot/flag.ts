import { Effect } from "effect";

import {
  AUTOPILOT_FLAG_KEY,
  AUTOPILOT_FLAG_TIMEOUT_MS,
  AUTOPILOT_WORKFLOW_GRAPH_FLAG_KEY,
} from "@/constants/autopilot";
import { resolveGeoFlagState } from "@/lib/geo/flag";

function isFlagEnabled(
  flagKey: string,
  organizationId: string
): Promise<boolean> {
  if (process.env.NODE_ENV === "development") {
    return Promise.resolve(true);
  }
  return Effect.runPromise(
    resolveGeoFlagState(flagKey, organizationId).pipe(
      Effect.timeout(AUTOPILOT_FLAG_TIMEOUT_MS),
      Effect.map((state) => state === "enabled")
    )
  ).catch(() => false);
}

export function isAutopilotEnabledForOrganization(organizationId: string) {
  return isFlagEnabled(AUTOPILOT_FLAG_KEY, organizationId);
}

export function isAutopilotWorkflowGraphEnabled(organizationId: string) {
  return isFlagEnabled(AUTOPILOT_WORKFLOW_GRAPH_FLAG_KEY, organizationId);
}
