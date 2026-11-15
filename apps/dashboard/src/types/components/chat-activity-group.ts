import type { ChatMessageMetadata } from "@notra/ai/types/chat";
import type { UIMessage } from "ai";
import type { ReactNode } from "react";

export type AssistantActivityStep =
  | "writingResponse"
  | "thinking"
  | "waitingForApproval"
  | "searchingWeb"
  | "executingTools"
  | "runningTool"
  | "writingDraft";

export interface ChatActivityStatusProps {
  children?: ReactNode;
  seconds: number;
  label?: string;
  active?: boolean;
}

export interface ChatActivityGroupProps {
  children: ReactNode;
  /** Starts open and stays open until the reader folds it. */
  defaultOpen?: boolean;
  durationMs?: number;
  elapsedSeconds?: number;
  forceOpen?: boolean;
  groupId: string;
  hasDetails: boolean;
  isLoading: boolean;
  isStreaming: boolean;
  step: AssistantActivityStep;
}

export interface ChatSearchStackProps {
  items: Array<{
    input: unknown;
    output: unknown;
    state: string;
    toolCallId: string;
  }>;
}

export interface ChatAssistantPartsProps {
  activityTimings?: ChatMessageMetadata["activityTimings"];
  durationMs?: number;
  elapsedSeconds?: number;
  isLoading: boolean;
  isStandaloneTool?: (part: UIMessage["parts"][number]) => boolean;
  /** Identifies effect-only tool elements that mount without splitting activity. */
  isStandalonePartVisible?: (content: ReactNode) => boolean;
  messageId: string;
  parts: UIMessage["parts"];
  renderStandalone: (
    part: UIMessage["parts"][number],
    index: number
  ) => ReactNode;
  renderTool: (part: UIMessage["parts"][number], index: number) => ReactNode;
}
