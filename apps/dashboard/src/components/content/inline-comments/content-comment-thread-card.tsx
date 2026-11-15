"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Composer } from "@notra/ui/components/ui/composer";
import { cn } from "@notra/ui/lib/utils";
import { useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { ContentCommentField } from "@/components/content/inline-comments/content-comment-field";
import { useContentComments } from "@/components/content/inline-comments/content-comments-provider";
import { ContentInlineComment } from "@/components/content/inline-comments/content-inline-comment";
import type { DiscussionComment } from "@/types/comments";
import type {
  ContentCommentConnector,
  ContentCommentEntryProps,
  ContentCommentReplyFormProps,
  ContentCommentThreadCardProps,
} from "@/types/content/inline-comments";
import {
  getContentCommentReplyParent,
  getContentCommentThreadEntries,
} from "@/utils/content-comment-thread";

export function ContentCommentThreadCard({
  thread,
}: ContentCommentThreadCardProps) {
  const t = useTranslations("content.comments");
  const comments = useContentComments();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [replyTo, setReplyTo] = useState<DiscussionComment | null>(null);
  if (!comments) {
    return null;
  }
  const { activeThreadId, discussion } = comments;
  const { comment, match } = thread;
  const active = activeThreadId === comment.id;
  const entries = getContentCommentThreadEntries(discussion.items, comment.id);

  return (
    <article
      aria-label={t("threadLabel", { name: comment.name })}
      className={cn(
        "bg-background text-foreground focus-visible:ring-ring/50 w-full min-w-0 rounded-xl border p-3 pb-2.5 shadow-xs transition-shadow outline-none focus-visible:ring-2 motion-reduce:transition-none",
        active && "shadow-md"
      )}
      data-comment-thread={comment.id}
      tabIndex={-1}
    >
      {comment.anchor && !match ? (
        <p className="text-muted-foreground pb-1 text-xs">
          {t("textNotFound")}
        </p>
      ) : null}
      <ol>
        <ContentCommentEntry
          comment={comment}
          entries={entries}
          itemProps={{
            busy: discussion.busy,
            comments: discussion.items,
            currentUserId: discussion.user?.id ?? "",
            onDelete: discussion.deleteComment,
            onEdit: discussion.editComment,
            onReact: discussion.reactToComment,
            onReply: (item) => {
              setReplyTo(item);
              textarea.current?.focus();
            },
            onResolve: discussion.resolveComment,
          }}
        />
      </ol>
      <ContentCommentReplyForm
        comments={comments}
        comment={comment}
        entries={entries}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        textarea={textarea}
      />
    </article>
  );
}

function ContentCommentEntry({
  comment,
  entries,
  itemProps,
  connector,
}: ContentCommentEntryProps) {
  const children = entries.filter(
    (entry) =>
      entry.parentId === comment.id &&
      (!entry.deletedAt || entries.some((item) => item.parentId === entry.id))
  );
  const connected = Boolean(comment.parentId || !comment.deletedAt);
  const connectorAt = (index: number): ContentCommentConnector =>
    index === children.length - 1 ? "last" : "middle";
  return (
    <ContentInlineComment
      {...itemProps}
      comment={comment}
      connector={connector}
      hasReplies={children.length > 0}
      replies={
        children.length > 0 ? (
          <ol className={cn(connected && "ml-8.5")}>
            {children.map((child, index) => (
              <ContentCommentEntry
                comment={child}
                connector={connected ? connectorAt(index) : undefined}
                entries={entries}
                itemProps={itemProps}
                key={child.id}
              />
            ))}
          </ol>
        ) : null
      }
    />
  );
}

function useContentCommentReply({
  comments,
  comment,
  entries,
  replyTo,
  onClearReply,
}: Pick<
  ContentCommentReplyFormProps,
  "comments" | "comment" | "entries" | "replyTo" | "onClearReply"
>) {
  const t = useTranslations("content.comments");
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyError, setReplyError] = useState(false);
  const { discussion, replyDrafts } = comments;
  const draft = replyDrafts[comment.id] ?? "";
  const replyParent = getContentCommentReplyParent(entries, replyTo?.id);
  const canReply = Boolean(
    replyParent &&
    draft.trim() &&
    discussion.user &&
    !discussion.busy &&
    !comment.pending &&
    !comments.blockedReason
  );
  const error =
    comments.blockedReason ?? (replyError ? t("replyFailed") : null);
  const submit = () => {
    if (!canReply || !replyParent || submittingRef.current) {
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setReplyError(false);
    return discussion
      .createComment(draft.trim(), replyParent)
      .then((created) => {
        if (created) {
          comments.setReplyDraft(comment.id, "");
          onClearReply();
        } else {
          setReplyError(true);
        }
      })
      .catch(() => setReplyError(true))
      .finally(() => {
        submittingRef.current = false;
        setSubmitting(false);
      });
  };
  return { draft, canReply, error, submit, submitting };
}

function ContentCommentReplyForm(props: ContentCommentReplyFormProps) {
  const { comments, comment, replyTo, onClearReply, textarea } = props;
  const tComments = useTranslations("comments");
  const { discussion, activateThread } = comments;
  const { draft, canReply, error, submit, submitting } =
    useContentCommentReply(props);

  return (
    <ContentCommentField
      busy={submitting}
      canSubmit={canReply}
      className="mt-1.5"
      error={error}
      label={tComments("replyTo", { name: replyTo?.name ?? comment.name })}
      nudge={
        replyTo && replyTo.id !== comment.id ? (
          <Composer.Nudge
            action={
              <Button
                aria-label={tComments("cancelReply")}
                onClick={() => {
                  onClearReply();
                  textarea.current?.focus();
                }}
                size="icon-sm"
                variant="ghost"
              >
                <HugeiconsIcon className="size-3" icon={Cancel01Icon} />
              </Button>
            }
            title={tComments("replyingTo", { name: replyTo.name })}
          />
        ) : null
      }
      onChange={(value) => comments.setReplyDraft(comment.id, value)}
      onFocus={() => {
        if (
          comments.activeThreadId !== comment.id &&
          comment.anchor &&
          !comment.resolvedAt
        ) {
          activateThread(comment.id);
        }
      }}
      onSubmit={() => {
        void submit();
      }}
      placeholder={tComments("writeReplyPlaceholder")}
      readOnly={submitting || Boolean(comment.pending)}
      sendLabel={tComments("send")}
      textarea={textarea}
      value={draft}
    />
  );
}
