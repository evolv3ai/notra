import type { AutopilotSuggestionWorkflowPayload } from "@/types/autopilot";

import { writeAutopilotSuggestionStep } from "./steps/autopilot-item-steps";

export async function autopilotSuggestionWorkflow(
  payload: AutopilotSuggestionWorkflowPayload
) {
  "use workflow";
  return await writeAutopilotSuggestionStep(payload);
}
