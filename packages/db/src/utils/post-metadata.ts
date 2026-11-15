import { and, eq, inArray } from "drizzle-orm";

import { contentAuthors, type posts } from "../schema";
import type { PostMetadataColumnsPatch } from "../types/post-metadata";

/** Display dates are calendar days, stored at UTC midnight. */
function parsePostDisplayDate(date: string | null): Date | null {
  return date ? new Date(`${date}T00:00:00.000Z`) : null;
}

/** Column updates for a metadata patch; omitted fields stay untouched. */
export function postMetadataUpdateData(
  metadata: PostMetadataColumnsPatch
): Partial<typeof posts.$inferInsert> {
  return {
    ...(metadata.coverImage === undefined
      ? {}
      : { coverImage: metadata.coverImage }),
    ...(metadata.tags === undefined ? {} : { tags: metadata.tags }),
    ...(metadata.excerpt === undefined
      ? {}
      : { excerpt: metadata.excerpt || null }),
    ...(metadata.authorIds === undefined
      ? {}
      : { authorIds: metadata.authorIds }),
    ...(metadata.featured === undefined ? {} : { featured: metadata.featured }),
    ...(metadata.noindex === undefined ? {} : { noindex: metadata.noindex }),
    ...(metadata.hidden === undefined ? {} : { hidden: metadata.hidden }),
    ...(metadata.displayDate === undefined
      ? {}
      : { displayDate: parsePostDisplayDate(metadata.displayDate) }),
  };
}

export function contentAuthorsInOrganization(
  organizationId: string,
  authorIds: readonly string[]
) {
  return and(
    eq(contentAuthors.organizationId, organizationId),
    inArray(contentAuthors.id, [...authorIds])
  );
}
