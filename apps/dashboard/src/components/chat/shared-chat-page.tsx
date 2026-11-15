"use client";

import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  File02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type {
  SharedChatMessage,
  SharedChatPart,
} from "@notra/db/types/chat-shares";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@notra/ui/components/ai-elements/message";
import { buttonVariants } from "@notra/ui/components/ui/button";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@notra/ui/components/ui/message-scroller";
import { Notra } from "@notra/ui/components/ui/svgs/notra";
import { useCallback, useState } from "react";
import { useFormatter, useMessages, useTranslations } from "use-intl";

import {
  getMcpToolLabel,
  isMcpToolName,
} from "@/components/ai/chat-tool-block/mcp/utils";
import { ChatMinimapRail } from "@/components/chat/chat-minimap-rail";
import { SharedChatContinue } from "@/components/chat/shared-chat-continue";
import Link from "@/components/framework/link";
import {
  SHARED_CHAT_VISIBLE_TOOL_COUNT,
  SHARED_POST_CONTENT_TYPES,
} from "@/constants/chat-share";
import { CHAT_TOOL_LABEL_ALIASES } from "@/constants/chat-tool-labels";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import type { PublicChatShare } from "@/types/chat-share";
import { buildChatMinimapTurns } from "@/utils/chat-minimap";
import { humanizeToolName } from "@/utils/chat-share";
import { getChatToolIcon } from "@/utils/chat-tool-icon";
import { hasOwnKey } from "@/utils/has-own-key";

const NOTRA_SITE_URL = "https://usenotra.com";

function SharedPost({
  part,
}: {
  part: Extract<SharedChatPart, { type: "post" }>;
}) {
  const t = useTranslations("chat.sharedPage");
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const measureRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) {
      return;
    }
    const observer = new ResizeObserver(() =>
      setOverflows(node.scrollHeight > node.clientHeight + 1)
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const collapsed = overflows && !expanded;
  const contentType = SHARED_POST_CONTENT_TYPES.find(
    (type) => type === part.contentType
  );
  const label = t(`contentTypes.${contentType ?? "fallback"}`);

  return (
    <div className="bg-card overflow-hidden rounded-xl border">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <HugeiconsIcon
          className="text-muted-foreground size-4 shrink-0"
          icon={File02Icon}
        />
        <span className="min-w-0 truncate text-sm font-medium">
          {part.title || t("untitled")}
        </span>
        <span className="text-muted-foreground ml-auto shrink-0 text-xs">
          {label}
        </span>
      </div>
      <div className="relative">
        <div
          className={cn(
            "px-4 py-3 text-sm",
            !expanded && "max-h-72 overflow-hidden"
          )}
          ref={measureRef}
        >
          <MessageResponse>{part.markdown}</MessageResponse>
        </div>
        {collapsed ? (
          <div className="from-card pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t to-transparent" />
        ) : null}
      </div>
      {overflows || expanded ? (
        <button
          aria-expanded={expanded}
          className="text-muted-foreground hover:text-foreground hover:bg-muted/50 flex w-full items-center justify-center gap-1 border-t px-4 py-2 text-xs font-medium transition-colors"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          {expanded ? t("showLess") : t("showMore")}
          <HugeiconsIcon
            className="size-3.5"
            icon={expanded ? ArrowUp01Icon : ArrowDown01Icon}
          />
        </button>
      ) : null}
    </div>
  );
}

/** Matches the in-app tool rows: icon plus the finished-state label. */
function useSharedToolLabel() {
  const tTools = useTranslations("ai.toolBlock.tools");
  const toolMessages = useMessages().ai.toolBlock.tools;
  return (name: string) => {
    const key = hasOwnKey(CHAT_TOOL_LABEL_ALIASES, name)
      ? CHAT_TOOL_LABEL_ALIASES[name]
      : name;
    if (hasOwnKey(toolMessages, key)) {
      return tTools(key, { state: "done" });
    }
    return isMcpToolName(name)
      ? getMcpToolLabel(name, undefined)
      : humanizeToolName(name);
  };
}

function SharedTools({ names }: { names: string[] }) {
  const t = useTranslations("chat.sharedPage");
  const toolLabel = useSharedToolLabel();
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = names.length - SHARED_CHAT_VISIBLE_TOOL_COUNT;
  const visible =
    expanded || hiddenCount <= 0
      ? names
      : names.slice(0, SHARED_CHAT_VISIBLE_TOOL_COUNT);

  return (
    <ul className="flex flex-col gap-1.5">
      {visible.map((name) => (
        <li
          className="text-muted-foreground flex min-w-0 items-center gap-2 text-sm leading-5"
          key={name}
        >
          <HugeiconsIcon
            className="size-3.5 shrink-0"
            icon={getChatToolIcon(name)}
            strokeWidth={1.8}
          />
          <span className="min-w-0 truncate">{toolLabel(name)}</span>
        </li>
      ))}
      {hiddenCount > 0 ? (
        <li>
          <button
            aria-expanded={expanded}
            className="text-muted-foreground/70 hover:text-foreground flex items-center gap-2 text-sm leading-5 transition-colors"
            onClick={() => setExpanded((value) => !value)}
            type="button"
          >
            <HugeiconsIcon
              className="size-3.5 shrink-0"
              icon={expanded ? ArrowUp01Icon : ArrowDown01Icon}
              strokeWidth={1.8}
            />
            {expanded ? t("showLess") : t("moreTools", { count: hiddenCount })}
          </button>
        </li>
      ) : null}
    </ul>
  );
}

function SharedFile({
  part,
}: {
  part: Extract<SharedChatPart, { type: "file" }>;
}) {
  return (
    <span className="bg-muted/40 text-foreground inline-flex max-w-full items-center gap-2 rounded-lg border px-3 py-2 text-xs">
      <HugeiconsIcon
        className="text-muted-foreground size-4 shrink-0"
        icon={File02Icon}
      />
      <span className="truncate">{part.filename}</span>
    </span>
  );
}

function SharedPart({ part }: { part: SharedChatPart }) {
  if (part.type === "text") {
    return <MessageResponse>{part.text}</MessageResponse>;
  }
  if (part.type === "post") {
    return <SharedPost part={part} />;
  }
  if (part.type === "file") {
    return <SharedFile part={part} />;
  }
  return <SharedTools names={part.names} />;
}

function SharedMessage({ message }: { message: SharedChatMessage }) {
  if (message.role === "user") {
    const files = message.parts.filter((part) => part.type === "file");
    const rest = message.parts.filter((part) => part.type !== "file");
    return (
      <Message className="items-end" from="user">
        {files.length > 0 ? (
          <div className="flex flex-wrap justify-end gap-2">
            {files.map((part) => (
              <SharedPart key={part.id} part={part} />
            ))}
          </div>
        ) : null}
        {rest.length > 0 ? (
          <MessageContent>
            {rest.map((part) => (
              <SharedPart key={part.id} part={part} />
            ))}
          </MessageContent>
        ) : null}
      </Message>
    );
  }
  return (
    <Message from="assistant">
      <MessageContent className="gap-4">
        {message.parts.map((part) => (
          <SharedPart key={part.id} part={part} />
        ))}
      </MessageContent>
    </Message>
  );
}

function userMessageText(message: SharedChatMessage) {
  return message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join(" ");
}

export function SharedChatPage({ share }: { share: PublicChatShare }) {
  const t = useTranslations("chat.sharedPage");
  const format = useFormatter();
  const { data: session } = authClient.useSession();
  const turns = buildChatMinimapTurns(share.messages, userMessageText);
  // The page heading already names the chat, so the topbar only shows the
  // title once the heading has scrolled away.
  const [titleInView, setTitleInView] = useState(true);
  const headingRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) {
      return;
    }
    const observer = new IntersectionObserver(([entry]) =>
      setTitleInView(entry?.isIntersecting ?? false)
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="bg-background flex h-svh flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b px-4">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Link
            aria-label="Notra"
            className="hover:bg-muted flex size-7 shrink-0 items-center justify-center rounded-md transition-colors"
            href={NOTRA_SITE_URL}
          >
            <span className="dark:bg-foreground flex size-5 items-center justify-center rounded-sm">
              <Notra className="size-4.5 dark:size-4" />
            </span>
          </Link>
          <span
            className={cn(
              "flex min-w-0 items-center gap-2 transition-opacity duration-200",
              titleInView && "opacity-0"
            )}
          >
            <HugeiconsIcon
              aria-hidden="true"
              className="text-muted-foreground/60 size-3.5 shrink-0"
              icon={ArrowRight01Icon}
            />
            <span className="min-w-0 truncate font-medium">{share.title}</span>
          </span>
        </div>
        {session ? null : (
          <Link
            className={buttonVariants({ size: "sm", variant: "ghost" })}
            href={NOTRA_SITE_URL}
          >
            {t("cta")}
          </Link>
        )}
      </header>
      <div className="@container/chat relative flex min-h-0 flex-1 flex-col">
        <MessageScrollerProvider defaultScrollPosition="start">
          <MessageScroller className="min-h-0 flex-1">
            <MessageScrollerViewport className="min-w-0 overflow-x-hidden">
              <MessageScrollerContent className="gap-8 px-4 pt-10 pb-8">
                <div
                  className="mx-auto flex w-full max-w-2xl flex-col gap-1.5"
                  ref={headingRef}
                >
                  <h1 className="text-2xl font-semibold tracking-tight text-balance">
                    {share.title}
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    {t("sharedBy", {
                      organization: share.organizationName,
                      date: format.dateTime(new Date(share.sharedAt), {
                        dateStyle: "medium",
                      }),
                    })}
                  </p>
                </div>
                {share.messages.map((message) => (
                  <MessageScrollerItem
                    className="mx-auto w-full max-w-2xl"
                    key={message.id}
                    messageId={message.id}
                  >
                    <SharedMessage message={message} />
                  </MessageScrollerItem>
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
            <ChatMinimapRail turns={turns} />
          </MessageScroller>
        </MessageScrollerProvider>
        <div className="px-4 pb-4">
          <div className="bg-card mx-auto flex w-full max-w-2xl items-center justify-between gap-4 rounded-xl border py-2.5 ps-4 pe-2.5">
            <p className="text-muted-foreground min-w-0 text-sm text-pretty">
              {t("readOnly")}
            </p>
            <div className="shrink-0">
              <SharedChatContinue shareId={share.shareId} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
