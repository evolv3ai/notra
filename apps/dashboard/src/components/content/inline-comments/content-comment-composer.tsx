"use client";

import { Popover } from "@base-ui/react/popover";
import { useRef } from "react";
import { useTranslations } from "use-intl";

import { ContentCommentAvatar } from "@/components/content/inline-comments/content-comment-avatar";
import { ContentCommentField } from "@/components/content/inline-comments/content-comment-field";
import { useContentComments } from "@/components/content/inline-comments/content-comments-provider";
import { commentMatchAnchor } from "@/utils/comment-anchor";

export function ContentCommentComposer() {
  const t = useTranslations("content.comments");
  const comments = useContentComments();
  const textarea = useRef<HTMLTextAreaElement>(null);
  if (!comments?.enabled) {
    return null;
  }
  const {
    blockedReason,
    closeComposer,
    composerOpen,
    discussion,
    draft,
    draftMatch,
    editorRoot,
    setDraftBody,
    submitDraft,
    submitError,
    submitting,
  } = comments;
  const body = draft?.body ?? "";
  const canSubmit = Boolean(
    body.trim() && discussion.user && !submitting && !blockedReason
  );
  const open = Boolean(composerOpen && draft && draftMatch && editorRoot);
  const error = submitError ?? blockedReason;
  const submit = () => {
    if (canSubmit) {
      void submitDraft();
    }
  };

  return (
    <Popover.Root
      onOpenChange={(next) => {
        if (!next) {
          closeComposer();
        }
      }}
      open={open}
    >
      <Popover.Portal>
        <Popover.Positioner
          align="start"
          anchor={
            open && editorRoot && draftMatch
              ? commentMatchAnchor(editorRoot, draftMatch)
              : null
          }
          className="z-50"
          collisionPadding={12}
          side="bottom"
          sideOffset={8}
        >
          <Popover.Popup
            aria-label={t("composerLabel")}
            className="text-popover-foreground duration-fast ease-emphasized w-[min(26rem,calc(100vw-2rem))] rounded-[18px] opacity-100 shadow-lg transition-[opacity,translate] outline-none data-ending-style:translate-y-1 data-ending-style:opacity-0 data-starting-style:translate-y-1 data-starting-style:opacity-0 motion-reduce:transition-none motion-reduce:data-ending-style:translate-y-0 motion-reduce:data-starting-style:translate-y-0"
            initialFocus={textarea}
          >
            <ContentCommentField
              busy={submitting}
              canSubmit={canSubmit}
              error={error}
              label={t("composerLabel")}
              leading={
                discussion.user ? (
                  <ContentCommentAvatar
                    image={discussion.user.image}
                    name={discussion.user.name}
                  />
                ) : null
              }
              onChange={setDraftBody}
              onSubmit={submit}
              placeholder={t("composerPlaceholder")}
              readOnly={submitting}
              sendLabel={t("send")}
              textarea={textarea}
              value={body}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
