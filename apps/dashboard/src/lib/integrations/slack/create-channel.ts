import { slackCreateChannelResponseSchema } from "@notra/schemas/dashboard/slack-integration";

import {
  badRequest,
  conflict,
  forbidden,
  internalServerError,
} from "@/lib/orpc/utils/errors";

/** A bot-created public channel already includes Notra as a member. */
export async function createSlackChannel(token: string, name: string) {
  const response = await fetch("https://slack.com/api/conversations.create", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ name, is_private: false }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw internalServerError("Could not create the Slack channel. Try again.");
  }
  const parsed = slackCreateChannelResponseSchema.safeParse(
    await response.json()
  );
  if (!parsed.success) {
    throw internalServerError("Could not create the Slack channel. Try again.");
  }
  if (!parsed.data.ok) {
    if (parsed.data.error === "missing_scope") {
      throw forbidden("Reconnect Slack to allow Notra to create channels.", {
        slackReconnectRequired: true,
      });
    }
    if (parsed.data.error === "name_taken") {
      throw conflict(
        "This channel name is already taken. Choose the existing channel or use another name."
      );
    }
    if (
      [
        "restricted_action",
        "restricted_action_read_only_channel",
        "not_allowed",
        "no_permission",
      ].includes(parsed.data.error ?? "")
    ) {
      throw forbidden(
        "Your Slack workspace does not allow Notra to create channels. Ask a workspace admin or choose an existing channel."
      );
    }
    throw badRequest(
      "Could not create the Slack channel. Choose another name or an existing channel."
    );
  }
  if (!parsed.data.channel) {
    throw internalServerError(
      "Slack did not return the new channel. Refresh the channel list before trying again."
    );
  }
  return {
    id: parsed.data.channel.id,
    name: parsed.data.channel.name,
    isPrivate: false,
    memberCount: 1,
  };
}
