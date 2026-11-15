"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import { useEffect, useEffectEvent } from "react";

import { useContentComments } from "@/components/content/inline-comments/content-comments-provider";
import {
  CONTENT_COMMENT_ACTIVE_HIGHLIGHT_NAME,
  CONTENT_COMMENT_DRAFT_HIGHLIGHT_NAME,
  CONTENT_COMMENT_HIGHLIGHT_NAME,
  CONTENT_COMMENT_HIGHLIGHT_NAMES,
  CARET_NAVIGATION_KEYS,
} from "@/constants/comments";
import type { CommentAnchorMatch } from "@/types/content/inline-comments";
import {
  captureSelectionCommentAnchor,
  collectCommentTextNodes,
  commentTextContent,
  commentTextOffset,
  createCommentRange,
  resolveCommentAnchor,
} from "@/utils/comment-anchor";

function clearHighlights() {
  if (typeof CSS === "undefined" || !("highlights" in CSS)) {
    return;
  }
  for (const name of CONTENT_COMMENT_HIGHLIGHT_NAMES) {
    CSS.highlights.delete(name);
  }
}

function setHighlight(name: string, ranges: Range[]) {
  if (
    typeof CSS === "undefined" ||
    !("highlights" in CSS) ||
    typeof Highlight === "undefined"
  ) {
    return;
  }
  if (ranges.length) {
    CSS.highlights.set(name, new Highlight(...ranges));
  } else {
    CSS.highlights.delete(name);
  }
}

const containsOffset = (match: CommentAnchorMatch | null, offset: number) =>
  Boolean(match && match.start <= offset && offset <= match.end);

export function CommentAnchorsPlugin() {
  const [editor] = useLexicalComposerContext();
  const comments = useContentComments();
  const enabled = comments?.enabled ?? false;
  const anchorsKey = (comments?.threads ?? [])
    .map(({ comment }) => `${comment.id}:${JSON.stringify(comment.anchor)}`)
    .join("|");
  const draftKey = comments?.draft ? JSON.stringify(comments.draft.quote) : "";
  const showDraft = Boolean(
    comments?.composerOpen || comments?.draft?.body.trim()
  );
  const activeThreadId = comments?.activeThreadId ?? null;

  const sync = useEffectEvent(() => {
    const root = editor.getRootElement();
    if (!(comments && root)) {
      clearHighlights();
      return;
    }
    const nodes = collectCommentTextNodes(root);
    const text = commentTextContent(nodes);
    const threadMatches = new Map<string, CommentAnchorMatch | null>();
    const ranges: Range[] = [];
    const activeRanges: Range[] = [];
    for (const { comment } of comments.threads) {
      const match = comment.anchor
        ? resolveCommentAnchor(text, comment.anchor)
        : null;
      threadMatches.set(comment.id, match);
      const range = match ? createCommentRange(root, match, nodes) : null;
      if (range) {
        (comment.id === comments.activeThreadId ? activeRanges : ranges).push(
          range
        );
      }
    }
    const draftMatch = comments.draft
      ? resolveCommentAnchor(text, comments.draft.quote)
      : null;
    const draftRange =
      draftMatch && showDraft
        ? createCommentRange(root, draftMatch, nodes)
        : null;
    setHighlight(CONTENT_COMMENT_HIGHLIGHT_NAME, ranges);
    setHighlight(CONTENT_COMMENT_ACTIVE_HIGHLIGHT_NAME, activeRanges);
    setHighlight(
      CONTENT_COMMENT_DRAFT_HIGHLIGHT_NAME,
      draftRange ? [draftRange] : []
    );
    comments.setMatches(threadMatches, draftMatch);
  });

  const startFromSelection = useEffectEvent(() => {
    const root = editor.getRootElement();
    if (!(comments && root) || comments.blockedReason) {
      return false;
    }
    const quote = captureSelectionCommentAnchor<Node>(
      root,
      root.ownerDocument.getSelection()
    );
    if (quote) {
      comments.startComment(quote);
      return true;
    }
    if (comments.draft) {
      comments.reopenComposer();
      return true;
    }
    return false;
  });

  const activateAtCaret = useEffectEvent(() => {
    const root = editor.getRootElement();
    const selection = root?.ownerDocument.getSelection();
    if (!(comments && root && selection?.isCollapsed && selection.focusNode)) {
      return;
    }
    const offset = commentTextOffset(
      root,
      selection.focusNode,
      selection.focusOffset
    );
    if (offset === null) {
      return;
    }
    const thread = comments.threads.find(({ match }) =>
      containsOffset(match, offset)
    );
    if (thread) {
      comments.activateThread(thread.comment.id);
      return;
    }
    if (comments.draft && containsOffset(comments.draftMatch, offset)) {
      comments.reopenComposer();
      return;
    }
    if (comments.activeThreadId) {
      comments.activateThread(null);
    }
  });

  const setRoot = useEffectEvent((root: HTMLElement | null) => {
    comments?.setEditorRoot(root);
  });

  useEffect(() => {
    if (!enabled) {
      clearHighlights();
      return;
    }
    const onClick = () => activateAtCaret();
    const onKeyUp = (event: KeyboardEvent) => {
      if (CARET_NAVIGATION_KEYS.has(event.key)) {
        activateAtCaret();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.code !== "KeyM" ||
        !event.altKey ||
        event.shiftKey ||
        !(event.metaKey || event.ctrlKey) ||
        event.isComposing
      ) {
        return;
      }
      if (startFromSelection()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    let root: HTMLElement | null = null;
    let frame = 0;
    const unregister = mergeRegister(
      editor.registerRootListener((next, previous) => {
        previous?.removeEventListener("click", onClick);
        previous?.removeEventListener("keydown", onKeyDown);
        previous?.removeEventListener("keyup", onKeyUp);
        next?.addEventListener("click", onClick);
        next?.addEventListener("keydown", onKeyDown);
        next?.addEventListener("keyup", onKeyUp);
        root = next;
        setRoot(next);
        sync();
      }),
      editor.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
        if (dirtyElements.size === 0 && dirtyLeaves.size === 0) {
          return;
        }
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(sync);
      })
    );
    return () => {
      cancelAnimationFrame(frame);
      unregister();
      root?.removeEventListener("click", onClick);
      root?.removeEventListener("keydown", onKeyDown);
      root?.removeEventListener("keyup", onKeyUp);
      setRoot(null);
      clearHighlights();
    };
  }, [editor, enabled]);

  useEffect(() => {
    if (enabled) {
      sync();
    }
  }, [enabled, anchorsKey, draftKey, showDraft, activeThreadId]);

  return null;
}
