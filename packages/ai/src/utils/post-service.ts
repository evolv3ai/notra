import { getChatProjectId } from "@notra/ai/chat/history";
import { maybeGenerateCollectionTitle } from "@notra/ai/jobs/collection-title";
import { POST_SLUG_MAX_LENGTH, supportsPostSlug } from "@notra/ai/schemas/post";
import { postTagsSchema } from "@notra/ai/schemas/post-metadata";
import type {
  CreatePostRecordParams,
  CreatePostRecordResult,
  EnsureChatPostCollectionParams,
  PostDatabase,
  UpdatePostRecordParams,
  UpdatePostRecordResult,
  UpdatePostSiteMetadataParams,
} from "@notra/ai/types/post-service";
import { stripLeadingFrontmatter } from "@notra/ai/utils/post-markdown";
import { sanitizeMarkdownHtml } from "@notra/ai/utils/sanitize";
import { db } from "@notra/db/drizzle";
import { postCollections, posts } from "@notra/db/schema";
import { isPgUniqueViolation } from "@notra/db/utils/pg-errors";
import { buildPostCollectionName } from "@notra/db/utils/post-collections";
import { setPostHistoryContext } from "@notra/db/utils/post-history";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { marked } from "marked";
import { customAlphabet } from "nanoid";

const generatePostId = customAlphabet(
  "abcdefghijklmnopqrstuvwxyz0123456789",
  16
);

export function isPostSlugConflict(error: unknown): boolean {
  return isPgUniqueViolation(error, "posts_org_slug_uidx");
}

function uniquifySlug(slug: string, n: number) {
  const suffix = `-${n}`;
  return `${slug.slice(0, POST_SLUG_MAX_LENGTH - suffix.length)}${suffix}`;
}

/** The organization's tags, most used first. */
export async function listOrganizationTags(
  organizationId: string,
  limit: number
): Promise<string[]> {
  const result = await db.execute<{ tag: string }>(sql`
    select tag
    from ${posts}
    cross join lateral unnest(${posts.tags}) as post_tag(tag)
    where ${posts.organizationId} = ${organizationId}
    group by tag
    order by count(*) desc, tag
    limit ${limit}
  `);
  return result.rows.map((row) => row.tag);
}

/**
 * Maps tags a model wrote onto the spelling the organization already uses,
 * so "product" joins the existing "Product" tag instead of starting a new one.
 */
export async function matchExistingTags(
  organizationId: string,
  tags: readonly string[]
): Promise<string[]> {
  const parsed = postTagsSchema.safeParse(tags);
  if (!parsed.success || parsed.data.length === 0) {
    return [];
  }
  const keys = parsed.data.map((tag) => tag.toLowerCase());
  const existing = await db.execute<{ tag: string }>(sql`
    select tag
    from ${posts}
    cross join lateral unnest(${posts.tags}) as post_tag(tag)
    where ${posts.organizationId} = ${organizationId}
      and lower(tag) in (${sql.join(
        keys.map((key) => sql`${key}`),
        sql`, `
      )})
    group by tag
    order by count(*) desc, tag
  `);
  const byKey = new Map<string, string>();
  for (const { tag } of existing.rows) {
    if (!byKey.has(tag.toLowerCase())) {
      byKey.set(tag.toLowerCase(), tag);
    }
  }
  return parsed.data.map((value) => byKey.get(value.toLowerCase()) ?? value);
}

/** Writes tags and excerpt a writer picked onto an existing post; unset fields stay. */
export async function updatePostSiteMetadata(
  params: UpdatePostSiteMetadataParams
): Promise<void> {
  const tags = params.tags
    ? await matchExistingTags(params.organizationId, params.tags)
    : undefined;
  const excerpt = params.excerpt?.trim() || undefined;
  if (!(tags?.length || excerpt)) {
    return;
  }
  await db.transaction(async (tx) => {
    await setPostHistoryContext(tx, { actorUserId: null, source: "ai" });
    await tx
      .update(posts)
      .set({
        ...(tags?.length ? { tags } : {}),
        ...(excerpt ? { excerpt } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(posts.id, params.postId),
          eq(posts.organizationId, params.organizationId)
        )
      );
  });
}

export async function createPostRecord(
  params: CreatePostRecordParams
): Promise<CreatePostRecordResult> {
  const id = params.postId ?? generatePostId();
  const markdown = stripLeadingFrontmatter(params.markdown);
  const content = sanitizeMarkdownHtml(await marked.parse(markdown));
  const baseSlug = params.slug ?? null;
  const hasSiteMetadata = supportsPostSlug(params.contentType);
  const tags =
    hasSiteMetadata && params.tags
      ? await matchExistingTags(params.organizationId, params.tags)
      : [];
  const excerpt = hasSiteMetadata ? params.excerpt?.trim() || null : null;

  const insert = async (slug: string | null) =>
    db.transaction(async (tx) => {
      await setPostHistoryContext(tx, { actorUserId: null, source: "ai" });
      const inserted = await tx
        .insert(posts)
        .values({
          id,
          organizationId: params.organizationId,
          collectionId: params.collectionId,
          title: params.title,
          slug,
          content,
          markdown,
          recommendations: params.recommendations ?? null,
          contentType: params.contentType,
          contentSubtype: params.contentSubtype ?? null,
          status: params.autoPublish ? "published" : "draft",
          publishedAt: params.autoPublish ? new Date() : null,
          sourceMetadata: params.sourceMetadata ?? null,
          tags,
          excerpt,
        })
        .onConflictDoNothing({ target: posts.id })
        .returning({ id: posts.id });

      if (inserted.length === 0) {
        return true;
      }

      await tx
        .update(postCollections)
        .set({
          completedPostCount: sql`${postCollections.completedPostCount} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(postCollections.id, params.collectionId),
            eq(postCollections.organizationId, params.organizationId)
          )
        );
      return false;
    });

  let slug = baseSlug;
  let deduplicated = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      deduplicated = await insert(slug);
      break;
    } catch (error) {
      if (
        !(
          baseSlug &&
          isPgUniqueViolation(error, "posts_org_slug_uidx") &&
          attempt < 5
        )
      ) {
        throw error;
      }
      slug = uniquifySlug(baseSlug, attempt + 2);
    }
  }

  if (!deduplicated) {
    await maybeGenerateCollectionTitle({
      collectionId: params.collectionId,
      organizationId: params.organizationId,
    });
  }

  return { postId: id, deduplicated };
}

function expectedMarkdownCondition(expected: string | null | undefined) {
  if (expected === undefined) {
    return undefined;
  }
  return expected === null
    ? isNull(posts.markdown)
    : eq(posts.markdown, expected);
}

export async function updatePostRecord(
  params: UpdatePostRecordParams,
  database: PostDatabase = db
): Promise<UpdatePostRecordResult> {
  const updates: Record<string, string | null> = {};
  if (params.title !== undefined) {
    updates.title = params.title;
  }
  if (params.slug !== undefined) {
    updates.slug = params.slug;
  }
  if (params.markdown !== undefined) {
    const markdown = stripLeadingFrontmatter(params.markdown);
    updates.content = sanitizeMarkdownHtml(await marked.parse(markdown));
    updates.markdown = markdown;
  }
  if (params.recommendations !== undefined) {
    updates.recommendations = params.recommendations;
  }
  if (params.contentSubtype !== undefined) {
    updates.contentSubtype = params.contentSubtype;
  }

  if (Object.keys(updates).length === 0) {
    return { status: "no_changes" };
  }

  const rows = await database
    .update(posts)
    .set(updates)
    .where(
      and(
        eq(posts.id, params.postId),
        eq(posts.organizationId, params.organizationId),
        expectedMarkdownCondition(params.expectedMarkdown)
      )
    )
    .returning({ id: posts.id });

  return { status: rows.length === 0 ? "not_found" : "updated" };
}

export async function updateAiPostRecord(
  params: UpdatePostRecordParams
): Promise<UpdatePostRecordResult> {
  return await db.transaction(async (tx) => {
    await setPostHistoryContext(tx, { actorUserId: null, source: "ai" });
    return await updatePostRecord(params, tx);
  });
}

export async function ensureChatPostCollection(
  params: EnsureChatPostCollectionParams
): Promise<string> {
  const now = new Date();
  const contentTypesJson = JSON.stringify([params.contentType]);
  const projectId = params.chatId
    ? await getChatProjectId(params.organizationId, params.chatId)
    : null;

  const [collection] = await db
    .insert(postCollections)
    .values({
      id: generatePostId(),
      organizationId: params.organizationId,
      projectId,
      source: "chat",
      sourceId: params.chatId ?? null,
      name: buildPostCollectionName([params.contentType], now),
      nameSource: "generated",
      contentTypes: [params.contentType],
      expectedPostCount: null,
      completedPostCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        postCollections.organizationId,
        postCollections.source,
        postCollections.sourceId,
      ],
      targetWhere: and(
        eq(postCollections.source, "chat"),
        isNotNull(postCollections.sourceId)
      ),
      set: {
        projectId,
        contentTypes: sql`CASE
          WHEN ${postCollections.contentTypes} @> ${contentTypesJson}::jsonb
            THEN ${postCollections.contentTypes}
          ELSE ${postCollections.contentTypes} || ${contentTypesJson}::jsonb
        END`,
        updatedAt: now,
      },
    })
    .returning({ id: postCollections.id });

  if (!collection) {
    throw new Error("Failed to create the chat post collection");
  }

  return collection.id;
}
