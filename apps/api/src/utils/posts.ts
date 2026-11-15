import { supportsPostSlug } from "@notra/ai/schemas/post";
import { posts } from "@notra/db/schema";
import { extractImageArtifactHtml } from "@notra/db/utils/post-image-artifacts";
import { GEO_WRITER_TRIGGER_ID } from "@notra/geo-core/constants/geo";
import { isGeoBriefMarkdown } from "@notra/geo-core/utils/geo-writer-brief-markdown";
import type {
  ALL_POST_CONTENT_TYPES,
  patchPostRequestSchema,
} from "@notra/schemas/api/content";
import { Effect } from "effect";
import type { Context } from "hono";
import type { z } from "zod";

import type { PostDatabaseError } from "../errors/posts";
import type { PostAuthorsById, PostDomainError, PostRow } from "../types/posts";

type PostResponseContentType = (typeof ALL_POST_CONTENT_TYPES)[number];

const NO_AUTHORS: PostAuthorsById = new Map();

export function shouldApplyFilter(
  selectedValues: readonly string[],
  allValues: readonly string[]
) {
  return selectedValues.length < allValues.length;
}

/** Stored as UTC midnight; the API speaks plain YYYY-MM-DD dates. */
function formatDisplayDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
}

function serializePostMetadata(post: PostRow, authors: PostAuthorsById) {
  if (!supportsPostSlug(post.contentType)) {
    return null;
  }

  return {
    coverImage: post.coverImage
      ? { url: post.coverImage.url, alt: post.coverImage.alt }
      : null,
    tags: post.tags,
    excerpt: post.excerpt,
    authors: post.authorIds.flatMap((authorId) => {
      const author = authors.get(authorId);
      return author
        ? [
            {
              id: author.id,
              slug: author.slug,
              name: author.name,
              title: author.title,
              avatarUrl: author.avatarUrl,
            },
          ]
        : [];
    }),
    featured: post.featured,
    noindex: post.noindex,
    hidden: post.hidden,
    displayDate: formatDisplayDate(post.displayDate),
  };
}

export function collectPostAuthorIds(
  rows: readonly Pick<PostRow, "contentType" | "authorIds">[]
) {
  const ids = new Set<string>();
  for (const row of rows) {
    if (supportsPostSlug(row.contentType)) {
      for (const id of row.authorIds) {
        ids.add(id);
      }
    }
  }
  return [...ids];
}

export function serializePost(
  post: PostRow,
  authors: PostAuthorsById = NO_AUTHORS
) {
  const isImage = post.contentType === "image";

  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    content: post.content,
    htmlUrl: post.contentType === "image" ? (post.htmlUrl ?? null) : null,
    markdown: isImage ? null : post.markdown,
    rawHtml: isImage ? extractImageArtifactHtml(post.sourceMetadata) : null,
    recommendations: post.recommendations,
    contentType: post.contentType as PostResponseContentType,
    sourceMetadata: post.sourceMetadata,
    metadata: serializePostMetadata(post, authors),
    status: post.status,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

function geoWriterBriefId(sourceMetadata: unknown): string | null {
  if (typeof sourceMetadata !== "object" || sourceMetadata === null) {
    return null;
  }
  const { triggerId, briefId } = sourceMetadata as Record<string, unknown>;
  return triggerId === GEO_WRITER_TRIGGER_ID && typeof briefId === "string"
    ? briefId
    : null;
}

/** Wide-event fields for a post update. Never includes the content itself. */
export function postPatchLogFields(
  body: z.infer<typeof patchPostRequestSchema>,
  post: PostRow
) {
  const briefId = geoWriterBriefId(post.sourceMetadata);
  return {
    postId: post.id,
    postContentType: post.contentType,
    postStatus: post.status,
    postFieldsUpdated: Object.keys(body).sort().join(","),
    postMarkdownChars: body.markdown?.length,
    geoBriefId: briefId ?? undefined,
    geoBriefMarkdownIsOutline:
      briefId && post.markdown !== null
        ? isGeoBriefMarkdown(post.markdown)
        : undefined,
  };
}

export function postQueryColumns() {
  return {
    id: true,
    title: true,
    slug: true,
    content: true,
    htmlUrl: true,
    markdown: true,
    recommendations: true,
    contentType: true,
    sourceMetadata: true,
    coverImage: true,
    tags: true,
    excerpt: true,
    authorIds: true,
    featured: true,
    noindex: true,
    hidden: true,
    displayDate: true,
    status: true,
    createdAt: true,
    updatedAt: true,
  } as const;
}

export function postReturningColumns() {
  return {
    id: posts.id,
    title: posts.title,
    slug: posts.slug,
    content: posts.content,
    htmlUrl: posts.htmlUrl,
    markdown: posts.markdown,
    recommendations: posts.recommendations,
    contentType: posts.contentType,
    sourceMetadata: posts.sourceMetadata,
    coverImage: posts.coverImage,
    tags: posts.tags,
    excerpt: posts.excerpt,
    authorIds: posts.authorIds,
    featured: posts.featured,
    noindex: posts.noindex,
    hidden: posts.hidden,
    displayDate: posts.displayDate,
    status: posts.status,
    createdAt: posts.createdAt,
    updatedAt: posts.updatedAt,
  };
}

export function runPostProgram<A, E extends PostDomainError>(
  program: Effect.Effect<A, E | PostDatabaseError>
) {
  return Effect.runPromise(
    Effect.result(
      program.pipe(
        Effect.catchTag("PostDatabaseError", (failure) =>
          Effect.die(failure.cause)
        )
      )
    )
  );
}

export function respondToPostFailure(c: Context, failure: PostDomainError) {
  if (failure._tag === "PostNotFoundError") {
    return c.json({ error: "Post not found" }, 404);
  }

  if (failure._tag === "PostSlugNotSupportedError") {
    return c.json(
      { error: "Slug can only be set for blog posts and changelogs" },
      400
    );
  }

  if (failure._tag === "PostMetadataNotSupportedError") {
    return c.json(
      { error: "Metadata can only be set for blog posts and changelogs" },
      400
    );
  }

  if (failure._tag === "PostUnknownAuthorError") {
    return c.json(
      {
        error:
          "metadata.authorIds contains an author that does not exist in this organization. List valid IDs with GET /v1/posts/authors.",
      },
      400
    );
  }

  if (failure._tag === "PostInvalidMarkdownError") {
    return c.json({ error: "Invalid markdown content" }, 400);
  }

  if (failure._tag === "PostSlugDuplicateError") {
    return c.json({ error: "A post with this slug already exists" }, 409);
  }

  if (failure._tag === "PostConcurrentModificationError") {
    return c.json(
      { error: "Post was modified by another request; retry the update" },
      409
    );
  }

  if (failure._tag === "PostGenerationJobNotFoundError") {
    return c.json({ error: "Generation job not found" }, 404);
  }

  if (failure._tag === "PostGenerationTargetUnavailableError") {
    return c.json({ error: failure.message }, 400);
  }

  if (failure._tag === "PostGenerationSourcesUnavailableError") {
    return c.json({ error: failure.message, code: failure.code }, 400);
  }

  return c.json(
    {
      error: "Failed to queue content generation",
      ...(failure.jobId ? { jobId: failure.jobId } : {}),
    },
    503
  );
}
