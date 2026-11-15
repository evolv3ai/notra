"use client";

import { RepeatIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@notra/ui/components/ai-elements/message";
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@notra/ui/components/ui/message-scroller";
import { isToolUIPart, type UIMessage } from "ai";
import { domMax, LazyMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

import { ChatActivityStatus } from "@/components/ai/chat-activity-status";
import { ChatAssistantParts } from "@/components/ai/chat-assistant-parts";
import { ChatToolBlock } from "@/components/ai/chat-tool-block";
import { Button } from "@/components/button";
import { UserMessageTextBubble } from "@/components/chat/user-message-actions";
import { DesignSystemFrame } from "@/components/design-system/design-system-frame";
import { ACTIVITY_STEP_SETTLE_MS } from "@/constants/chat-activity";
import { buildChatLoadingScenarios } from "@/lib/design-system/chat-loading-scenarios";
import { useChatActivityTimer } from "@/lib/hooks/use-chat-activity-timer";
import { useDelayedAppearance } from "@/lib/hooks/use-delayed-appearance";
import { getChatActivity, hasVisibleChatContent } from "@/utils/chat-activity";

type ChatPart = UIMessage["parts"][number];

const START_DELAY_MS = 300;

function noop() {}

function usePlayback(frameCount: number, delays: number[]) {
  const [cursor, setCursor] = useState(0);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (cursor >= frameCount) {
      return;
    }
    const timer = window.setTimeout(
      () => setCursor((value) => value + 1),
      cursor === 0 ? START_DELAY_MS : (delays[cursor - 1] ?? 0)
    );
    return () => window.clearTimeout(timer);
  }, [cursor, delays, frameCount, run]);

  return {
    cursor,
    restart: () => {
      setCursor(0);
      setRun((value) => value + 1);
    },
  };
}

export function ChatLoadingPlayground() {
  const scenarios = useMemo(() => buildChatLoadingScenarios(), []);
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id ?? "");
  const scenario =
    scenarios.find((entry) => entry.id === scenarioId) ?? scenarios[0];
  const frames = useMemo(() => scenario?.frames ?? [], [scenario]);
  const delays = useMemo(() => frames.map((frame) => frame.delayMs), [frames]);
  const playback = usePlayback(frames.length, delays);
  const frame = playback.cursor === 0 ? null : frames[playback.cursor - 1];
  const messages = frame?.messages ?? [];
  const isLoading = frame?.isLoading ?? false;
  const chatId = `${scenario?.id ?? ""}-${String(playback.cursor === 0)}`;

  const activitySeconds = useChatActivityTimer(
    isLoading,
    scenario?.id ?? "",
    messages.at(-1)?.role === "assistant" ? messages.at(-1)?.id : undefined
  );
  const chatActivity = getChatActivity(messages, isLoading);
  const showThinkingIndicator = useDelayedAppearance(
    chatActivity.showThinkingIndicator,
    {
      delayMs: ACTIVITY_STEP_SETTLE_MS,
      immediate: messages.at(-1)?.role !== "assistant",
    }
  );
  const visibleMessages = messages.filter((message) =>
    hasVisibleChatContent(message)
  );
  const lastVisible = visibleMessages.at(-1);
  const isThinkingInline =
    showThinkingIndicator &&
    lastVisible?.role === "assistant" &&
    lastVisible.id === messages.at(-1)?.id;
  const thinkingStatus = (
    <span className="text-muted-foreground flex items-center gap-2 text-sm leading-5">
      <ChatActivityStatus active seconds={activitySeconds ?? 0} />
    </span>
  );

  function renderPart(part: ChatPart, messageId: string) {
    if (part.type === "text") {
      return part.text.trim() ? (
        <MessageResponse
          isAnimating={messageId === chatActivity.activeMessageId}
        >
          {part.text}
        </MessageResponse>
      ) : null;
    }
    if (isToolUIPart(part) && part.type === "dynamic-tool") {
      return (
        <ChatToolBlock
          input={part.input}
          isActive={messageId === chatActivity.activeMessageId}
          key={part.toolCallId}
          output={part.state === "output-available" ? part.output : undefined}
          state={part.state}
          toolCallId={part.toolCallId}
          toolName={part.toolName}
        />
      );
    }
    return null;
  }

  return (
    <DesignSystemFrame
      description="Replays a scripted agent turn through the real chat components and loading logic. Nothing here calls the backend."
      title="Chat loading playground"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {scenarios.map((entry) => (
            <Button
              aria-pressed={entry.id === scenario?.id}
              data-scenario={entry.id}
              key={entry.id}
              onClick={() => {
                setScenarioId(entry.id);
                playback.restart();
              }}
              size="sm"
              variant={entry.id === scenario?.id ? "default" : "outline"}
            >
              {entry.label}
            </Button>
          ))}
          <Button
            data-restart
            onClick={playback.restart}
            size="sm"
            variant="ghost"
          >
            <HugeiconsIcon
              aria-hidden
              data-icon="inline-start"
              icon={RepeatIcon}
            />
            Replay
          </Button>
        </div>
        <div className="border-border/80 bg-background relative flex h-[36rem] flex-col overflow-hidden rounded-xl border">
          <LazyMotion features={domMax}>
            <MessageScrollerProvider autoScroll key={chatId}>
              <MessageScroller className="min-h-0 flex-1">
                <MessageScrollerViewport className="min-w-0 overflow-x-hidden">
                  <MessageScrollerContent className="gap-8 px-4 pt-6 pb-8">
                    {visibleMessages.map((message) => (
                      <MessageScrollerItem
                        className="mx-auto w-full max-w-2xl"
                        key={message.id}
                        messageId={message.id}
                      >
                        <Message from={message.role}>
                          {message.role === "user" ? (
                            <div className="ml-auto flex w-full max-w-full items-start justify-end">
                              <UserMessageTextBubble
                                initialText=""
                                isEditing={false}
                                onCancel={noop}
                                onSubmit={noop}
                              >
                                <MessageResponse>
                                  {message.parts
                                    .filter((part) => part.type === "text")
                                    .map((part) => part.text)
                                    .join("\n")}
                                </MessageResponse>
                              </UserMessageTextBubble>
                            </div>
                          ) : (
                            <MessageContent>
                              <ChatAssistantParts
                                elapsedSeconds={
                                  isLoading && message.id === lastVisible?.id
                                    ? activitySeconds
                                    : undefined
                                }
                                isLoading={
                                  isLoading && message.id === lastVisible?.id
                                }
                                messageId={message.id}
                                parts={message.parts}
                                renderStandalone={(part) =>
                                  renderPart(part, message.id)
                                }
                                renderTool={(part) =>
                                  renderPart(part, message.id)
                                }
                              />
                              {isThinkingInline &&
                              message.id === lastVisible?.id
                                ? thinkingStatus
                                : null}
                            </MessageContent>
                          )}
                        </Message>
                      </MessageScrollerItem>
                    ))}
                    {showThinkingIndicator && !isThinkingInline && (
                      <div className="mx-auto w-full max-w-2xl">
                        <Message from="assistant">
                          <MessageContent>{thinkingStatus}</MessageContent>
                        </Message>
                      </div>
                    )}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
              </MessageScroller>
            </MessageScrollerProvider>
          </LazyMotion>
        </div>
      </div>
    </DesignSystemFrame>
  );
}
