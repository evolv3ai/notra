import {
  CODE_MODE_TOOL_NAME,
  STANDALONE_CODE_MODE_TOOL_NAMES,
} from "@notra/ai/constants/code-mode";
import type { ChatUIMessage } from "@notra/ai/types/chat";
import type {
  SharedChatMessage,
  SharedChatPartContent,
} from "@notra/db/types/chat-shares";
import { getToolName, isToolUIPart } from "ai";

import {
  CHAT_REFERENCE_TOKEN_SPLIT_REGEX,
  UPDATE_TODOS_TOOL_NAME,
} from "@/constants/chat-posts";
import { parseChatAnnotations } from "@/utils/chat-annotations";
import {
  getChatPosts,
  getCreateToolContentType,
  parsePostReferenceValue,
} from "@/utils/chat-posts";
import {
  getReferenceDisplay,
  parseReferenceValue,
} from "@/utils/integration-reference";

const LINE_BREAK_REGEX = /\r?\n/;
const CODE_MODE_CALL_REGEX = /\btools\.([A-Za-z_$][\w$]*)\s*\(/g;
const CODE_MODE_TOOLS: ReadonlySet<string> = new Set(
  STANDALONE_CODE_MODE_TOOL_NAMES
);

/**
 * The tools a code-mode script called, so the page can name them instead of
 * a generic "Executed tools". Only known tool names pass, never the script.
 */
function codeModeToolNames(input: unknown): string[] {
  const js =
    input && typeof input === "object" && "js" in input ? input.js : undefined;
  if (typeof js !== "string") {
    return [];
  }
  return [...js.matchAll(CODE_MODE_CALL_REGEX)].flatMap(([, name]) =>
    name && CODE_MODE_TOOLS.has(name) ? [name] : []
  );
}

function quote(text: string) {
  return text
    .split(LINE_BREAK_REGEX)
    .map((line) => `> ${line}`)
    .join("\n");
}

/**
 * Turns composer-only syntax into readable text: annotation blocks become
 * quotes, and integration and post tokens become their labels so internal
 * ids never reach a public page.
 */
function toShareText(raw: string, postTitles: ReadonlyMap<string, string>) {
  const labelTokens = (text: string) =>
    text.replace(CHAT_REFERENCE_TOKEN_SPLIT_REGEX, (match) => {
      const postId = parsePostReferenceValue(match);
      if (postId) {
        return `@${postTitles.get(postId) ?? "post"}`;
      }
      const item = parseReferenceValue(match);
      return item ? getReferenceDisplay(item) : match;
    });
  const annotated = parseChatAnnotations(raw);
  const quotes = annotated
    ? annotated.annotations.map((annotation) => {
        const passage = quote(labelTokens(annotation.text));
        return annotation.note
          ? `${passage}\n\n${labelTokens(annotation.note)}`
          : passage;
      })
    : [];
  const body = labelTokens(annotated ? annotated.rest : raw);
  return [...quotes, body.trim()].filter(Boolean).join("\n\n");
}

/**
 * Builds the public copy of a chat. Only what a reader needs survives:
 * message text, attachment names without URLs, saved posts, and the names of
 * the tools that ran. Tool inputs and outputs, reasoning, authors, and model
 * metadata and message ids are dropped because they can carry workspace data.
 */
export function buildChatShareSnapshot(
  messages: readonly ChatUIMessage[]
): SharedChatMessage[] {
  const posts = getChatPosts(messages);
  const postsByToolCallId = new Map(
    posts.flatMap((post) =>
      post.state === "saved" ? [[post.toolCallId, post] as const] : []
    )
  );
  const postTitles = new Map(
    posts.flatMap((post) =>
      post.postId && post.title ? [[post.postId, post.title] as const] : []
    )
  );

  return messages.flatMap((message, position): SharedChatMessage[] => {
    if (message.role !== "user" && message.role !== "assistant") {
      return [];
    }
    const parts: SharedChatPartContent[] = [];
    for (const part of message.parts) {
      if (part.type === "text") {
        const text = toShareText(part.text, postTitles);
        if (text) {
          parts.push({ type: "text", text });
        }
        continue;
      }
      if (part.type === "file") {
        parts.push({
          type: "file",
          filename: part.filename ?? "attachment",
          mediaType: part.mediaType,
        });
        continue;
      }
      if (!isToolUIPart(part)) {
        continue;
      }
      const name = getToolName(part);
      if (name === UPDATE_TODOS_TOOL_NAME) {
        continue;
      }
      if (part.type !== "dynamic-tool" && getCreateToolContentType(part.type)) {
        const post = postsByToolCallId.get(part.toolCallId);
        if (post) {
          parts.push({
            type: "post",
            contentType: post.contentType,
            title: post.title,
            markdown: post.markdown,
          });
        }
        continue;
      }
      const calledNames =
        name === CODE_MODE_TOOL_NAME ? codeModeToolNames(part.input) : [];
      const names = calledNames.length > 0 ? calledNames : [name];
      const last = parts.at(-1);
      const group =
        last?.type === "tools"
          ? last
          : { type: "tools" as const, names: [] as string[] };
      if (group !== last) {
        parts.push(group);
      }
      for (const toolName of names) {
        if (!group.names.includes(toolName)) {
          group.names.push(toolName);
        }
      }
    }
    return parts.length > 0
      ? [
          {
            // Positional ids, so internal message ids stay private.
            id: `m${position}`,
            role: message.role,
            parts: parts.map((part, index) => ({
              ...part,
              id: `m${position}:${index}`,
            })),
          },
        ]
      : [];
  });
}

/**
 * Rebuilds a chat history from a share so a reader can continue it. Tool
 * calls are dropped because the snapshot never kept their inputs or results,
 * and saved posts come back as their markdown so the agent still sees them.
 */
export function chatShareSnapshotToMessages(
  messages: readonly SharedChatMessage[]
): ChatUIMessage[] {
  return messages.flatMap((message): ChatUIMessage[] => {
    const parts = message.parts.flatMap((part): ChatUIMessage["parts"] => {
      if (part.type === "text") {
        return [{ type: "text", text: part.text }];
      }
      if (part.type === "post") {
        const heading = part.title ? `## ${part.title}\n\n` : "";
        return [{ type: "text", text: `${heading}${part.markdown}` }];
      }
      return [];
    });
    return parts.length > 0
      ? [{ id: crypto.randomUUID(), role: message.role, parts }]
      : [];
  });
}
