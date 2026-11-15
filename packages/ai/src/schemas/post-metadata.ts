// biome-ignore lint/performance/noNamespaceImport: Zod recommended way to import
import * as z from "zod";

import {
  POST_AUTHORS_MAX,
  POST_COVER_ALT_MAX_LENGTH,
  POST_COVER_URL_MAX_LENGTH,
  POST_EXCERPT_MAX_LENGTH,
  POST_GENERATED_TAGS_MAX,
  POST_TAG_MAX_LENGTH,
  POST_TAGS_MAX,
} from "../constants/post-metadata";

/**
 * An https URL, or a path to Notra's own upload route. Plain http is
 * rejected: hosted sites are https-only and refuse mixed content.
 */
function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}

export const postMediaUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(POST_COVER_URL_MAX_LENGTH)
  .refine((value) => value.startsWith("/api/uploads/") || isHttpsUrl(value), {
    error: "Use an https URL or an uploaded image",
  });

export const postCoverImageSchema = z.object({
  url: postMediaUrlSchema,
  alt: z.string().trim().max(POST_COVER_ALT_MAX_LENGTH).default(""),
});

/** Trims, drops empties and case-insensitive duplicates, keeps first spelling. */
export const postTagsSchema = z
  .array(z.string().trim().max(POST_TAG_MAX_LENGTH))
  .max(POST_TAGS_MAX)
  .transform((tags) => {
    const seen = new Set<string>();
    return tags.filter((tag) => {
      const key = tag.toLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  });

/** Empty or null: derive the summary from the first paragraph again. */
export const postExcerptPatchSchema = z
  .string()
  .trim()
  .max(POST_EXCERPT_MAX_LENGTH)
  .nullable();

/**
 * Site metadata a writer agent fills in while creating a blog post or
 * changelog. Both are optional: the site falls back to the first paragraph,
 * and posts without tags simply show none.
 */
export const generatedPostMetadataShape = {
  tags: z
    .array(z.string().trim().min(1).max(POST_TAG_MAX_LENGTH))
    .max(POST_GENERATED_TAGS_MAX)
    .optional()
    .describe(
      `Optional, blog posts and changelogs only: 1-${POST_GENERATED_TAGS_MAX} short topic tags in Title Case (e.g. "Product", "Engineering"). Reuse the organization's existing tags when they fit; skip when nothing fits.`
    ),
  excerpt: z
    .string()
    .trim()
    .max(POST_EXCERPT_MAX_LENGTH)
    .optional()
    .describe(
      "Optional, blog posts and changelogs only: a one-sentence summary for the blog card, search results and link previews, ideally under 160 characters. Plain text, no markdown."
    ),
};

/** Content chat tool: change a post's site details. Omitted fields stay. */
export const updatePostDetailsInputSchema = z.object({
  tags: postTagsSchema
    .optional()
    .describe(
      "Replaces all tags. Short Title Case topics; reuse existing tags from getPostDetails when they fit. [] removes all tags."
    ),
  excerpt: postExcerptPatchSchema
    .optional()
    .describe(
      "One-sentence plain-text summary for cards, search results and link previews, ideally under 160 characters. null goes back to the first paragraph."
    ),
  coverImage: postCoverImageSchema
    .nullable()
    .optional()
    .describe(
      "Cover image: an https URL or an image URL that already appears in the post, with alt text. null removes the cover."
    ),
  authors: z
    .array(z.string().trim().min(1))
    .max(POST_AUTHORS_MAX)
    .transform((slugs) => [...new Set(slugs)])
    .optional()
    .describe(
      "Replaces the credited authors, by author slug from getPostDetails, in display order. [] credits whoever publishes."
    ),
  featured: z
    .boolean()
    .optional()
    .describe(
      "Blog posts only: pin the post to the top of the blog home page."
    ),
  noindex: z
    .boolean()
    .optional()
    .describe(
      "Blog posts only: true hides the post from search engines, the sitemap and llms.txt; it stays reachable by link."
    ),
  displayDate: z.iso
    .date()
    .nullable()
    .optional()
    .describe(
      "Date shown on the site as YYYY-MM-DD. null uses the publish date."
    ),
});
