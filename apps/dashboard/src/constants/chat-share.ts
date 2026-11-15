/** About 143 bits from nanoid's 64-symbol alphabet, so links can't be guessed. */
export const CHAT_SHARE_ID_LENGTH = 24;

export const CHAT_SHARE_PATH_PREFIX = "/share/";

export const SHARED_POST_CONTENT_TYPES = [
  "blog_post",
  "changelog",
  "investor_update",
  "linkedin_post",
  "twitter_post",
] as const;

/** Tool rows a shared message shows before folding the rest behind a toggle. */
export const SHARED_CHAT_VISIBLE_TOOL_COUNT = 4;
