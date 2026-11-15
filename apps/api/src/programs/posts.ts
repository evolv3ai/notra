import { supportsPostSlug } from "@notra/ai/schemas/post";
import { stripLeadingFrontmatter } from "@notra/ai/utils/post-markdown";
import {
  appendContentGenerationJobEvent,
  createContentGenerationJob,
  createContentGenerationJobId,
  getContentGenerationJob,
  listContentGenerationJobEvents,
  setContentGenerationJobStatus,
  updateContentGenerationJob,
} from "@notra/content-generation/jobs";
import { contentAuthors, postCollections, posts } from "@notra/db/schema";
import { isPgUniqueViolation } from "@notra/db/utils/pg-errors";
import { buildPostCollectionName } from "@notra/db/utils/post-collections";
import { setPostHistoryContext } from "@notra/db/utils/post-history";
import {
  contentAuthorsInOrganization,
  postMetadataUpdateData,
} from "@notra/db/utils/post-metadata";
import { publishedAtForStatusChange } from "@notra/db/utils/post-published-at";
import {
  ALL_POST_CONTENT_TYPES,
  ALL_POST_STATUSES,
} from "@notra/schemas/api/content";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { Effect } from "effect";
import { nanoid } from "nanoid";

import {
  PostConcurrentModificationError,
  PostGenerationJobNotFoundError,
  PostGenerationQueueFailedError,
  PostInvalidMarkdownError,
  PostMetadataNotSupportedError,
  PostNotFoundError,
  PostSlugDuplicateError,
  PostSlugNotSupportedError,
  PostUnknownAuthorError,
  PostDatabaseError,
} from "../errors/posts";
import type {
  CommitPatchPostProgramInput,
  CreatePostGenerationProgramInput,
  CreatePostGenerationProgramSuccess,
  CreatePostProgramInput,
  CreatePostProgramSuccess,
  DeletePostProgramInput,
  DeletePostProgramSuccess,
  GetPostGenerationProgramInput,
  GetPostGenerationProgramSuccess,
  GetPostProgramInput,
  GetPostProgramSuccess,
  ListPostAuthorsProgramInput,
  ListPostAuthorsProgramSuccess,
  ListPostsProgramInput,
  ListPostsProgramSuccess,
  PatchPostProgramInput,
  PatchPostProgramSuccess,
  PostAuthorsById,
  PostAuthorSummary,
  PostRow,
  PreparePatchPostProgramSuccess,
} from "../types/posts";
import {
  addActiveGeneration,
  removeActiveGeneration,
} from "../utils/active-generations";
import { isConfirmedWorkflowTriggerRejection } from "../utils/brand-analysis";
import { triggerContentGenerationWorkflow } from "../utils/content-generation";
import {
  extractTitleFromMarkdown,
  renderMarkdownToHtml,
} from "../utils/markdown";
import {
  matchesPostUpdatedAt,
  normalizePostUpdatedAt,
  postUpdatedAtMatches,
} from "../utils/post-patch-concurrency";
import {
  collectPostAuthorIds,
  postQueryColumns,
  postReturningColumns,
  shouldApplyFilter,
} from "../utils/posts";

const database = <A>(operation: () => Promise<A>) =>
  Effect.tryPromise({
    try: operation,
    catch: (cause) => new PostDatabaseError({ cause }),
  });

function loadPostAuthors(
  input: { db: ListPostsProgramInput["db"]; organizationId: string },
  rows: readonly Pick<PostRow, "contentType" | "authorIds">[]
) {
  const authorIds = collectPostAuthorIds(rows);
  if (authorIds.length === 0) {
    return Effect.succeed<PostAuthorsById>(new Map());
  }

  return database(() =>
    input.db
      .select({
        id: contentAuthors.id,
        slug: contentAuthors.slug,
        name: contentAuthors.name,
        title: contentAuthors.title,
        avatarUrl: contentAuthors.avatarUrl,
      })
      .from(contentAuthors)
      .where(contentAuthorsInOrganization(input.organizationId, authorIds))
  ).pipe(
    Effect.map(
      (authors): PostAuthorsById =>
        new Map(
          authors.map((author): [string, PostAuthorSummary] => [
            author.id,
            author,
          ])
        )
    )
  );
}

const patchPostLookupColumns = {
  id: true,
  title: true,
  slug: true,
  contentType: true,
  status: true,
  updatedAt: true,
} as const;

type QueuedGenerationJob = Awaited<
  ReturnType<typeof createContentGenerationJob>
>;

const failPostGenerationQueue = Effect.fnUntraced(function* (
  input: CreatePostGenerationProgramInput,
  collectionId: string,
  jobId: string,
  job: QueuedGenerationJob | null,
  options: { releaseReservation: boolean; errorMessage: string }
) {
  if (options.releaseReservation) {
    yield* database(() =>
      input.db
        .delete(postCollections)
        .where(
          and(
            eq(postCollections.id, collectionId),
            eq(postCollections.organizationId, input.organizationId)
          )
        )
    );

    yield* Effect.tryPromise(() =>
      removeActiveGeneration(input.redis, input.organizationId, jobId)
    ).pipe(Effect.ignore);
  }

  let failedJobId: string | undefined;

  if (job) {
    failedJobId = yield* Effect.tryPromise(async () => {
      const failedJob = await setContentGenerationJobStatus(
        input.redis,
        jobId,
        "failed",
        { error: options.errorMessage }
      );
      return failedJob?.id;
    }).pipe(Effect.orElseSucceed(() => undefined));

    yield* Effect.tryPromise(() =>
      appendContentGenerationJobEvent(input.redis, {
        id: crypto.randomUUID(),
        jobId,
        type: "failed",
        message: options.errorMessage,
        createdAt: new Date().toISOString(),
        metadata: null,
      })
    ).pipe(Effect.ignore);
  }

  return yield* new PostGenerationQueueFailedError({
    jobId: failedJobId,
  });
});

function recoverQueueFailure(
  input: CreatePostGenerationProgramInput,
  collectionId: string,
  jobId: string,
  job: QueuedGenerationJob | null,
  releaseReservation: (error: unknown) => boolean
) {
  return Effect.catch((error: unknown) =>
    failPostGenerationQueue(input, collectionId, jobId, job, {
      releaseReservation: releaseReservation(error),
      errorMessage:
        error instanceof Error ? error.message : "Failed to trigger workflow",
    })
  );
}

const releaseBeforeWorkflowAccepted = () => true;
const keepAfterWorkflowAccepted = () => false;

const mapPostWriteError = (cause: unknown) =>
  isPgUniqueViolation(cause, "posts_org_slug_uidx")
    ? new PostSlugDuplicateError()
    : new PostDatabaseError({ cause });

export const listPosts = Effect.fn("posts.list")(function* (
  input: ListPostsProgramInput
) {
  const { limit, page, sort, status, contentType, brandIdentityId } =
    input.query;
  const offset = (page - 1) * limit;
  const whereClause = and(
    eq(posts.organizationId, input.organizationId),
    shouldApplyFilter(status, ALL_POST_STATUSES)
      ? inArray(posts.status, status)
      : undefined,
    shouldApplyFilter(contentType, ALL_POST_CONTENT_TYPES)
      ? inArray(posts.contentType, contentType)
      : undefined,
    brandIdentityId.length > 0
      ? inArray(
          sql<string>`${posts.sourceMetadata} ->> 'brandVoiceId'`,
          brandIdentityId
        )
      : undefined
  );

  const [[countResult], results] = yield* database(() =>
    Promise.all([
      input.db
        .select({ totalItems: count(posts.id) })
        .from(posts)
        .where(whereClause),
      input.db.query.posts.findMany({
        where: whereClause,
        orderBy: (table, { asc, desc }) =>
          sort === "asc"
            ? [asc(table.createdAt), asc(table.id)]
            : [desc(table.createdAt), desc(table.id)],
        limit,
        offset,
        columns: postQueryColumns(),
      }),
    ])
  );

  const authors = yield* loadPostAuthors(input, results);
  const totalItems = countResult?.totalItems ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));

  return {
    posts: results,
    authors,
    pagination: {
      limit,
      currentPage: page,
      nextPage: page < totalPages ? page + 1 : null,
      previousPage: page > 1 ? page - 1 : null,
      totalPages,
      totalItems,
    },
  } satisfies ListPostsProgramSuccess;
});

export const getPost = Effect.fn("posts.get")(function* (
  input: GetPostProgramInput
) {
  const post = yield* database(() =>
    input.db.query.posts.findFirst({
      where: and(
        eq(posts.id, input.postId),
        eq(posts.organizationId, input.organizationId)
      ),
      columns: postQueryColumns(),
    })
  );

  const authors = yield* loadPostAuthors(input, post ? [post] : []);

  return {
    post: post ?? null,
    authors,
  } satisfies GetPostProgramSuccess;
});

export const listPostAuthors = Effect.fn("posts.listAuthors")(function* (
  input: ListPostAuthorsProgramInput
) {
  const authors = yield* database(() =>
    input.db
      .select({
        id: contentAuthors.id,
        slug: contentAuthors.slug,
        name: contentAuthors.name,
        title: contentAuthors.title,
        bio: contentAuthors.bio,
        avatarUrl: contentAuthors.avatarUrl,
        url: contentAuthors.url,
        x: contentAuthors.x,
        linkedin: contentAuthors.linkedin,
        github: contentAuthors.github,
      })
      .from(contentAuthors)
      .where(eq(contentAuthors.organizationId, input.organizationId))
      .orderBy(asc(contentAuthors.name), asc(contentAuthors.id))
  );

  return { authors } satisfies ListPostAuthorsProgramSuccess;
});

export const deletePost = Effect.fn("posts.delete")(function* (
  input: DeletePostProgramInput
) {
  const [deletedPost] = yield* database(() =>
    input.db
      .delete(posts)
      .where(
        and(
          eq(posts.id, input.postId),
          eq(posts.organizationId, input.organizationId)
        )
      )
      .returning({ id: posts.id })
  );

  if (!deletedPost) {
    return yield* new PostNotFoundError();
  }

  return {
    id: deletedPost.id,
  } satisfies DeletePostProgramSuccess;
});

export const createPost = Effect.fn("posts.create")(function* (
  input: CreatePostProgramInput
) {
  const { body } = input;

  if (body.slug && !supportsPostSlug(body.contentType)) {
    return yield* new PostSlugNotSupportedError();
  }

  const markdown = stripLeadingFrontmatter(body.markdown ?? "");
  const content =
    markdown.length > 0
      ? yield* Effect.tryPromise({
          try: () => renderMarkdownToHtml(markdown),
          catch: () => new PostInvalidMarkdownError(),
        })
      : "";

  const now = new Date();
  const collectionId = nanoid();
  const postId = nanoid();

  const [createdPost] = yield* Effect.tryPromise({
    try: () =>
      input.db.transaction(async (tx) => {
        await setPostHistoryContext(tx, { actorUserId: null, source: "api" });
        await tx.insert(postCollections).values({
          id: collectionId,
          organizationId: input.organizationId,
          source: "api",
          sourceId: collectionId,
          name: buildPostCollectionName([body.contentType], now),
          nameSource: "generated",
          contentTypes: [body.contentType],
          expectedPostCount: 1,
          completedPostCount: 1,
          createdAt: now,
          updatedAt: now,
        });

        return tx
          .insert(posts)
          .values({
            id: postId,
            organizationId: input.organizationId,
            collectionId,
            title: body.title,
            slug: body.slug ?? null,
            content,
            markdown,
            contentType: body.contentType,
            status: body.status,
            publishedAt: body.status === "published" ? now : null,
            sourceMetadata: null,
            createdAt: now,
            updatedAt: now,
          })
          .returning(postReturningColumns());
      }),
    catch: mapPostWriteError,
  });

  if (!createdPost) {
    return yield* new PostDatabaseError({
      cause: new Error("Post insert returned no row"),
    });
  }

  return {
    post: createdPost,
  } satisfies CreatePostProgramSuccess;
});

export const preparePatchPost = Effect.fn("posts.preparePatch")(function* (
  input: PatchPostProgramInput
) {
  const existingPost = yield* database(() =>
    input.db.query.posts.findFirst({
      where: and(
        eq(posts.id, input.postId),
        eq(posts.organizationId, input.organizationId)
      ),
      columns: patchPostLookupColumns,
    })
  );

  if (!existingPost) {
    return yield* new PostNotFoundError();
  }

  const updateData: Partial<typeof posts.$inferInsert> = {};
  const { body } = input;
  let rederiveTitleFromMarkdown = false;

  if (body.title !== undefined) {
    updateData.title = body.title;
  }

  if (body.slug !== undefined) {
    if (!supportsPostSlug(existingPost.contentType)) {
      return yield* new PostSlugNotSupportedError();
    }

    updateData.slug = body.slug;
  }

  if (body.markdown !== undefined) {
    const markdown = stripLeadingFrontmatter(body.markdown);
    const renderedContent = yield* Effect.tryPromise({
      try: () => renderMarkdownToHtml(markdown),
      catch: () => new PostInvalidMarkdownError(),
    });

    updateData.markdown = markdown;
    updateData.content = renderedContent;

    if (body.title === undefined) {
      rederiveTitleFromMarkdown = true;
      updateData.title =
        extractTitleFromMarkdown(markdown) ?? existingPost.title;
    }
  }

  if (body.metadata !== undefined) {
    if (!supportsPostSlug(existingPost.contentType)) {
      return yield* new PostMetadataNotSupportedError();
    }

    const authorIds = body.metadata.authorIds ?? [];
    if (authorIds.length > 0) {
      const knownAuthors = yield* database(() =>
        input.db
          .select({ id: contentAuthors.id })
          .from(contentAuthors)
          .where(contentAuthorsInOrganization(input.organizationId, authorIds))
      );
      if (knownAuthors.length !== authorIds.length) {
        return yield* new PostUnknownAuthorError();
      }
    }

    Object.assign(updateData, postMetadataUpdateData(body.metadata));
  }

  if (body.status !== undefined) {
    updateData.status = body.status;
    const publishedAt = publishedAtForStatusChange(
      existingPost.status,
      body.status
    );
    if (publishedAt !== undefined) {
      updateData.publishedAt = publishedAt;
    }
  }

  return {
    prepared: {
      updateData,
      previousStatus: existingPost.status,
      expectedUpdatedAt: normalizePostUpdatedAt(existingPost.updatedAt),
      rederiveTitleFromMarkdown,
    },
  } satisfies PreparePatchPostProgramSuccess;
});

export const commitPatchPost = Effect.fn("posts.commitPatch")(function* (
  input: CommitPatchPostProgramInput
) {
  const freshPost = yield* database(() =>
    input.db.query.posts.findFirst({
      where: and(
        eq(posts.id, input.postId),
        eq(posts.organizationId, input.organizationId)
      ),
      columns: {
        id: true,
        title: true,
        updatedAt: true,
      },
    })
  );

  if (!freshPost) {
    return yield* new PostNotFoundError();
  }

  if (
    !postUpdatedAtMatches(freshPost.updatedAt, input.prepared.expectedUpdatedAt)
  ) {
    return yield* new PostConcurrentModificationError();
  }

  const updateData: Partial<typeof posts.$inferInsert> = {
    ...input.prepared.updateData,
    updatedAt: new Date(),
  };

  if (input.prepared.rederiveTitleFromMarkdown) {
    const markdown = updateData.markdown;
    if (typeof markdown === "string") {
      updateData.title = extractTitleFromMarkdown(markdown) ?? freshPost.title;
    }
  }

  const [updatedPost] = yield* Effect.tryPromise({
    try: () =>
      input.db.transaction(async (tx) => {
        await setPostHistoryContext(tx, { actorUserId: null, source: "api" });
        return await tx
          .update(posts)
          .set(updateData)
          .where(
            and(
              eq(posts.id, input.postId),
              eq(posts.organizationId, input.organizationId),
              matchesPostUpdatedAt(input.prepared.expectedUpdatedAt)
            )
          )
          .returning({
            ...postReturningColumns(),
            githubPublish: posts.githubPublish,
          });
      }),
    catch: mapPostWriteError,
  });

  if (!updatedPost) {
    return yield* new PostConcurrentModificationError();
  }

  const authors = yield* loadPostAuthors(input, [updatedPost]).pipe(
    Effect.catch(() => Effect.succeed<PostAuthorsById>(new Map()))
  );

  return {
    post: updatedPost,
    authors,
    previousStatus: input.prepared.previousStatus,
  } satisfies PatchPostProgramSuccess;
});

export const createPostGeneration = Effect.fn("posts.createGeneration")(
  function* (input: CreatePostGenerationProgramInput) {
    const now = new Date().toISOString();
    const jobId = createContentGenerationJobId();
    const collectionId = nanoid();
    const { body } = input;

    yield* database(() =>
      input.db.insert(postCollections).values({
        id: collectionId,
        organizationId: input.organizationId,
        source: "api",
        sourceId: jobId,
        name: buildPostCollectionName([body.contentType], new Date(now)),
        nameSource: "generated",
        contentTypes: [body.contentType],
        expectedPostCount: 1,
        completedPostCount: 0,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      })
    );

    const job = yield* Effect.tryPromise({
      try: () =>
        createContentGenerationJob(input.redis, {
          id: jobId,
          organizationId: input.organizationId,
          status: "queued",
          contentType: body.contentType,
          lookbackWindow: body.lookbackWindow,
          repositoryIds: input.repositoryIds ?? [],
          brandVoiceId: input.resolvedBrandVoiceId,
          workflowRunId: null,
          postId: null,
          error: null,
          source: "api",
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        }),
      catch: (cause) => cause,
    }).pipe(
      recoverQueueFailure(
        input,
        collectionId,
        jobId,
        null,
        releaseBeforeWorkflowAccepted
      )
    );

    yield* Effect.tryPromise({
      try: () =>
        addActiveGeneration(input.redis, input.organizationId, {
          runId: jobId,
          triggerId: "api_on_demand",
          outputType: body.contentType,
          triggerName: body.contentType,
          startedAt: now,
          source: "api",
        }),
      catch: (cause) => cause,
    }).pipe(
      recoverQueueFailure(
        input,
        collectionId,
        jobId,
        job,
        releaseBeforeWorkflowAccepted
      )
    );

    yield* Effect.tryPromise({
      try: () =>
        appendContentGenerationJobEvent(input.redis, {
          id: crypto.randomUUID(),
          jobId,
          type: "queued",
          message: `Queued ${body.contentType.replaceAll("_", " ")} generation`,
          createdAt: now,
          metadata: {
            lookbackWindow: body.lookbackWindow,
            repositoryCount: input.repositoryIds?.length ?? 0,
            linearIntegrationCount: input.linearIntegrationIds?.length ?? 0,
          },
        }),
      catch: (cause) => cause,
    }).pipe(
      recoverQueueFailure(
        input,
        collectionId,
        jobId,
        job,
        releaseBeforeWorkflowAccepted
      )
    );

    const workflowRunId = yield* Effect.tryPromise({
      try: () =>
        triggerContentGenerationWorkflow(input.runtimeEnv, {
          organizationId: input.organizationId,
          collectionId,
          jobId,
          runId: jobId,
          contentType: body.contentType,
          lookbackWindow: body.lookbackWindow,
          timezone: body.timezone,
          repositoryIds: input.repositoryIds,
          linearIntegrationIds: input.linearIntegrationIds,
          brandVoiceId: input.resolvedBrandVoiceId ?? undefined,
          dataPoints: body.dataPoints,
          selectedItems: body.selectedItems,
          aiCreditReserved: false,
          aiCreditMarkup: false,
          source: "api",
        }),
      catch: (cause) => cause,
    }).pipe(
      recoverQueueFailure(
        input,
        collectionId,
        jobId,
        job,
        isConfirmedWorkflowTriggerRejection
      )
    );

    const updatedJob = yield* Effect.tryPromise({
      try: () =>
        updateContentGenerationJob(input.redis, jobId, {
          workflowRunId,
        }),
      catch: (cause) => cause,
    }).pipe(
      recoverQueueFailure(
        input,
        collectionId,
        jobId,
        job,
        keepAfterWorkflowAccepted
      )
    );

    yield* Effect.tryPromise({
      try: () =>
        appendContentGenerationJobEvent(input.redis, {
          id: crypto.randomUUID(),
          jobId,
          type: "workflow_triggered",
          message: "Triggered content generation workflow",
          createdAt: new Date().toISOString(),
          metadata: { workflowRunId },
        }),
      catch: (cause) => cause,
    }).pipe(
      recoverQueueFailure(
        input,
        collectionId,
        jobId,
        job,
        keepAfterWorkflowAccepted
      )
    );

    return {
      job: updatedJob ?? job,
    } satisfies CreatePostGenerationProgramSuccess;
  }
);

export const getPostGeneration = Effect.fn("posts.getGeneration")(function* (
  input: GetPostGenerationProgramInput
) {
  const job = yield* database(() =>
    getContentGenerationJob(input.redis, input.jobId)
  );

  if (!job || job.organizationId !== input.organizationId) {
    return yield* new PostGenerationJobNotFoundError();
  }

  const events = yield* database(() =>
    listContentGenerationJobEvents(input.redis, input.jobId)
  );

  return {
    job,
    events,
  } satisfies GetPostGenerationProgramSuccess;
});
