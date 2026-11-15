import { createHash } from "node:crypto";

import type { ScheduledPublicationPost } from "@/types/content/scheduled-publications";

export function postContentHash(
  post: Pick<ScheduledPublicationPost, "slug" | "title" | "markdown"> &
    Partial<ScheduledPublicationPost>
) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        post.slug,
        post.title,
        post.markdown,
        post.coverImage,
        post.tags,
        post.excerpt,
        post.authorIds,
        post.featured,
        post.hidden,
        post.noindex,
        post.displayDate,
      ])
    )
    .digest("hex");
}

export function matchesPostContentHash(
  stored: string,
  post: Parameters<typeof postContentHash>[0]
) {
  const legacy = createHash("sha256")
    .update(JSON.stringify([post.slug, post.title, post.markdown]))
    .digest("hex");
  return stored === postContentHash(post) || stored === legacy;
}
