export const CONTENT_HISTORY_PAGE_SIZE = 20;
export const CONTENT_HISTORY_MAX_PAGE_SIZE = 50;
export const CONTENT_REVISION_MAX = 2_147_483_647;

/** What changed between a saved version and the one before it. */
export const CONTENT_HISTORY_CHANGES = [
  "text",
  "title",
  "slug",
  "cover",
  "description",
  "tags",
  "authors",
  "date",
  "featured",
  "visibility",
  "settings",
] as const;
