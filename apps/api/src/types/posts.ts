import type { ContentGenerationJob } from "@notra/content-generation/schemas";
import type { contentAuthors, posts } from "@notra/db/schema";
import type {
  createPostGenerationRequestSchema,
  createPostRequestSchema,
  getPostsOpenApiQuerySchema,
  patchPostRequestSchema,
} from "@notra/schemas/api/content";
import type { Redis } from "@upstash/redis";
import type { z } from "zod";

import type {
  PostConcurrentModificationError,
  PostGenerationJobNotFoundError,
  PostGenerationQueueFailedError,
  PostGenerationSourcesUnavailableError,
  PostGenerationTargetUnavailableError,
  PostInvalidMarkdownError,
  PostMetadataNotSupportedError,
  PostNotFoundError,
  PostSlugDuplicateError,
  PostSlugNotSupportedError,
  PostUnknownAuthorError,
} from "../errors/posts";
import type { DbClient } from "./db";

export type PostRow = Pick<
  typeof posts.$inferSelect,
  | "id"
  | "title"
  | "slug"
  | "content"
  | "htmlUrl"
  | "markdown"
  | "recommendations"
  | "contentType"
  | "sourceMetadata"
  | "coverImage"
  | "tags"
  | "excerpt"
  | "authorIds"
  | "featured"
  | "noindex"
  | "hidden"
  | "displayDate"
  | "status"
  | "createdAt"
  | "updatedAt"
>;

export type PostAuthorSummary = Pick<
  typeof contentAuthors.$inferSelect,
  "id" | "slug" | "name" | "title" | "avatarUrl"
>;

export type PostAuthorsById = ReadonlyMap<string, PostAuthorSummary>;

type ContentAuthorRow = Pick<
  typeof contentAuthors.$inferSelect,
  | "id"
  | "slug"
  | "name"
  | "title"
  | "bio"
  | "avatarUrl"
  | "url"
  | "x"
  | "linkedin"
  | "github"
>;

export type PostDomainError =
  | PostNotFoundError
  | PostSlugNotSupportedError
  | PostMetadataNotSupportedError
  | PostUnknownAuthorError
  | PostInvalidMarkdownError
  | PostSlugDuplicateError
  | PostConcurrentModificationError
  | PostGenerationJobNotFoundError
  | PostGenerationQueueFailedError
  | PostGenerationSourcesUnavailableError
  | PostGenerationTargetUnavailableError;

interface PostProgramInput {
  db: DbClient;
  organizationId: string;
}

export interface ListPostsProgramInput extends PostProgramInput {
  query: z.infer<typeof getPostsOpenApiQuerySchema>;
}

export interface ListPostsProgramSuccess {
  posts: PostRow[];
  authors: PostAuthorsById;
  pagination: {
    limit: number;
    currentPage: number;
    nextPage: number | null;
    previousPage: number | null;
    totalPages: number;
    totalItems: number;
  };
}

export interface GetPostProgramInput extends PostProgramInput {
  postId: string;
}

export interface GetPostProgramSuccess {
  post: PostRow | null;
  authors: PostAuthorsById;
}

export interface ListPostAuthorsProgramInput extends PostProgramInput {}

export interface ListPostAuthorsProgramSuccess {
  authors: ContentAuthorRow[];
}

export interface DeletePostProgramInput extends PostProgramInput {
  postId: string;
}

export interface DeletePostProgramSuccess {
  id: string;
}

export interface CreatePostProgramInput extends PostProgramInput {
  body: z.infer<typeof createPostRequestSchema>;
}

export interface CreatePostProgramSuccess {
  post: PostRow;
}

export interface PatchPostProgramInput extends PostProgramInput {
  postId: string;
  body: z.infer<typeof patchPostRequestSchema>;
}

interface PatchPostPreparedUpdate {
  updateData: Partial<typeof posts.$inferInsert>;
  previousStatus: "draft" | "published";
  expectedUpdatedAt: Date;
  rederiveTitleFromMarkdown: boolean;
}

export interface PreparePatchPostProgramSuccess {
  prepared: PatchPostPreparedUpdate;
}

export interface CommitPatchPostProgramInput extends PostProgramInput {
  postId: string;
  prepared: PatchPostPreparedUpdate;
}

export interface PatchPostProgramSuccess {
  post: PostRow;
  authors: PostAuthorsById;
  previousStatus: "draft" | "published";
}

export interface CreatePostGenerationProgramInput extends PostProgramInput {
  body: z.infer<typeof createPostGenerationRequestSchema>;
  redis: Redis;
  runtimeEnv: {
    WORKFLOW_BASE_URL?: string;
  };
  repositoryIds: string[] | undefined;
  linearIntegrationIds: string[] | undefined;
  resolvedBrandVoiceId: string | null;
}

export interface CreatePostGenerationProgramSuccess {
  job: ContentGenerationJob;
}

export interface GetPostGenerationProgramInput {
  organizationId: string;
  jobId: string;
  redis: Redis;
}

export interface GetPostGenerationProgramSuccess {
  job: ContentGenerationJob;
  events: Awaited<
    ReturnType<
      typeof import("@notra/content-generation/jobs").listContentGenerationJobEvents
    >
  >;
}
