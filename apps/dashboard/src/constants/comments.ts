export const COMMENT_REACTIONS = [
  { emoji: "❤️", key: "heart" },
  { emoji: "🔥", key: "fire" },
  { emoji: "👍", key: "thumbsUp" },
  { emoji: "👎", key: "thumbsDown" },
  { emoji: "👀", key: "eyes" },
  { emoji: "👑", key: "crown" },
] as const;

export const COMMENT_REPLY_PREVIEW_COUNT = 3;

/** Deepest reply level; root comments are depth 0, so threads show three levels. */
export const COMMENT_MAX_DEPTH = 2;
export const CONTENT_COMMENT_PEEK_OPEN_DELAY = 150;
export const CONTENT_COMMENT_PEEK_CLOSE_DELAY = 200;

export const INLINE_COMMENT_REACTIONS = COMMENT_REACTIONS.slice(0, 5);

export const COMMENT_ANCHOR_MAX_EXACT_LENGTH = 10000;
export const COMMENT_ANCHOR_CONTEXT_LENGTH = 64;
export const COMMENT_ANCHOR_TEXT_NODE_TYPE = 3;
export const COMMENT_ANCHOR_WHITESPACE_REGEX = /\s/;
export const COMMENT_ANCHOR_HIGH_SURROGATE_REGEX = /[\uD800-\uDBFF]/;
export const COMMENT_ANCHOR_LOW_SURROGATE_REGEX = /[\uDC00-\uDFFF]/;
export const COMMENT_ANCHOR_LONE_SURROGATE_REGEX =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

export const CONTENT_COMMENT_HIGHLIGHT_NAME = "content-comment";
export const CONTENT_COMMENT_ACTIVE_HIGHLIGHT_NAME = "content-comment-active";
export const CONTENT_COMMENT_DRAFT_HIGHLIGHT_NAME = "content-comment-draft";
export const CONTENT_COMMENT_HIGHLIGHT_NAMES = [
  CONTENT_COMMENT_HIGHLIGHT_NAME,
  CONTENT_COMMENT_ACTIVE_HIGHLIGHT_NAME,
  CONTENT_COMMENT_DRAFT_HIGHLIGHT_NAME,
] as const;
export const CONTENT_COMMENT_CARD_GAP = 8;
/** Viewport width at which the gutter padding reaches the full 22rem rail. */
export const CONTENT_COMMENT_RAIL_BREAKPOINT_REM = 72;
export const CONTENT_COMMENT_RAIL_OFFSET = 16;
export const CONTENT_COMMENT_CARD_FALLBACK_HEIGHT = 160;
export const CARET_NAVIGATION_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);
