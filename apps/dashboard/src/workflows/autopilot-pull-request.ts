import { getWorkflowMetadata } from "workflow";

import type { AutopilotPullRequestWorkflowPayload } from "@/types/autopilot";

import {
  claimAutopilotPullRequestStep,
  completeAutopilotPullRequestStep,
  processAutopilotPullRequestStep,
} from "./steps/autopilot-item-steps";

export async function autopilotPullRequestWorkflow(
  payload: AutopilotPullRequestWorkflowPayload
) {
  "use workflow";
  const { workflowRunId } = getWorkflowMetadata();
  if (
    !(await claimAutopilotPullRequestStep(payload.deliveryId, workflowRunId))
  ) {
    return;
  }
  await processAutopilotPullRequestStep(payload.rawBody);
  await completeAutopilotPullRequestStep(payload.deliveryId, workflowRunId);
}
