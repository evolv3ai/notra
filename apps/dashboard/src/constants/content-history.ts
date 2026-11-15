import type { ContentHistoryChange } from "@notra/schemas/types/dashboard/content-history";

export const CONTENT_HISTORY_PANEL_CLASSNAME =
  "border-border bg-background overflow-hidden rounded-xl border";
export const CONTENT_HISTORY_SKELETON_ROWS = [
  "first",
  "second",
  "third",
] as const;

/** Metadata keys mapped to the change label shown in the history list; other keys count as "settings". */
export const CONTENT_HISTORY_METADATA_CHANGES: Record<
  string,
  ContentHistoryChange
> = {
  coverImage: "cover",
  excerpt: "description",
  tags: "tags",
  authorIds: "authors",
  displayDate: "date",
  featured: "featured",
  noindex: "visibility",
};
