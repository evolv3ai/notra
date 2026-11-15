import { postCoverImageSchema } from "@notra/ai/schemas/post-metadata";
import type { ContentResponse } from "@notra/schemas/dashboard/content";
import type { PostMetadataPatch } from "@notra/schemas/shared/post-metadata";
import { fromMarkdown } from "mdast-util-from-markdown";

import type { ContentApiResponse } from "@/types/hooks/content";
import type { SiteMarkdownNode } from "@/types/integrations/site-github-publish";

export function mergeContentMetadataSave(
  current: ContentApiResponse | undefined,
  content: ContentResponse,
  preserveOptimisticMetadata: boolean
): ContentApiResponse | undefined {
  if (
    !current ||
    current.content.id !== content.id ||
    current.content.revision > content.revision
  ) {
    return current;
  }
  return {
    ...current,
    content: preserveOptimisticMetadata
      ? { ...content, metadata: current.content.metadata }
      : content,
  };
}

/** The post's metadata with a patch applied, for optimistic updates. */
export function applyMetadataPatch(
  metadata: ContentResponse["metadata"],
  patch: PostMetadataPatch
): ContentResponse["metadata"] {
  return {
    coverImage:
      patch.coverImage === undefined ? metadata.coverImage : patch.coverImage,
    tags: patch.tags ?? metadata.tags,
    excerpt:
      patch.excerpt === undefined ? metadata.excerpt : patch.excerpt || null,
    authorIds: patch.authorIds ?? metadata.authorIds,
    featured: patch.featured ?? metadata.featured,
    noindex: patch.noindex ?? metadata.noindex,
    hidden: patch.hidden ?? metadata.hidden,
    displayDate:
      patch.displayDate === undefined
        ? metadata.displayDate
        : patch.displayDate,
  };
}

/** Images in the post that could serve as its cover, without duplicates. */
export function coverCandidatesInMarkdown(markdown: string): string[] {
  const urls: string[] = [];
  const visit = (node: SiteMarkdownNode) => {
    if (node.type === "image" && node.url) {
      urls.push(node.url);
    }
    for (const child of node.children ?? []) {
      visit(child);
    }
  };
  visit(fromMarkdown(markdown) as SiteMarkdownNode);
  return [...new Set(urls)].filter(
    (url) => postCoverImageSchema.shape.url.safeParse(url).success
  );
}

/** A YYYY-MM-DD day as a local date, so the calendar shows the same day. */
export function displayDateToLocalDate(value: string): Date {
  const [year = 1970, month = 1, day = 1] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** The picked calendar day as YYYY-MM-DD, without a timezone shift. */
export function localDateToDisplayDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
