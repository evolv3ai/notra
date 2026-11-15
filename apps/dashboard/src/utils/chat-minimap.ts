import type { ChatMinimapMessage, ChatMinimapTurn } from "@/types/chat-minimap";

const MARKDOWN_SYNTAX_REGEX = /[#*_`>~[\]]+|\(https?:\/\/[^)]*\)/g;
const WHITESPACE_REGEX = /\s+/g;
const MAX_DESCRIPTION_LENGTH = 200;

const titleCache = new WeakMap<ChatMinimapMessage, string>();
const descriptionCache = new WeakMap<ChatMinimapMessage, string>();

function toPlainText(text: string) {
  return text
    .replace(MARKDOWN_SYNTAX_REGEX, " ")
    .replace(WHITESPACE_REGEX, " ")
    .trim();
}

function getTitle<TMessage extends ChatMinimapMessage>(
  message: TMessage,
  getUserTitle: (message: TMessage) => string
) {
  let title = titleCache.get(message);
  if (title === undefined) {
    title = toPlainText(getUserTitle(message));
    titleCache.set(message, title);
  }
  return title;
}

function getDescription(message: ChatMinimapMessage) {
  let description = descriptionCache.get(message);
  if (description === undefined) {
    const text = message.parts
      .flatMap((part) =>
        part.type === "text" && "text" in part && typeof part.text === "string"
          ? [part.text]
          : []
      )
      .join(" ");
    description = toPlainText(text).slice(0, MAX_DESCRIPTION_LENGTH);
    descriptionCache.set(message, description);
  }
  return description;
}

export function buildChatMinimapTurns<TMessage extends ChatMinimapMessage>(
  messages: TMessage[],
  getUserTitle: (message: TMessage) => string
): ChatMinimapTurn[] {
  const turns: ChatMinimapTurn[] = [];

  for (const message of messages) {
    if (message.role === "user") {
      turns.push({
        id: message.id,
        messageIds: [message.id],
        title: getTitle(message, getUserTitle),
      });
      continue;
    }

    const turn = turns.at(-1);
    if (!turn) {
      continue;
    }
    turn.messageIds.push(message.id);
    turn.description ||= getDescription(message) || undefined;
  }

  return turns;
}
