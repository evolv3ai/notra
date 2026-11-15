import { generateChatId, getChatHistorySnapshot } from "@notra/ai/chat/history";
import { hydrateSavedChatPosts } from "@notra/ai/chat/posts";
import type { ChatUIMessage } from "@notra/ai/types/chat";
import { db } from "@notra/db/drizzle";
import { chatSessions, chatShares, organizations } from "@notra/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

import { CHAT_SHARE_ID_LENGTH } from "@/constants/chat-share";
import type { ChatShareSummary, PublicChatShare } from "@/types/chat-share";
import {
  buildChatShareSnapshot,
  chatShareSnapshotToMessages,
} from "@/utils/chat-share-snapshot";

const shareSummaryColumns = {
  shareId: chatShares.id,
  messageCount: sql<number>`jsonb_array_length(${chatShares.messages})::int`,
  createdAt: chatShares.createdAt,
  updatedAt: chatShares.updatedAt,
};

function toSummary(row: {
  shareId: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}): ChatShareSummary {
  return {
    shareId: row.shareId,
    messageCount: row.messageCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getActiveChatShare(
  organizationId: string,
  chatId: string
): Promise<ChatShareSummary | null> {
  const [row] = await db
    .select(shareSummaryColumns)
    .from(chatShares)
    .where(
      and(
        eq(chatShares.organizationId, organizationId),
        eq(chatShares.chatId, chatId),
        isNull(chatShares.revokedAt)
      )
    )
    .limit(1);
  return row ? toSummary(row) : null;
}

/**
 * Creates the chat's public link, or refreshes its snapshot when one is
 * already active so the URL people already have keeps working.
 */
export async function publishChatShare({
  organizationId,
  chatId,
  userId,
}: {
  organizationId: string;
  chatId: string;
  userId: string;
}): Promise<ChatShareSummary | null> {
  const [history, [session]] = await Promise.all([
    getChatHistorySnapshot<ChatUIMessage>(organizationId, chatId),
    db
      .select({ title: chatSessions.title })
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.id, chatId),
          eq(chatSessions.organizationId, organizationId),
          isNull(chatSessions.contentId),
          isNull(chatSessions.deletedAt)
        )
      )
      .limit(1),
  ]);
  if (!(history && session)) {
    return null;
  }
  const messages = buildChatShareSnapshot(
    await hydrateSavedChatPosts(organizationId, chatId, history.messages)
  );
  const [row] = await db
    .insert(chatShares)
    .values({
      id: nanoid(CHAT_SHARE_ID_LENGTH),
      organizationId,
      chatId,
      createdByUserId: userId,
      title: session.title,
      messages,
    })
    .onConflictDoUpdate({
      target: chatShares.chatId,
      targetWhere: isNull(chatShares.revokedAt),
      set: { title: session.title, messages, updatedAt: new Date() },
    })
    .returning(shareSummaryColumns);
  return row ? toSummary(row) : null;
}

export async function revokeChatShare(
  organizationId: string,
  chatId: string
): Promise<boolean> {
  const rows = await db
    .update(chatShares)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(chatShares.organizationId, organizationId),
        eq(chatShares.chatId, chatId),
        isNull(chatShares.revokedAt)
      )
    )
    .returning({ id: chatShares.id });
  return rows.length > 0;
}

/** Null for unknown or revoked links and for chats deleted since sharing. */
export async function getPublicChatShare(
  shareId: string
): Promise<PublicChatShare | null> {
  const [row] = await db
    .select({
      title: chatShares.title,
      messages: chatShares.messages,
      updatedAt: chatShares.updatedAt,
      organizationName: organizations.name,
    })
    .from(chatShares)
    .innerJoin(chatSessions, eq(chatSessions.id, chatShares.chatId))
    .innerJoin(organizations, eq(organizations.id, chatShares.organizationId))
    .where(
      and(
        eq(chatShares.id, shareId),
        isNull(chatShares.revokedAt),
        isNull(chatSessions.deletedAt)
      )
    )
    .limit(1);
  if (!row) {
    return null;
  }
  return {
    shareId,
    title: row.title,
    messages: row.messages,
    sharedAt: row.updatedAt.toISOString(),
    organizationName: row.organizationName,
  };
}

/**
 * Copies a shared chat into the reader's organization as a new chat they own,
 * so they can keep talking to it. Null when the link is gone.
 */
export async function forkChatShare({
  shareId,
  organizationId,
}: {
  shareId: string;
  organizationId: string;
}): Promise<{ chatId: string } | null> {
  const share = await getPublicChatShare(shareId);
  if (!share) {
    return null;
  }
  const messages = chatShareSnapshotToMessages(share.messages);
  if (messages.length === 0) {
    return null;
  }
  const chatId = generateChatId();
  await db.insert(chatSessions).values({
    id: chatId,
    organizationId,
    title: share.title,
    messages,
  });
  return { chatId };
}
