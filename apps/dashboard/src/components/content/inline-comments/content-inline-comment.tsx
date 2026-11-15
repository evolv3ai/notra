"use client";

import { Popover } from "@base-ui/react/popover";
import {
  ArrowTurnBackwardIcon,
  Tick02Icon,
  Undo02Icon,
  MoreHorizontalIcon,
  SmilePlusIcon,
  PencilEdit02Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { CommentBody } from "@/components/comments/comment-body";
import { CommentEditForm } from "@/components/comments/comment-edit-form";
import { CommentTimestamp } from "@/components/comments/comment-timestamp";
import { ContentCommentAvatar } from "@/components/content/inline-comments/content-comment-avatar";
import {
  COMMENT_REACTIONS,
  INLINE_COMMENT_REACTIONS,
} from "@/constants/comments";
import type {
  ContentInlineCommentProps,
  ContentInlineCommentReactionsProps,
} from "@/types/content/inline-comments";

export function ContentInlineComment({
  comment,
  currentUserId,
  busy,
  onEdit,
  onDelete,
  onReact,
  onReply,
  onResolve,
  replies,
  hasReplies = false,
  connector,
}: ContentInlineCommentProps) {
  const t = useTranslations("comments");
  const tCommon = useTranslations("common.actions");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [pickerOpen, setPickerOpen] = useState(false);
  const disabled = Boolean(busy || comment.pending);
  const author = comment.userId === currentUserId;
  if (comment.deletedAt) {
    return replies ? <li className="min-w-0">{replies}</li> : null;
  }
  return (
    <li className="relative min-w-0" data-comment-id={comment.id}>
      {connector ? (
        <>
          <svg
            aria-hidden="true"
            className="text-border pointer-events-none absolute top-0 -left-5.5 h-4.5 w-5 overflow-visible"
            fill="none"
            viewBox="0 0 20 18"
          >
            <path
              d="M0.5 0V8C0.5 13.523 4.977 18 10.5 18H20"
              stroke="currentColor"
            />
          </svg>
          {connector === "middle" ? (
            <span
              aria-hidden="true"
              className="border-border pointer-events-none absolute inset-y-0 -left-5.5 border-l"
            />
          ) : null}
        </>
      ) : null}
      <div className="group/inline-comment duration-normal ease-emphasized relative flex gap-2.5 py-1.5 transition-[opacity,translate] motion-reduce:transition-none starting:translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0">
        {hasReplies ? (
          <span
            aria-hidden="true"
            className="border-border pointer-events-none absolute top-7.5 bottom-0 left-3 border-l"
          />
        ) : null}
        <ContentCommentAvatar name={comment.name} image={comment.image} />
        <div className="min-w-0 flex-1">
          <div className="relative flex h-6 items-center gap-1.5">
            <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
              <span className="text-foreground min-w-0 truncate text-sm font-medium">
                {comment.name}
              </span>
              <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
                <CommentTimestamp createdAt={comment.createdAt} />
                {comment.editedAt ? ` · ${t("edited")}` : null}
              </span>
            </div>
            <div className="bg-background duration-fast before:from-background before:to-background/0 absolute inset-y-0 right-0 flex items-center gap-0.5 rounded-md opacity-100 transition-opacity ease-out before:pointer-events-none before:absolute before:inset-y-0 before:-left-8 before:w-8 before:bg-linear-to-l focus-within:opacity-100 has-[[data-popup-open]]:opacity-100 motion-reduce:transition-none [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/inline-comment:opacity-100">
              {!comment.parentId && onResolve ? (
                <Button
                  aria-label={t(
                    comment.resolvedAt ? "reopenThread" : "resolveThread"
                  )}
                  title={t(
                    comment.resolvedAt ? "reopenThread" : "resolveThread"
                  )}
                  size="icon-sm"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => onResolve(comment.id, !comment.resolvedAt)}
                >
                  <HugeiconsIcon
                    aria-hidden="true"
                    icon={comment.resolvedAt ? Undo02Icon : Tick02Icon}
                  />
                </Button>
              ) : null}
              {comment.parentId || !onResolve ? (
                <Button
                  aria-label={t("replyToComment")}
                  title={t("replyToComment")}
                  size="icon-sm"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => onReply(comment)}
                >
                  <HugeiconsIcon
                    aria-hidden="true"
                    icon={ArrowTurnBackwardIcon}
                  />
                </Button>
              ) : null}
              <Popover.Root open={pickerOpen} onOpenChange={setPickerOpen}>
                <Popover.Trigger
                  render={
                    <Button
                      aria-label={t("addReaction")}
                      title={t("addReaction")}
                      size="icon-sm"
                      variant="ghost"
                      disabled={disabled}
                    />
                  }
                >
                  <HugeiconsIcon aria-hidden="true" icon={SmilePlusIcon} />
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Positioner
                    side="top"
                    align="end"
                    sideOffset={8}
                    collisionPadding={8}
                    className="z-50"
                  >
                    <Popover.Popup
                      aria-label={t("addReaction")}
                      className="bg-background text-foreground flex items-center gap-1 rounded-xl border p-1 shadow-lg outline-none"
                    >
                      {INLINE_COMMENT_REACTIONS.map(({ emoji, key }) => (
                        <button
                          key={emoji}
                          type="button"
                          aria-label={t(`reactions.${key}`)}
                          className="hover:bg-muted focus-visible:ring-ring/50 duration-fast inline-flex size-8 items-center justify-center rounded-md text-lg transition-[background-color,scale] ease-out outline-none focus-visible:ring-2 active:scale-90 motion-reduce:transition-none"
                          disabled={disabled}
                          onClick={() => {
                            onReact(
                              comment.id,
                              emoji,
                              !comment.reactions.some(
                                (reaction) =>
                                  reaction.emoji === emoji &&
                                  reaction.userId === currentUserId
                              )
                            );
                            setPickerOpen(false);
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
              {author ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        aria-label={t("commentActions")}
                        title={t("commentActions")}
                        size="icon-sm"
                        variant="ghost"
                        disabled={disabled}
                      />
                    }
                  >
                    <HugeiconsIcon
                      aria-hidden="true"
                      icon={MoreHorizontalIcon}
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={disabled}
                      onClick={() => {
                        setDraft(comment.body);
                        setEditing(true);
                      }}
                    >
                      <HugeiconsIcon icon={PencilEdit02Icon} />
                      {tCommon("edit")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={disabled}
                      variant="destructive"
                      onClick={() => {
                        void onDelete(comment.id);
                      }}
                    >
                      <HugeiconsIcon icon={Delete02Icon} />
                      {tCommon("delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          </div>
          {editing ? (
            <CommentEditForm
              draft={draft}
              disabled={disabled}
              onDraftChange={setDraft}
              onCancel={() => setEditing(false)}
              onSave={async () => {
                if (await onEdit(comment.id, draft.trim())) {
                  setEditing(false);
                }
              }}
            />
          ) : (
            <CommentBody
              body={comment.body}
              className="mt-0 leading-5 [&_p]:my-0.5"
            />
          )}
          <ContentInlineCommentReactions
            comment={comment}
            currentUserId={currentUserId}
            disabled={disabled}
            onReact={onReact}
          />
        </div>
      </div>
      {replies}
    </li>
  );
}

function ContentInlineCommentReactions({
  comment,
  currentUserId,
  disabled,
  onReact,
}: ContentInlineCommentReactionsProps) {
  const t = useTranslations("comments");
  return comment.reactions.length ? (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {COMMENT_REACTIONS.map(({ emoji, key }) => {
        const reactions = comment.reactions.filter(
          (reaction) => reaction.emoji === emoji
        );
        const active = reactions.some(
          (reaction) => reaction.userId === currentUserId
        );
        return reactions.length ? (
          <button
            key={emoji}
            type="button"
            aria-label={t("reactionCount", {
              label: t(`reactions.${key}`),
              count: reactions.length,
            })}
            aria-pressed={active}
            disabled={disabled}
            className="border-border hover:bg-muted aria-pressed:bg-muted duration-fast inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs tabular-nums transition-[background-color,opacity,scale] ease-out active:scale-[0.96] motion-reduce:transition-none starting:scale-90 starting:opacity-0"
            onClick={() => onReact(comment.id, emoji, !active)}
          >
            {emoji} {reactions.length}
          </button>
        ) : null;
      })}
    </div>
  ) : null;
}
