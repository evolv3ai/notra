import { isDemoMode } from "@notra/utils/demo-mode";

import { assertOrganizationAccess } from "@/lib/auth/organization";
import type { User } from "@/types/auth/organization";
import type { ParsedChatChannel } from "@/types/realtime/channel";
import { parseDiscussionChannel } from "@/utils/comment-channel";
import { assertDiscussionTarget } from "@/utils/discussion-access";

const CHAT_CHANNEL_PREFIX = "chat";
const DEMO_CHANNEL_PATTERN = /^demo:([^:*?\s]+)$/;
const GEO_LIVE_CHANNEL_PATTERN = /^geo:([^:*?\s]+)$/;
const SITES_LIVE_CHANNEL_PATTERN = /^sites:([^:*?\s]+)$/;
const CHAT_CHANNEL_SEGMENT_COUNT = 4;
const FORBIDDEN_CHANNEL_CHARS = /[*?\s]/;

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseChatChannel(channel: string): ParsedChatChannel | null {
  if (!channel || FORBIDDEN_CHANNEL_CHARS.test(channel)) {
    return null;
  }

  const parts = channel.split(":");
  if (parts.length !== CHAT_CHANNEL_SEGMENT_COUNT) {
    return null;
  }

  const [prefix, organizationId, chatId, streamId] = parts;
  if (prefix !== CHAT_CHANNEL_PREFIX) {
    return null;
  }
  if (!(organizationId && chatId && streamId)) {
    return null;
  }

  return { organizationId, chatId, streamId };
}

export async function authorizeRealtimeChannels({
  headers,
  channels,
  user,
}: {
  headers: Headers;
  channels: string[];
  user: User;
}): Promise<Response | undefined> {
  if (channels.length === 0) {
    return jsonResponse(400, { error: "No channels requested" });
  }

  const authorizedOrganizationIds = new Set<string>();

  for (const channel of channels) {
    const discussion = parseDiscussionChannel(channel);
    let parsed = parseChatChannel(channel);
    if (discussion) {
      parsed = {
        organizationId: discussion.organizationId,
        chatId: discussion.targetId,
        streamId: discussion.targetType,
      };
    }
    const demo = isDemoMode() ? DEMO_CHANNEL_PATTERN.exec(channel) : null;
    if (demo?.[1]) {
      parsed = { organizationId: demo[1], chatId: "demo", streamId: "demo" };
    }
    const geo = GEO_LIVE_CHANNEL_PATTERN.exec(channel);
    if (geo?.[1]) {
      parsed = { organizationId: geo[1], chatId: "geo", streamId: "geo" };
    }
    const sitesLive = SITES_LIVE_CHANNEL_PATTERN.exec(channel);
    if (sitesLive?.[1]) {
      parsed = {
        organizationId: sitesLive[1],
        chatId: "sites",
        streamId: "sites",
      };
    }
    if (!parsed) {
      return jsonResponse(403, { error: "Forbidden channel" });
    }

    try {
      if (!authorizedOrganizationIds.has(parsed.organizationId)) {
        await assertOrganizationAccess({
          headers,
          organizationId: parsed.organizationId,
          user,
        });
      }
      if (discussion) {
        await assertDiscussionTarget(discussion);
      }
    } catch {
      return jsonResponse(403, { error: "Forbidden channel" });
    }

    authorizedOrganizationIds.add(parsed.organizationId);
  }

  return undefined;
}
