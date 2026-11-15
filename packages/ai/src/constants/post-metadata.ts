export const POST_TAG_MAX_LENGTH = 40;
export const POST_TAGS_MAX = 12;
/** Tags a writer agent should pick for one post. */
export const POST_GENERATED_TAGS_MAX = 4;
export const POST_EXCERPT_MAX_LENGTH = 300;
export const POST_COVER_ALT_MAX_LENGTH = 300;
export const POST_COVER_URL_MAX_LENGTH = 2048;
export const POST_AUTHORS_MAX = 5;
/** Existing tags getPostDetails shows the model. */
export const POST_DETAILS_TAG_SUGGESTIONS = 30;
/** A leading YAML frontmatter block, e.g. from a pasted .mdx file. */
export const LEADING_FRONTMATTER =
  /^﻿?\s*---\r?\n(?=[A-Za-z_][\w-]*:)[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;
