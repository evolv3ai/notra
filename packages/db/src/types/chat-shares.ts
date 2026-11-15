export type SharedChatPartContent =
  | { type: "text"; text: string }
  | { type: "file"; filename: string; mediaType: string }
  | { type: "tools"; names: string[] }
  | {
      type: "post";
      contentType: string;
      title: string;
      markdown: string;
    };

/** `id` is stable within a snapshot, so the page can key parts by it. */
export type SharedChatPart = SharedChatPartContent & { id: string };

export interface SharedChatMessage {
  id: string;
  role: "user" | "assistant";
  parts: SharedChatPart[];
}
