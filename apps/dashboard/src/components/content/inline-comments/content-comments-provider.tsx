"use client";

import { createContext, use, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { useDiscussion } from "@/lib/hooks/use-discussion";
import type { DiscussionComment } from "@/types/comments";
import type {
  CommentAnchorMatch,
  CommentAnchorQuote,
  ContentCommentDraft,
  ContentCommentsContextValue,
  ContentCommentsProviderProps,
  ContentCommentThread,
} from "@/types/content/inline-comments";
import { refreshCommentAnchor } from "@/utils/comment-anchor";

const ContentCommentsContext =
  createContext<ContentCommentsContextValue | null>(null);

export function useContentComments() {
  return use(ContentCommentsContext);
}

function hasVisibleReplies(
  comment: DiscussionComment,
  items: DiscussionComment[]
): boolean {
  return items.some(
    (item) =>
      item.parentId === comment.id &&
      (!item.deletedAt || hasVisibleReplies(item, items))
  );
}

function matchesKey(
  matches: Map<string, CommentAnchorMatch | null>,
  draft: CommentAnchorMatch | null
) {
  const parts = [...matches].map(
    ([id, match]) => `${id}:${match ? `${match.start}-${match.end}` : "-"}`
  );
  return `${parts.join("|")}#${draft ? `${draft.start}-${draft.end}` : "-"}`;
}

export function ContentCommentsProvider({
  children,
  organizationId,
  contentId,
  document,
  enabled,
}: ContentCommentsProviderProps) {
  const t = useTranslations("content.comments");
  const discussion = useDiscussion(
    { organizationId, targetId: contentId, targetType: "content" },
    enabled
  );
  const [draft, setDraft] = useState<ContentCommentDraft | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [matches, setMatchesState] = useState<{
    key: string;
    threads: Map<string, CommentAnchorMatch | null>;
    draft: CommentAnchorMatch | null;
  }>({ key: "", threads: new Map(), draft: null });
  const [editorRoot, setEditorRootState] = useState<HTMLElement | null>(null);
  const editorRootRef = useRef<HTMLElement | null>(null);
  const documentRef = useRef(document);
  const draftRef = useRef(draft);
  const submittingRef = useRef(false);
  const activeRef = useRef(true);
  const enabledRef = useRef(enabled);

  useLayoutEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    documentRef.current = document;
    enabledRef.current = enabled;
  });

  const replaceDraft = (next: ContentCommentDraft | null) => {
    draftRef.current = next;
    setDraft(next);
  };

  const blockedReason = (() => {
    if (!enabled) {
      return t("unavailable");
    }
    if (document.hasSaveConflict) {
      return t("conflict");
    }
    return null;
  })();

  const anchored = discussion.items.filter(
    (item) =>
      item.anchor &&
      !item.parentId &&
      !item.resolvedAt &&
      (!item.deletedAt || hasVisibleReplies(item, discussion.items))
  );
  const threads: ContentCommentThread[] = anchored.map((comment) => {
    const match = matches.threads.get(comment.id) ?? null;
    return { comment, match, matchPending: !matches.threads.has(comment.id) };
  });

  const setEditorRoot = (root: HTMLElement | null) => {
    editorRootRef.current = root;
    setEditorRootState(root);
  };

  const setMatches = (
    threadMatches: Map<string, CommentAnchorMatch | null>,
    draftMatch: CommentAnchorMatch | null
  ) => {
    const key = matchesKey(threadMatches, draftMatch);
    setMatchesState((current) =>
      current.key === key
        ? current
        : { key, threads: threadMatches, draft: draftMatch }
    );
  };

  const startComment = (quote: CommentAnchorQuote) => {
    if (blockedReason) {
      return;
    }
    if (submittingRef.current) {
      return;
    }
    replaceDraft({ quote, body: draftRef.current?.body ?? "" });
    setSubmitError(null);
    setActiveThreadId(null);
    setComposerOpen(true);
  };

  const reopenComposer = () => {
    if (draftRef.current && !blockedReason) {
      setActiveThreadId(null);
      setComposerOpen(true);
    }
  };

  const closeComposer = () => {
    setComposerOpen(false);
    const current = draftRef.current;
    if (!submittingRef.current) {
      replaceDraft(current?.body.trim() ? current : null);
    }
  };

  const setDraftBody = (body: string) => {
    const current = draftRef.current;
    replaceDraft(current ? { ...current, body } : current);
  };

  const submitDraft = async () => {
    const current = draftRef.current;
    const body = current?.body.trim();
    if (!(current && body) || submittingRef.current) {
      return;
    }
    if (blockedReason) {
      setSubmitError(blockedReason);
      return;
    }
    if (documentRef.current.isSaving) {
      setSubmitError(t("saveFailed"));
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setComposerOpen(true);
    setSubmitError(null);
    return Promise.resolve()
      .then(async () => {
        const root = editorRootRef.current;
        const before = root ? refreshCommentAnchor(root, current.quote) : null;
        if (!before) {
          setSubmitError(t("selectionChanged"));
          return;
        }
        if (
          documentRef.current.hasChanges ||
          (documentRef.current.editedMarkdownRef.current ??
            documentRef.current.originalMarkdownRef.current) !==
            documentRef.current.originalMarkdownRef.current
        ) {
          const saved = await documentRef.current.handleSave({
            silent: true,
            syncGitHub: false,
          });
          if (!activeRef.current) {
            return;
          }
          if (!saved) {
            setSubmitError(t("saveFailed"));
            return;
          }
        }
        const latest = documentRef.current;
        if (!activeRef.current || !enabledRef.current) {
          return;
        }
        if (latest.hasSaveConflict) {
          setSubmitError(t("conflict"));
          return;
        }
        const revision = latest.baselineRevisionRef.current;
        const rootAfterSave = editorRootRef.current;
        const quote = rootAfterSave?.isConnected
          ? refreshCommentAnchor(rootAfterSave, before)
          : null;
        if (
          !quote ||
          draftRef.current?.quote !== current.quote ||
          revision === null ||
          (latest.editedMarkdownRef.current ??
            latest.originalMarkdownRef.current) !==
            latest.originalMarkdownRef.current
        ) {
          setSubmitError(t("selectionChanged"));
          return;
        }
        const created = await discussion.createComment(body, null, {
          ...quote,
          revision,
        });
        if (!activeRef.current) {
          return;
        }
        if (!created) {
          setSubmitError(t("submitFailed"));
          return;
        }
        if (draftRef.current === current) {
          replaceDraft(null);
          setComposerOpen(false);
          setActiveThreadId(created);
          setFocusRequest(created);
        }
      })
      .catch(() => {
        if (activeRef.current) {
          setSubmitError(t("submitFailed"));
          setComposerOpen(true);
        }
      })
      .finally(() => {
        submittingRef.current = false;
        if (activeRef.current) {
          setSubmitting(false);
        }
      });
  };

  const setReplyDraft = (threadId: string, body: string) => {
    setReplyDrafts((current) => ({ ...current, [threadId]: body }));
  };

  const activateThread = (threadId: string | null) => {
    setActiveThreadId(threadId);
    if (threadId) {
      setComposerOpen(false);
      const current = draftRef.current;
      if (!submittingRef.current) {
        replaceDraft(current?.body.trim() ? current : null);
      }
    }
  };

  const clearFocusRequest = () => {
    setFocusRequest(null);
  };

  const value: ContentCommentsContextValue = {
    enabled,
    blockedReason,
    discussion,
    threads,
    draft,
    draftMatch: matches.draft,
    composerOpen,
    submitting,
    submitError,
    activeThreadId,
    focusRequest,
    replyDrafts,
    editorRoot,
    matchesKey: matches.key,
    setEditorRoot,
    setMatches,
    startComment,
    reopenComposer,
    setDraftBody,
    closeComposer,
    submitDraft,
    setReplyDraft,
    activateThread,
    clearFocusRequest,
  };

  return (
    <ContentCommentsContext value={value}>{children}</ContentCommentsContext>
  );
}
