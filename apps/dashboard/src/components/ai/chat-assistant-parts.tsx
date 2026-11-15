"use client";

import { isToolUIPart } from "ai";
import { Children, Fragment, type ReactNode } from "react";

import {
  ChatActivityGroup,
  ChatSearchStack,
} from "@/components/ai/chat-activity-group";
import { ChatReasoningBlock } from "@/components/ai/chat-reasoning-block";
import type { ChatAssistantPartsProps } from "@/types/components/chat-activity-group";
import {
  getAssistantActivityStep,
  getActivityGroupDuration,
  groupAssistantMessageParts,
  isAssistantActivityForceOpen,
  isAssistantActivityStreaming,
  stackAssistantActivityItems,
} from "@/utils/group-assistant-message-parts";

export function ChatAssistantParts({
  activityTimings,
  durationMs,
  elapsedSeconds,
  isLoading,
  isStandaloneTool,
  isStandalonePartVisible,
  messageId,
  parts,
  renderStandalone,
  renderTool,
}: ChatAssistantPartsProps) {
  const standaloneContent = new Map<number, ReactNode>();
  const hiddenStandaloneContent: ReactNode[] = [];
  const segments = groupAssistantMessageParts(parts, {
    isStandaloneTool,
    isStandalonePartVisible: (part, index) => {
      const content = isToolUIPart(part)
        ? renderTool(part, index)
        : renderStandalone(part, index);
      standaloneContent.set(index, content);
      if (isToolUIPart(part) && isStandalonePartVisible?.(content) === false) {
        // Keep effect-only components mounted outside the collapsible work log.
        hiddenStandaloneContent.push(
          <Fragment key={`${messageId}-standalone-tool-${part.toolCallId}`}>
            {content}
          </Fragment>
        );
        return false;
      }
      return Children.toArray(content).some((child) => child !== "");
    },
  });
  const hasSingleActivityGroup =
    segments.filter((segment) => segment.kind === "activity").length === 1;
  const lastActivityIndex = segments.findLastIndex(
    (segment) => segment.kind === "activity"
  );

  const renderedSegments = segments.map((segment, segmentIndex) => {
    if (segment.kind === "standalone") {
      return (
        <Fragment key={`${messageId}-standalone-${segment.index}`}>
          {standaloneContent.get(segment.index)}
        </Fragment>
      );
    }

    const isStreaming = isAssistantActivityStreaming(
      isLoading,
      segmentIndex === lastActivityIndex
    );
    const forceOpen =
      isAssistantActivityForceOpen(segment.items) ||
      segment.items.some(
        ({ part }) => isToolUIPart(part) && part.state === "approval-requested"
      );
    const details = stackAssistantActivityItems(segment.items)
      .map((item) => {
        if (item.kind === "searches") {
          return (
            <ChatSearchStack
              items={item.items.flatMap(({ part }) =>
                isToolUIPart(part)
                  ? [
                      {
                        input: part.input,
                        output: part.output,
                        state: part.state,
                        toolCallId: part.toolCallId,
                      },
                    ]
                  : []
              )}
              key={`${messageId}-searches-${item.items[0]?.index}`}
            />
          );
        }
        if (item.part.type === "reasoning") {
          return item.part.text.trim() ? (
            <ChatReasoningBlock key={`${messageId}-reasoning-${item.index}`}>
              {item.part.text}
            </ChatReasoningBlock>
          ) : null;
        }
        if (isToolUIPart(item.part)) {
          const tool = renderTool(item.part, item.index);
          return tool == null || tool === false ? null : (
            <Fragment key={`${messageId}-tool-${item.index}`}>{tool}</Fragment>
          );
        }
        return null;
      })
      .filter((detail) => detail !== null);

    return (
      <ChatActivityGroup
        durationMs={
          getActivityGroupDuration(segment.items, parts, activityTimings) ??
          (hasSingleActivityGroup ? durationMs : undefined)
        }
        elapsedSeconds={isStreaming ? elapsedSeconds : undefined}
        forceOpen={forceOpen}
        groupId={`${messageId}-${segment.startIndex}`}
        hasDetails={details.length > 0}
        isLoading={isStreaming}
        isStreaming={isStreaming}
        step={getAssistantActivityStep(parts)}
        key={`${messageId}-activity-${segment.startIndex}`}
      >
        {details}
      </ChatActivityGroup>
    );
  });
  return [...hiddenStandaloneContent, ...renderedSegments];
}
