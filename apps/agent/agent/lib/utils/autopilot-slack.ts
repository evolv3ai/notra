import { AUTOPILOT_SLACK_ACTION_PATH } from "@notra/ai/constants/slack";
import { getBaseUrl } from "@notra/ai/qstash/triggers";
import { autopilotSlackActionRequestSchema } from "@notra/ai/schemas/autopilot-slack-action";
import { logError } from "@notra/ai/utils/server-log";
import type { SlackEvent, SlackEventEnvelope } from "eve/channels/slack";
import type { z } from "zod";

import {
  AUTOPILOT_SLACK_ACTION_TIMEOUT_MS,
  AUTOPILOT_VOTE_REACTIONS,
  SLACK_SKIN_TONE_SUFFIX,
} from "../constants/slack";

type AutopilotSlackAction = z.input<typeof autopilotSlackActionRequestSchema>;

/**
 * A 👍/👎 (any skin tone) by a person on one of this bot's messages. The
 * dashboard decides whether the message is an Autopilot item.
 */
export function parseAutopilotReaction(
  envelope: SlackEventEnvelope,
  event: SlackEvent
): AutopilotSlackAction | null {
  const item = event.item as {
    type?: unknown;
    channel?: unknown;
    ts?: unknown;
  };
  const botUserIds = new Set(
    (envelope.authorizations ?? []).map((auth) => auth.user_id)
  );
  const vote =
    typeof event.reaction === "string"
      ? AUTOPILOT_VOTE_REACTIONS[
          event.reaction.replace(SLACK_SKIN_TONE_SUFFIX, "")
        ]
      : undefined;
  if (
    event.type !== "reaction_added" ||
    !vote ||
    !envelope.team_id ||
    typeof event.user !== "string" ||
    botUserIds.has(event.user) ||
    !botUserIds.has(event.item_user as string) ||
    item?.type !== "message" ||
    typeof item.channel !== "string" ||
    typeof item.ts !== "string"
  ) {
    return null;
  }
  return {
    teamId: envelope.team_id,
    channelId: item.channel,
    userId: event.user,
    messageTs: item.ts,
    vote,
  };
}

/** Hands the action to the dashboard, which owns findings, GitHub and billing. */
export async function forwardAutopilotSlackAction(
  action: AutopilotSlackAction
) {
  const baseUrl = getBaseUrl();
  const secret = process.env.INTERNAL_WORKFLOW_SECRET?.trim();
  if (!(baseUrl && secret)) {
    logError("Autopilot Slack actions are not configured", null, {
      vote: action.vote,
    });
    return;
  }
  try {
    const response = await fetch(`${baseUrl}${AUTOPILOT_SLACK_ACTION_PATH}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(autopilotSlackActionRequestSchema.parse(action)),
      signal: AbortSignal.timeout(AUTOPILOT_SLACK_ACTION_TIMEOUT_MS),
    });
    if (!response.ok) {
      logError("Autopilot Slack action was rejected", null, {
        status: response.status,
        vote: action.vote,
      });
    }
  } catch (error) {
    logError("Autopilot Slack action failed", error, { vote: action.vote });
  }
}
