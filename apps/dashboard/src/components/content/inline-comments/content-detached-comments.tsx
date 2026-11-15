"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "use-intl";

import { ContentCommentThreadCard } from "@/components/content/inline-comments/content-comment-thread-card";
import { useContentComments } from "@/components/content/inline-comments/content-comments-provider";

export function ContentDetachedComments() {
  const comments = useContentComments();
  const t = useTranslations("content.comments");
  const container = useRef<HTMLElement>(null);
  const detached =
    comments?.threads.filter(
      (thread) => !thread.matchPending && !thread.match
    ) ?? [];

  useEffect(() => {
    const request = comments?.focusRequest;
    if (!request) {
      return;
    }
    const target = container.current?.querySelector<HTMLElement>(
      `[data-comment-thread="${CSS.escape(request)}"]`
    );
    if (target) {
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "nearest", behavior: "instant" });
      comments.clearFocusRequest();
    }
  }, [comments]);

  if (!comments?.enabled || detached.length === 0) {
    return null;
  }
  return (
    <section
      aria-label={t("detachedThreads")}
      className="space-y-2"
      ref={container}
    >
      <h3 className="text-muted-foreground text-sm font-medium">
        {t("detachedThreads")}
      </h3>
      {detached.map((thread) => (
        <ContentCommentThreadCard key={thread.comment.id} thread={thread} />
      ))}
    </section>
  );
}
