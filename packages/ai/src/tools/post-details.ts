import { POST_DETAILS_TAG_SUGGESTIONS } from "@notra/ai/constants/post-metadata";
import { supportsPostSlug } from "@notra/ai/schemas/post";
import { updatePostDetailsInputSchema } from "@notra/ai/schemas/post-metadata";
import type { PostDetailsToolsContext } from "@notra/ai/types/tools";
import {
  listOrganizationTags,
  matchExistingTags,
} from "@notra/ai/utils/post-service";
import { db } from "@notra/db/drizzle";
import { contentAuthors, posts } from "@notra/db/schema";
import { setPostHistoryContext } from "@notra/db/utils/post-history";
import { postMetadataUpdateData } from "@notra/db/utils/post-metadata";
import { type Tool, tool } from "ai";
import { and, asc, eq } from "drizzle-orm";
import z from "zod";

async function readPostDetails(context: PostDetailsToolsContext) {
  const [post, authors, tagRows] = await Promise.all([
    db.query.posts.findFirst({
      where: and(
        eq(posts.id, context.postId),
        eq(posts.organizationId, context.organizationId)
      ),
      columns: {
        contentType: true,
        coverImage: true,
        tags: true,
        excerpt: true,
        authorIds: true,
        featured: true,
        noindex: true,
        displayDate: true,
      },
    }),
    db
      .select({
        id: contentAuthors.id,
        slug: contentAuthors.slug,
        name: contentAuthors.name,
        title: contentAuthors.title,
      })
      .from(contentAuthors)
      .where(eq(contentAuthors.organizationId, context.organizationId))
      .orderBy(asc(contentAuthors.name)),
    listOrganizationTags(context.organizationId, POST_DETAILS_TAG_SUGGESTIONS),
  ]);
  if (!(post && supportsPostSlug(post.contentType))) {
    throw new Error(
      "Post details (cover, tags, authors) only exist for blog posts and changelogs."
    );
  }
  const byId = new Map(authors.map((author) => [author.id, author]));
  return {
    post,
    authors,
    details: {
      contentType: post.contentType,
      coverImage: post.coverImage,
      tags: post.tags,
      excerpt: post.excerpt,
      authors: post.authorIds
        .map((id) => byId.get(id))
        .filter((author) => author !== undefined)
        .map(({ slug, name }) => ({ slug, name })),
      featured: post.featured,
      noindex: post.noindex,
      displayDate: post.displayDate?.toISOString().slice(0, 10) ?? null,
      availableAuthors: authors.map(({ slug, name, title }) => ({
        slug,
        name,
        title,
      })),
      existingTags: tagRows,
    },
  };
}

/**
 * Lets the content chat read and change the site details shown in the
 * post's Overview tab. The post is fixed by the page, never by the model.
 */
export function createPostDetailsTools(context: PostDetailsToolsContext): {
  getPostDetails: Tool;
  updatePostDetails: Tool;
} {
  const getPostDetails = tool({
    description:
      "Reads the post's site details from the Overview tab: cover image, tags, excerpt, credited authors, featured, search visibility (noindex) and display date, plus the organization's authors and most used tags to choose from.",
    inputSchema: z.object({}),
    execute: async () => (await readPostDetails(context)).details,
  });

  const updatePostDetails = tool({
    description:
      "Changes the post's site details shown in the Overview tab. Send only the fields to change. Use for tags, excerpt/summary, cover image, authors, featured, hiding from search, or the shown date. Never use editMarkdown for these.",
    inputSchema: updatePostDetailsInputSchema,
    execute: async (input) => {
      const { post, authors } = await readPostDetails(context);
      let authorIds: string[] | undefined;
      if (input.authors) {
        const bySlug = new Map(
          authors.map((author) => [author.slug, author.id])
        );
        const unknown = input.authors.filter((slug) => !bySlug.has(slug));
        if (unknown.length > 0) {
          throw new Error(
            `Unknown author slug: ${unknown.join(", ")}. Available: ${authors.map((author) => author.slug).join(", ") || "none, the organization has no authors yet"}.`
          );
        }
        authorIds = input.authors.map((slug) => bySlug.get(slug) ?? slug);
      }
      const isBlog = post.contentType === "blog_post";
      const tags = input.tags
        ? await matchExistingTags(context.organizationId, input.tags)
        : undefined;
      await db.transaction(async (tx) => {
        await setPostHistoryContext(tx, { actorUserId: null, source: "ai" });
        await tx
          .update(posts)
          .set({
            ...postMetadataUpdateData({
              coverImage: input.coverImage,
              tags,
              excerpt: input.excerpt,
              authorIds: isBlog ? authorIds : undefined,
              featured: isBlog ? input.featured : undefined,
              noindex: isBlog ? input.noindex : undefined,
              displayDate: input.displayDate,
            }),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(posts.id, context.postId),
              eq(posts.organizationId, context.organizationId)
            )
          );
      });
      return (await readPostDetails(context)).details;
    },
  });

  return { getPostDetails, updatePostDetails };
}
