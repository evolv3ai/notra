import type { contentAuthors } from "@notra/db/schema";
import { CONTENT_AUTHOR_SLUG_MAX_LENGTH } from "@notra/schemas/constants/dashboard/post-metadata";
import type { ContentAuthor } from "@notra/schemas/shared/post-metadata";
import { slugify } from "@notra/utils/slugify";

import {
  CONTENT_AUTHOR_SLUG_FALLBACK,
  TRAILING_DASHES,
} from "@/constants/content-overview";

export function serializeContentAuthor(
  row: typeof contentAuthors.$inferSelect
): ContentAuthor {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    title: row.title,
    bio: row.bio,
    avatarUrl: row.avatarUrl,
    url: row.url,
    x: row.x,
    linkedin: row.linkedin,
    github: row.github,
    userId: row.userId,
  };
}

/** Author id derived from a name; numbered later if it is taken. */
export function authorSlugBase(name: string) {
  return (
    slugify(name)
      .slice(0, CONTENT_AUTHOR_SLUG_MAX_LENGTH)
      .replace(TRAILING_DASHES, "") || CONTENT_AUTHOR_SLUG_FALLBACK
  );
}
