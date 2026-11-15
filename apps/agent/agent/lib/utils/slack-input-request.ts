import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { posts } from "@notra/db/schema";
import {
  getLinkedTwitterAccounts,
  isTwitterPublishConfigured,
} from "@notra/tools/utils/social-accounts";
import { and, eq } from "drizzle-orm";
import type {
  SlackEventContext,
  SlackInputRequestedDefaultDeliver,
  SlackPostInput,
} from "eve/channels/slack";
import type { InputRequest, InputRequestedStreamEvent } from "eve/client";

import { POST_TO_X_CONFIRM_ACTION_PREFIX } from "../constants/slack-post-x";
import { resolveSlackInstallation } from "./slack-installation";
import { savePendingPostToX } from "./slack-post-x";

async function createTwitterDraftPost(
  markdown: string,
  callId: string,
  channel: SlackEventContext,
  request?: InputRequest
): Promise<SlackPostInput> {
  const linkedAccount = await resolveLinkedTwitterAccount(
    channel,
    markdown,
    callId
  );
  const text = (value: string) => ({
    type: "plain_text" as const,
    text: value,
  });
  const actions: unknown[] = [];
  for (const [index, optionId, label] of [
    [0, "approve", "Save as draft"],
    [1, "deny", "Regenerate"],
  ] as const) {
    const option = request?.options?.find((item) => item.id === optionId);
    if (option) {
      actions.push({
        type: "button",
        action_id: `eve_input:tool-approval:${request?.requestId}:button:${index}`,
        text: text(label),
        value: option.id,
      });
    }
  }
  actions.push(
    linkedAccount
      ? {
          type: "button",
          action_id: `${POST_TO_X_CONFIRM_ACTION_PREFIX}:${callId}`,
          text: text(`Post to @${linkedAccount.username}`),
          value: JSON.stringify({
            ...(request ? { requestId: request.requestId } : {}),
            callId,
            username: linkedAccount.username,
          }),
        }
      : {
          type: "button",
          action_id: `notra_open_x:${callId}`,
          text: text("Open X composer"),
          url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(markdown)}`,
          value: "open_x",
        }
  );
  return {
    text: request ? "Tweet draft" : "Tweet saved as a draft",
    blocks: [
      {
        type: "section",
        text: text(request ? "Tweet draft" : "Tweet saved as a draft"),
      },
      { type: "actions", elements: actions },
    ],
  };
}

async function resolveLinkedTwitterAccount(
  channel: SlackEventContext,
  markdown: string,
  callId: string
) {
  if (!isTwitterPublishConfigured()) {
    return null;
  }
  const teamId = channel.state.installationTeamId;
  if (!teamId) {
    return null;
  }
  try {
    const installation = await resolveSlackInstallation(teamId);
    if (!installation) {
      return null;
    }
    const accounts = await getLinkedTwitterAccounts(
      installation.organizationId
    );
    const account = accounts.at(0);
    if (!account) {
      return null;
    }
    const stored = await savePendingPostToX(callId, {
      organizationId: installation.organizationId,
      accountId: account.id,
      username: account.username,
      text: markdown,
    });
    return stored ? account : null;
  } catch (error) {
    logError("[agent] Failed to resolve linked X account", error, {
      slackTeamId: teamId,
      callId,
    });
    return null;
  }
}

export async function offerSavedTweetPublishing(
  channel: SlackEventContext,
  organizationId: string,
  postId: string,
  callId: string
) {
  const post = await db.query.posts.findFirst({
    where: and(eq(posts.id, postId), eq(posts.organizationId, organizationId)),
    columns: { markdown: true },
  });
  if (!post?.markdown) {
    return;
  }
  await channel.thread.post(post.markdown);
  await channel.thread.post(
    await createTwitterDraftPost(post.markdown, callId, channel)
  );
}

export async function handleSlackInputRequested(
  data: InputRequestedStreamEvent["data"],
  channel: SlackEventContext,
  defaultDeliver: SlackInputRequestedDefaultDeliver
) {
  for (const request of data.requests) {
    const markdown = request.action.input.markdown;
    // Keep already-pending tweet approvals usable after deployment, without
    // embedding the draft in the message Slack echoes back on a button click.
    if (
      request.kind === "tool-approval" &&
      request.action.toolName === "create_twitter_post" &&
      typeof markdown === "string"
    ) {
      await channel.thread.post(markdown);
      await channel.thread.post(
        await createTwitterDraftPost(
          markdown,
          request.action.callId,
          channel,
          request
        )
      );
    } else {
      await defaultDeliver({ ...data, requests: [request] });
    }
  }
}
