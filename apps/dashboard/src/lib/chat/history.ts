import {
  getActiveChatStream,
  getChatHistorySnapshot,
  getLastResponseStopped,
} from "@notra/ai/chat/history";
import { hydrateSavedChatPosts } from "@notra/ai/chat/posts";
import type { ChatUIMessage } from "@notra/ai/types/chat";

import {
  getSlackThreadPermalink,
  parseSlackExternalChannelKey,
} from "@/lib/slack/relay";

/** Returns null when the chat was deleted. */
export async function loadChatHistoryPayload(
  organizationId: string,
  chatId: string
) {
  const [snapshot, lastResponseStopped, activeStreamId] = await Promise.all([
    getChatHistorySnapshot<ChatUIMessage>(organizationId, chatId),
    getLastResponseStopped(organizationId, chatId),
    getActiveChatStream(organizationId, chatId),
  ]);
  if (!snapshot) {
    return null;
  }
  const { messages, externalChannelId } = snapshot;
  const target =
    externalChannelId?.source === "slack" && externalChannelId.id
      ? parseSlackExternalChannelKey(externalChannelId.id)
      : null;
  const [hydratedMessages, slackThreadUrl] = await Promise.all([
    hydrateSavedChatPosts(organizationId, chatId, messages),
    target ? getSlackThreadPermalink(target, organizationId) : null,
  ]);

  return {
    chatId,
    messages: hydratedMessages,
    lastResponseStopped,
    activeStreamId,
    externalChannelId,
    slackThreadUrl,
  };
}
