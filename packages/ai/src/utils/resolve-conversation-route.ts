import { conversationSelectionSchema } from "@notra/ai/schemas/chat";
import type {
  AutoThinkingLevel,
  RoutingResult,
} from "@notra/ai/types/orchestration";
import type { UIMessage } from "ai";

export async function resolveConversationRoute(
  messages: UIMessage[],
  requestedModel: string | undefined,
  route: () => Promise<RoutingResult>,
  thinkingLevel?: AutoThinkingLevel
): Promise<RoutingResult> {
  if (requestedModel && requestedModel !== "auto") {
    return {
      model: requestedModel,
      thinkingLevel,
      complexity: "complex",
      requiresTools: true,
      reasoning: "User selected model explicitly",
    };
  }

  const selection = getConversationSelection(messages);
  if (selection) {
    return {
      ...selection,
      thinkingLevel: thinkingLevel ?? selection.thinkingLevel,
      complexity:
        selection.thinkingLevel === "high" ||
        selection.thinkingLevel === "medium"
          ? "complex"
          : "simple",
      requiresTools: true,
      reasoning: "Keeping the conversation's previous model and thinking level",
    };
  }

  const decision = await route();
  return {
    ...decision,
    thinkingLevel: thinkingLevel ?? decision.thinkingLevel,
  };
}

function getConversationSelection(messages: UIMessage[]) {
  for (const message of messages.toReversed()) {
    if (
      message.role !== "assistant" ||
      !message.metadata ||
      typeof message.metadata !== "object"
    ) {
      continue;
    }
    const parsed = conversationSelectionSchema.safeParse(message.metadata);
    if (parsed.success) {
      return parsed.data;
    }
  }
  const metadata = messages[0]?.metadata;
  const saved = conversationSelectionSchema.safeParse(
    metadata &&
      typeof metadata === "object" &&
      "conversationSelection" in metadata
      ? metadata.conversationSelection
      : undefined
  );
  return saved.success ? saved.data : undefined;
}

export function preserveConversationSelection(
  messages: UIMessage[],
  savedMessages: UIMessage[]
): UIMessage[] {
  const selection = getConversationSelection(savedMessages);
  return messages.map((message, index) =>
    index === 0
      ? {
          ...message,
          metadata: {
            ...(message.metadata && typeof message.metadata === "object"
              ? message.metadata
              : {}),
            conversationSelection: selection,
          },
        }
      : message
  );
}
