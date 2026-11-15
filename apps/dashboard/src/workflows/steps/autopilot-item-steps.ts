import "@/workflows/runtime";
import {
  claimGitHubMentionDelivery,
  completeGitHubMentionDelivery,
} from "@notra/ai/utils/github-mention-delivery";

import { AUTOPILOT_GITHUB_DELIVERY_PREFIX } from "@/constants/autopilot";
import { handleAutopilotPullRequestEvent } from "@/lib/autopilot/pull-request-events";
import { writeSuggestedPost } from "@/lib/autopilot/suggestions";
import type { AutopilotSuggestionWorkflowPayload } from "@/types/autopilot";

export async function writeAutopilotSuggestionStep(
  payload: AutopilotSuggestionWorkflowPayload
) {
  "use step";
  // Claim and credit hold live inside the durable job, not the HTTP request.
  await writeSuggestedPost(
    payload.organizationId,
    payload.findingId,
    payload.runId
  );
}

// Like GitHub mentions: a partially completed external write must not be blindly replayed.
writeAutopilotSuggestionStep.maxRetries = 0;

export async function claimAutopilotPullRequestStep(
  deliveryId: string,
  runId: string
) {
  "use step";
  return await claimGitHubMentionDelivery(
    `${AUTOPILOT_GITHUB_DELIVERY_PREFIX}${deliveryId}`,
    runId
  );
}

export async function processAutopilotPullRequestStep(rawBody: string) {
  "use step";
  await handleAutopilotPullRequestEvent(rawBody);
}

processAutopilotPullRequestStep.maxRetries = 0;

export async function completeAutopilotPullRequestStep(
  deliveryId: string,
  runId: string
) {
  "use step";
  await completeGitHubMentionDelivery(
    `${AUTOPILOT_GITHUB_DELIVERY_PREFIX}${deliveryId}`,
    runId
  );
}
