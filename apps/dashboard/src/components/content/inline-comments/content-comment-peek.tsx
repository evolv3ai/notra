"use client";

import { useTranslations } from "use-intl";

import { CommentTimestamp } from "@/components/comments/comment-timestamp";
import { ContentCommentAvatar } from "@/components/content/inline-comments/content-comment-avatar";
import type { ContentCommentPeekProps } from "@/types/content/inline-comments";

/** Hover preview of a thread; clicking opens the full thread. */
export function ContentCommentPeek({
  comment,
  replyCount,
  onOpen,
}: ContentCommentPeekProps) {
  const t = useTranslations("content.comments");
  return (
    <button
      aria-label={t("peekOpen")}
      className="hover:bg-muted/40 focus-visible:ring-ring/50 flex w-full cursor-pointer flex-col gap-1.5 rounded-xl p-3 text-left transition-colors outline-none focus-visible:ring-2 motion-reduce:transition-none"
      data-comment-thread={comment.id}
      onClick={onOpen}
      type="button"
    >
      <span className="flex min-w-0 items-center gap-2">
        <ContentCommentAvatar image={comment.image} name={comment.name} />
        <span className="min-w-0 truncate text-sm font-medium">
          {comment.name}
        </span>
        <span className="text-muted-foreground shrink-0 text-xs">
          <CommentTimestamp createdAt={comment.createdAt} />
        </span>
      </span>
      <span className="line-clamp-3 text-sm leading-5 text-pretty">
        {comment.body}
      </span>
      {replyCount > 0 ? (
        <span className="text-muted-foreground text-xs">
          {t("peekReplies", { count: replyCount })}
        </span>
      ) : null}
    </button>
  );
}
