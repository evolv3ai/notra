export const ATTACHMENT_FILTERS = [
  "all",
  "image",
  "pdf",
  "text",
  "other",
] as const;

export const ATTACHMENT_TABLE_ROW_HEIGHT = 48;
export const ATTACHMENT_TABLE_SKELETON_ROWS = 6;

/** Chat uploads keyed by content hash can be reused instead of uploaded again. */
export const CHAT_CONTENT_KEY_PREFIX = "sha256-";
export const CHAT_CONTENT_KEY_RE = /\/chat\/sha256-([0-9a-f]{64})\.[a-z0-9]+$/;
/** Browser uploads of hashed files land here until the server verifies them. */
export const CHAT_STAGING_KEY_PREFIX = "staging-";
export const CHAT_STAGING_KEY_RE = /\/chat\/staging-[\w-]+\.[a-z0-9]+$/;
