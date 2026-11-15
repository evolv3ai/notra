"use client";

import { Popover } from "@base-ui/react/popover";
import { cn } from "@notra/ui/lib/utils";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { ContentCommentPeek } from "@/components/content/inline-comments/content-comment-peek";
import { ContentCommentThreadCard } from "@/components/content/inline-comments/content-comment-thread-card";
import { useContentComments } from "@/components/content/inline-comments/content-comments-provider";
import {
  CONTENT_COMMENT_PEEK_CLOSE_DELAY,
  CONTENT_COMMENT_PEEK_OPEN_DELAY,
} from "@/constants/comments";
import { useContentCommentRail } from "@/lib/hooks/use-content-comment-rail";
import type { ContentCommentsLayerProps } from "@/types/content/inline-comments";
import {
  collectCommentTextNodes,
  commentMatchAnchor,
  createCommentRange,
} from "@/utils/comment-anchor";
import { getContentCommentThreadEntries } from "@/utils/content-comment-thread";

export function ContentCommentsLayer({ container }: ContentCommentsLayerProps) {
  const t = useTranslations("comments");
  const comments = useContentComments();
  const rail = useRef<HTMLDivElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const { fits, left, layout } = useContentCommentRail(container, rail);
  const request = comments?.focusRequest;
  const active = comments?.threads.find(
    (thread) => thread.comment.id === comments.activeThreadId
  );
  const [peekId, setPeekId] = useState<string | null>(null);
  const peekTimer = useRef(0);
  const threadRanges = useRef<{ id: string; range: Range }[] | null>(null);
  const peek = active
    ? undefined
    : comments?.threads.find((thread) => thread.comment.id === peekId);
  const shown = active ?? peek;
  const root = comments?.editorRoot;
  const narrow = Boolean(comments?.enabled && !fits && root);

  const schedulePeek = (id: string | null, delay: number) => {
    window.clearTimeout(peekTimer.current);
    peekTimer.current = window.setTimeout(() => setPeekId(id), delay);
  };

  const threadAtPoint = useEffectEvent((x: number, y: number) => {
    if (!(comments && root)) {
      return null;
    }
    if (!threadRanges.current) {
      const nodes = collectCommentTextNodes(root);
      threadRanges.current = comments.threads.flatMap((thread) => {
        const range = thread.match
          ? createCommentRange(root, thread.match, nodes)
          : null;
        return range ? [{ id: thread.comment.id, range }] : [];
      });
    }
    for (const { id, range } of threadRanges.current) {
      for (const rect of range.getClientRects()) {
        if (
          x >= rect.left &&
          x <= rect.right &&
          y >= rect.top &&
          y <= rect.bottom
        ) {
          return id;
        }
      }
    }
    return null;
  });

  const onEditorPointer = useEffectEvent((event: PointerEvent) => {
    if (event.pointerType !== "mouse" || comments?.activeThreadId) {
      return;
    }
    const hit = threadAtPoint(event.clientX, event.clientY);
    if (hit) {
      if (hit !== peekId) {
        schedulePeek(hit, CONTENT_COMMENT_PEEK_OPEN_DELAY);
      } else {
        window.clearTimeout(peekTimer.current);
      }
    } else if (peekId) {
      schedulePeek(null, CONTENT_COMMENT_PEEK_CLOSE_DELAY);
    } else {
      window.clearTimeout(peekTimer.current);
    }
  });

  useEffect(() => {
    if (!(narrow && root)) {
      return;
    }
    // Ranges are rebuilt lazily after any edit or thread change, not per mouse move.
    threadRanges.current = null;
    const observer = new MutationObserver(() => {
      threadRanges.current = null;
    });
    observer.observe(root, {
      characterData: true,
      childList: true,
      subtree: true,
    });
    let frame = 0;
    let latest: PointerEvent | null = null;
    const onMove = (event: PointerEvent) => {
      latest = event;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (latest) {
          onEditorPointer(latest);
        }
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(frame);
      schedulePeek(null, CONTENT_COMMENT_PEEK_CLOSE_DELAY);
    };
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(peekTimer.current);
      observer.disconnect();
      threadRanges.current = null;
      setPeekId(null);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
    };
  }, [narrow, root]);

  const threads = comments?.threads;
  useEffect(() => {
    if (threads) {
      threadRanges.current = null;
    }
  }, [threads]);

  useEffect(() => {
    if (comments?.activeThreadId && !active) {
      comments.activateThread(null);
      if (document.activeElement === document.body) {
        comments.editorRoot?.focus({ preventScroll: true });
      }
    }
  }, [active, comments]);

  useEffect(() => {
    if (!request) {
      return;
    }
    const thread = comments?.threads.find(
      (item) => item.comment.id === request
    );
    if (thread?.match && comments?.editorRoot) {
      const range = createCommentRange(comments.editorRoot, thread.match);
      range?.startContainer.parentElement?.scrollIntoView({
        block: "nearest",
        behavior: "instant",
      });
    }
    const target = fits
      ? rail.current?.querySelector<HTMLElement>(
          `[data-comment-thread="${CSS.escape(request)}"]`
        )
      : popup.current?.querySelector<HTMLElement>("[data-comment-thread]");
    if (target) {
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "nearest", behavior: "instant" });
      comments?.clearFocusRequest();
    }
  }, [request, fits, layout, comments]);

  if (!comments?.enabled) {
    return null;
  }
  return (
    <>
      {fits ? (
        <div
          aria-label={t("title")}
          className="duration-normal absolute top-0 left-(--comment-rail-left) w-80 transition-opacity ease-out motion-reduce:transition-none starting:opacity-0"
          ref={rail}
          role="region"
          style={{ "--comment-rail-left": `${left}px` } as React.CSSProperties}
        >
          {layout.map(({ id, top }) => {
            const thread = comments.threads.find(
              (item) => item.comment.id === id
            );
            return thread ? (
              <div
                className="absolute top-(--comment-thread-top) w-full"
                data-rail-thread={id}
                key={id}
                style={
                  { "--comment-thread-top": `${top}px` } as React.CSSProperties
                }
              >
                <ContentCommentThreadCard thread={thread} />
              </div>
            ) : null;
          })}
        </div>
      ) : null}
      <Popover.Root
        open={Boolean(!fits && shown?.match && comments.editorRoot)}
        onOpenChange={(open) => {
          if (!open) {
            window.clearTimeout(peekTimer.current);
            setPeekId(null);
            comments.activateThread(null);
          }
        }}
      >
        <Popover.Portal>
          <Popover.Positioner
            anchor={
              shown?.match && comments.editorRoot
                ? commentMatchAnchor(comments.editorRoot, shown.match)
                : null
            }
            align="start"
            side="bottom"
            sideOffset={8}
            collisionPadding={12}
            className="z-50"
          >
            <Popover.Popup
              aria-label={t("title")}
              className={cn(
                "bg-popover text-popover-foreground duration-fast ease-emphasized max-h-[min(32rem,70dvh)] overflow-y-auto rounded-xl shadow-lg transition-[opacity,translate] outline-none data-ending-style:translate-y-1 data-ending-style:opacity-0 data-starting-style:translate-y-1 data-starting-style:opacity-0 motion-reduce:transition-none motion-reduce:data-ending-style:translate-y-0 motion-reduce:data-starting-style:translate-y-0",
                peek
                  ? "w-[min(18rem,calc(100vw-2rem))] border"
                  : "w-[min(22rem,calc(100vw-2rem))]"
              )}
              ref={(element) => {
                popup.current = element;
                if (element && request) {
                  element
                    .querySelector<HTMLElement>("[data-comment-thread]")
                    ?.focus({ preventScroll: true });
                  comments.clearFocusRequest();
                }
              }}
              initialFocus={false}
              onPointerEnter={() => window.clearTimeout(peekTimer.current)}
              onPointerLeave={(event) => {
                if (event.pointerType === "mouse" && !active) {
                  schedulePeek(null, CONTENT_COMMENT_PEEK_CLOSE_DELAY);
                }
              }}
            >
              {active ? <ContentCommentThreadCard thread={active} /> : null}
              {peek ? (
                <ContentCommentPeek
                  comment={peek.comment}
                  onOpen={() => {
                    window.clearTimeout(peekTimer.current);
                    comments.activateThread(peek.comment.id);
                  }}
                  replyCount={
                    getContentCommentThreadEntries(
                      comments.discussion.items,
                      peek.comment.id
                    ).filter(
                      (item) => item.id !== peek.comment.id && !item.deletedAt
                    ).length
                  }
                />
              ) : null}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}
