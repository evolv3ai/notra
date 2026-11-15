"use client";

import { cn } from "@notra/ui/lib/utils";
import { useEffect, useState } from "react";

import { useContentComments } from "@/components/content/inline-comments/content-comments-provider";
import type { ContentCommentsGutterProps } from "@/types/content/inline-comments";

/**
 * Moves the document left to make room for the comment rail once a thread is
 * anchored. The padding grows 1:1 with the viewport between 50rem and 72rem,
 * so the document stands still while a side panel resizes the editor instead
 * of re-centering and then sliding back when the rail fits again.
 */
export function ContentCommentsGutter({
  children,
}: ContentCommentsGutterProps) {
  const comments = useContentComments();
  const hasAnchoredThreads = Boolean(
    comments?.enabled && comments.threads.some((thread) => thread.match)
  );
  // Only the rail appearing or leaving animates; width changes follow the
  // viewport directly, a transition there would trail the panel and overshoot.
  // The transition is switched on in the same render as the padding change,
  // so both land in one commit.
  const [previous, setPrevious] = useState(hasAnchoredThreads);
  const [animating, setAnimating] = useState(false);
  if (previous !== hasAnchoredThreads) {
    setPrevious(hasAnchoredThreads);
    setAnimating(true);
  }
  useEffect(() => {
    if (!animating) {
      return;
    }
    const timer = window.setTimeout(() => setAnimating(false), 400);
    return () => window.clearTimeout(timer);
  }, [animating, hasAnchoredThreads]);
  return (
    <div
      className={cn(
        animating &&
          "duration-normal ease-emphasized transition-[padding] motion-reduce:transition-none",
        hasAnchoredThreads && "pr-[clamp(0rem,100cqw_-_50rem,22rem)]"
      )}
    >
      {children}
    </div>
  );
}
