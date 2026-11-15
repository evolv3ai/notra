import type { SharedChatMessage } from "@notra/db/types/chat-shares";

export interface ChatShareSummary {
  shareId: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicChatShare {
  shareId: string;
  title: string;
  messages: SharedChatMessage[];
  sharedAt: string;
  organizationName: string;
}

export type ChatShareAccess = "team" | "public";

export interface SharedChatContinueProps {
  shareId: string;
}
