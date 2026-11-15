import type {
  CHAT_ATTACHMENT_SIZE_BUCKETS,
  CHAT_CONTEXT_KINDS,
  CHAT_DRAFT_ACTIONS,
  CHAT_TOOL_APPROVAL_DECISIONS,
  COMMAND_PALETTE_OPEN_SOURCES,
  CONTENT_CREATE_ENTRIES,
} from "@/constants/studio-analytics";

export type ContentCreateEntry = (typeof CONTENT_CREATE_ENTRIES)[number];

export type ChatAttachmentSizeBucket =
  (typeof CHAT_ATTACHMENT_SIZE_BUCKETS)[number];

export type ChatContextKind = (typeof CHAT_CONTEXT_KINDS)[number];
export type ChatDraftAction = (typeof CHAT_DRAFT_ACTIONS)[number];

export type ChatToolApprovalDecision =
  (typeof CHAT_TOOL_APPROVAL_DECISIONS)[number];

export type CommandPaletteOpenSource =
  (typeof COMMAND_PALETTE_OPEN_SOURCES)[number];

export interface ContentDataPointFlags {
  includePullRequests: boolean;
  includeCommits: boolean;
  includeReleases: boolean;
  includeLinearData: boolean;
}

interface MessagePartLike {
  type: string;
}

export interface MessageLike {
  parts?: readonly MessagePartLike[];
}
