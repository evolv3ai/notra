import type { DiscussionCommentAnchor } from "@notra/db/types/discussion-comments";
import type { ReactNode, RefObject } from "react";

import type { ContentDetailDocument } from "@/lib/hooks/use-content-detail-document";
import type { useDiscussion } from "@/lib/hooks/use-discussion";
import type { CommentItemProps, DiscussionComment } from "@/types/comments";

export type CommentAnchorQuote = Omit<DiscussionCommentAnchor, "revision">;

export interface CommentAnchorMatch {
  start: number;
  end: number;
}

export interface CommentAnchorTextNode {
  nodeType: number;
  nodeValue: string | null;
  childNodes: ArrayLike<CommentAnchorTextNode>;
  getAttribute?: (name: string) => string | null;
}

export interface CommentAnchorTextPoint<T> {
  node: T;
  offset: number;
}

export interface ContentCommentDraft {
  quote: CommentAnchorQuote;
  body: string;
}

export interface ContentCommentThread {
  comment: DiscussionComment;
  match: CommentAnchorMatch | null;
  matchPending: boolean;
}

export interface ContentCommentsProviderProps {
  children: ReactNode;
  organizationId: string;
  contentId: string;
  document: ContentDetailDocument;
  enabled: boolean;
}

export interface ContentCommentsContextValue {
  enabled: boolean;
  blockedReason: string | null;
  discussion: ReturnType<typeof useDiscussion>;
  threads: ContentCommentThread[];
  draft: ContentCommentDraft | null;
  draftMatch: CommentAnchorMatch | null;
  composerOpen: boolean;
  submitting: boolean;
  submitError: string | null;
  activeThreadId: string | null;
  focusRequest: string | null;
  replyDrafts: Record<string, string>;
  editorRoot: HTMLElement | null;
  matchesKey: string;
  setEditorRoot: (root: HTMLElement | null) => void;
  setMatches: (
    threads: Map<string, CommentAnchorMatch | null>,
    draft: CommentAnchorMatch | null
  ) => void;
  startComment: (quote: CommentAnchorQuote) => void;
  reopenComposer: () => void;
  setDraftBody: (body: string) => void;
  closeComposer: () => void;
  submitDraft: () => Promise<void>;
  setReplyDraft: (threadId: string, body: string) => void;
  activateThread: (threadId: string | null) => void;
  clearFocusRequest: () => void;
}

export interface ContentCommentThreadCardProps {
  thread: ContentCommentThread;
}

export interface ContentCommentFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  canSubmit: boolean;
  busy: boolean;
  readOnly?: boolean;
  label: string;
  placeholder: string;
  sendLabel: string;
  error?: string | null;
  nudge?: ReactNode;
  textarea: RefObject<HTMLTextAreaElement | null>;
  onFocus?: () => void;
  className?: string;
  /** Shown before the input, e.g. the author's avatar on a new comment. */
  leading?: ReactNode;
}

export interface ContentCommentPeekProps {
  comment: DiscussionComment;
  replyCount: number;
  onOpen: () => void;
}

export type ContentCommentConnector = "middle" | "last";

export type ContentInlineCommentProps = CommentItemProps & {
  replies?: ReactNode;
  hasReplies?: boolean;
  /** Draws the line from the parent's avatar to this reply. */
  connector?: ContentCommentConnector;
};

export interface ContentCommentEntryProps {
  comment: DiscussionComment;
  entries: DiscussionComment[];
  itemProps: Omit<CommentItemProps, "comment">;
  connector?: ContentCommentConnector;
}

export interface ContentCommentReplyFormProps {
  comments: ContentCommentsContextValue;
  comment: DiscussionComment;
  entries: DiscussionComment[];
  replyTo: DiscussionComment | null;
  onClearReply: () => void;
  textarea: RefObject<HTMLTextAreaElement | null>;
}

export type ContentInlineCommentReactionsProps = Pick<
  CommentItemProps,
  "comment" | "currentUserId" | "onReact"
> & { disabled: boolean };

export interface ContentCommentAvatarProps {
  name: string;
  image: string | null;
}

export interface ContentCommentsGutterProps {
  children: ReactNode;
}

export interface ContentCommentsLayerProps {
  container: RefObject<HTMLDivElement | null>;
}

export interface ContentCommentRailLayout {
  id: string;
  top: number;
}

export interface CommentSelectionLike<T> {
  anchorNode: T | null;
  anchorOffset: number;
  focusNode: T | null;
  focusOffset: number;
}
