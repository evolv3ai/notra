import type { CreateToolContentType } from "@/types/components/chat-page";

export const CHAT_CREATE_TOOL_TYPES = {
  "tool-createBlogPost": "blog_post",
  "tool-createChangelog": "changelog",
  "tool-createInvestorUpdate": "investor_update",
  "tool-createLinkedInPost": "linkedin_post",
  "tool-createTwitterPost": "twitter_post",
} as const satisfies Record<string, CreateToolContentType>;

export const CHAT_POST_EDIT_TOOL_NAMES: ReadonlySet<string> = new Set([
  "updatePost",
  "editPost",
]);

export const UPDATE_TODOS_TOOL_NAME = "updateTodos";

export const POST_REFERENCE_PREFIX = "@post/";

export const POST_REFERENCE_VALUE_PATTERN = /^@post\/([A-Za-z0-9_-]+)$/;

export const CHAT_REFERENCE_TOKEN_SPLIT_REGEX =
  /(@?integration\/(?:github\/[^/\s]+\/[^/\s]+\/[^/\s]+|linear\/[^/\s]+|mcp\/[^/\s]+\/[^/\s]+)|@post\/[A-Za-z0-9_-]+)/g;
