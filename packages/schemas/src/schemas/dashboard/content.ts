import "zod/compile";
import {
  chatIdSchema,
  chatModelSchema,
  thinkingLevelSchema,
  UI_MESSAGES_MAX,
  uiMessageSchema,
} from "@notra/ai/schemas/chat";
import { contentTypeSchema } from "@notra/ai/schemas/content";
import {
  POST_MARKDOWN_MAX_LENGTH,
  POST_TITLE_MAX_LENGTH,
} from "@notra/ai/schemas/limits";
import { createContentGenerationRequestSchema } from "@notra/content-generation/schemas";
import { BLOG_POST_SUBTYPES } from "@notra/db/constants/content";
import type { PostGitHubPublish } from "@notra/db/types/post-github-publish";
// biome-ignore lint/performance/noNamespaceImport: Zod recommended way to import
import * as z from "zod";

import {
  GITHUB_CONTENT_PATH_MAX_LENGTH,
  GITHUB_PUBLISH_CONTENT_TYPES,
} from "../../constants/dashboard/github";
import { ALLOWED_VIDEO_MIME_TYPES } from "../../constants/dashboard/upload";
import { createPostFieldsSchema, postSlugSchema } from "../shared/post";
import {
  contentAuthorFieldsSchema,
  postMetadataPatchSchema,
  postMetadataSchema,
} from "../shared/post-metadata";
import {
  LOOKBACK_WINDOWS,
  repositoryContentFilePathSchema,
  repositoryRelativePathSchema,
  SUPPORTED_AUTOMATION_OUTPUT_TYPES,
} from "./integrations";

export const postStatusSchema = z.enum(["draft", "published"]);
export type PostStatus = z.infer<typeof postStatusSchema>;

export const socialVideoAttachmentSchema = z.object({
  key: z.string().min(1),
  url: z.url().max(2048),
  mimeType: z.enum(ALLOWED_VIDEO_MIME_TYPES),
  size: z.number().int().positive(),
});

export const sourceMetadataSchema = z
  .looseObject({
    triggerId: z.string().optional(),
    triggerSourceType: z.string().optional(),
    repositories: z
      .array(z.object({ owner: z.string(), repo: z.string() }))
      .optional(),
    linearIntegrations: z
      .array(z.object({ integrationId: z.string() }))
      .optional(),
    lookbackWindow: z.string().optional(),
    lookbackRange: z.object({ start: z.string(), end: z.string() }).optional(),
    brandVoiceName: z.string().optional(),
    brandVoiceId: z.string().optional(),
    selectedCommitShas: z.array(z.string()).optional(),
    selectedPullRequests: z
      .array(z.object({ repositoryId: z.string(), number: z.number() }))
      .optional(),
    selectedReleases: z
      .array(z.object({ repositoryId: z.string(), tagName: z.string() }))
      .optional(),
    selectedLinearIssues: z
      .array(z.object({ integrationId: z.string(), issueId: z.string() }))
      .optional(),
    type: z.literal("generated_image").optional(),
    chatId: z.string().nullable().optional(),
    briefId: z.string().optional(),
    projectId: z.string().optional(),
    socialVideo: socialVideoAttachmentSchema.nullable().optional(),
    sandbox: z
      .object({
        boxId: z.string().optional(),
        snapshotId: z.string().optional(),
        snapshotName: z.string().optional(),
        snapshotSizeBytes: z.number().optional(),
        snapshotCreatedAt: z.string().optional(),
      })
      .nullable()
      .optional(),
  })
  .nullable()
  .optional();

const githubHostSchema = z
  .url({ protocol: /^https$/ })
  .refine((value) => new URL(value).hostname === "github.com", {
    error: "Pull request URL must be on github.com",
  });

export const postGitHubPublishSchema = z.object({
  branchName: z.string().trim().min(1).max(255),
  owner: z.string().trim().min(1).max(39),
  path: z.string().trim().min(1).max(GITHUB_CONTENT_PATH_MAX_LENGTH),
  pullRequestNumber: z.number().int().positive().nullable(),
  pullRequestUrl: githubHostSchema.nullable(),
  siteId: z.string().optional(),
  baseBranch: z.string().optional(),
  direct: z.boolean().optional(),
  assetPaths: z.array(z.string()).optional(),
  writtenBlobs: z.record(z.string(), z.string()).optional(),
  headSha: z.string().optional(),
  repo: z.string().trim().min(1).max(100),
  repositoryId: z.string().trim().min(1).max(64),
}) satisfies z.ZodType<PostGitHubPublish>;

const contentSchema = z.object({
  id: z.string(),
  revision: z.number().int().min(0),
  title: z.string(),
  slug: z.string().nullable(),
  content: z.string(),
  htmlUrl: z.string().nullable(),
  markdown: z.string().nullable(),
  rawHtml: z.string().nullable(),
  recommendations: z.string().nullable(),
  contentType: contentTypeSchema,
  status: postStatusSchema,
  date: z.string(),
  sourceMetadata: sourceMetadataSchema,
  githubPublish: postGitHubPublishSchema.nullable(),
  metadata: postMetadataSchema,
});

export type ContentResponse = z.infer<typeof contentSchema>;

/**
 * List item for `content.list`. Bodies are not shipped: `content` is only set
 * for image posts (it holds the image URL) and `markdown` is a leading excerpt
 * for text posts. Use `content.get` for the full post.
 */
export const postSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string().nullable(),
  content: z.string(),
  htmlUrl: z.string().nullable(),
  markdown: z.string().nullable(),
  contentType: contentTypeSchema,
  contentSubtype: z.enum(BLOG_POST_SUBTYPES).nullable(),
  status: postStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Post = z.infer<typeof postSchema>;

export const postsPaginationSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  totalCount: z.number().int().min(0),
  totalPages: z.number().int().min(1),
});

const postsResponseSchema = z.object({
  posts: z.array(postSchema),
  pagination: postsPaginationSchema,
});

export type PostsResponse = z.infer<typeof postsResponseSchema>;

const recentPostSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: postStatusSchema,
});

const recentPostsResponseSchema = z.object({
  posts: z.array(recentPostSchema),
});

export type RecentPostsResponse = z.infer<typeof recentPostsResponseSchema>;

export const createChatPostSchema = z.object({
  chatId: z.string().trim().min(1),
  toolCallId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).nullable().optional(),
  markdown: z.string().trim().min(1),
  contentType: contentTypeSchema,
  status: postStatusSchema,
});

export const contentOrganizationIdInputSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
});

export const contentProjectIdInputSchema = z.object({
  projectId: z.string().min(1).optional(),
});

export const contentInputSchema = contentOrganizationIdInputSchema.extend({
  contentId: z.string().min(1, "Content ID is required"),
});

export const contentPreviewRequestSchema = z.object({
  repositoryIds: z.array(z.string().min(1)),
  lookbackWindow: z.enum(LOOKBACK_WINDOWS),
  timezone: z.string().min(1).optional(),
  includeCommits: z.boolean().default(true),
  includePullRequests: z.boolean().default(true),
  includeReleases: z.boolean().default(true),
  linearIntegrationIds: z.array(z.string().min(1)).optional(),
});

const postCollectionSourceSchema = z.enum([
  "manual",
  "chat",
  "schedule",
  "automation",
  "api",
  "backfill",
]);

const postCollectionNameSourceSchema = z.enum([
  "generated",
  "user",
  "backfill",
]);

const postCollectionStatusSummarySchema = z.object({
  total: z.number().int().min(0),
  draft: z.number().int().min(0),
  published: z.number().int().min(0),
});

const postCollectionSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  source: postCollectionSourceSchema,
  nameSource: postCollectionNameSourceSchema,
  contentTypes: z.array(contentTypeSchema),
  postCount: z.number().int().min(0),
  singlePost: z.object({ id: z.string(), title: z.string() }).nullable(),
  expectedPostCount: z.number().int().nullable(),
  isGenerating: z.boolean(),
  statusSummary: postCollectionStatusSummarySchema,
  createdAt: z.string(),
});
export type PostCollectionSummary = z.infer<typeof postCollectionSummarySchema>;

const postCollectionListResponseSchema = z.object({
  collections: z.array(postCollectionSummarySchema),
  pagination: postsPaginationSchema,
});
export type PostCollectionListResponse = z.infer<
  typeof postCollectionListResponseSchema
>;

const groupPostSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  markdown: z.string().nullable(),
  contentType: contentTypeSchema,
  contentSubtype: z.enum(BLOG_POST_SUBTYPES).nullable(),
  status: postStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

const postCollectionDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: postCollectionSourceSchema,
  nameSource: postCollectionNameSourceSchema,
  contentTypes: z.array(contentTypeSchema),
  expectedPostCount: z.number().int().nullable(),
  isGenerating: z.boolean(),
  createdAt: z.string(),
  posts: z.array(groupPostSchema),
});
export type PostCollectionDetail = z.infer<typeof postCollectionDetailSchema>;

const postSiblingSchema = z.object({
  id: z.string(),
  title: z.string(),
  contentType: z.string(),
  status: postStatusSchema,
});

const postCollectionContextSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: postCollectionSourceSchema,
  siblings: z.array(postSiblingSchema),
});
export type PostCollectionContext = z.infer<typeof postCollectionContextSchema>;

const renameCollectionSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

const contextItemSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("github-repo"),
    owner: z.string(),
    repo: z.string(),
    integrationId: z.string(),
  }),
  z.object({
    type: z.literal("linear-team"),
    integrationId: z.string(),
    teamName: z.string().optional(),
  }),
]);

export type ContextItem = z.infer<typeof contextItemSchema>;

const textSelectionSchema = z.object({
  text: z.string(),
  startLine: z.number(),
  startChar: z.number(),
  endLine: z.number(),
  endChar: z.number(),
});

export type TextSelection = z.infer<typeof textSelectionSchema>;

const contentChatContextItemSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("github-repo"),
    owner: z.string(),
    repo: z.string(),
    integrationId: z.string(),
  }),
  z.object({
    type: z.literal("linear-team"),
    integrationId: z.string(),
    teamName: z.string().optional(),
  }),
  z.object({
    type: z.literal("mcp-server"),
    integrationId: z.string(),
    name: z.string(),
  }),
]);

export const contentChatMessageMetadataSchema = z.object({
  selection: textSelectionSchema.optional(),
  context: z.array(contentChatContextItemSchema).max(50).optional(),
});

export const chatRequestSchema = z.object({
  chatId: chatIdSchema,
  messages: z.array(uiMessageSchema).min(1).max(UI_MESSAGES_MAX),
  currentMarkdown: z.string().max(POST_MARKDOWN_MAX_LENGTH),
  contentType: z.string().max(100).optional(),
  documentMode: z.enum(["plan"]).optional(),
  selection: textSelectionSchema.optional(),
  context: z.array(contextItemSchema).max(50).optional(),
  model: chatModelSchema.optional(),
  thinkingLevel: thinkingLevelSchema.optional(),
  timezone: z.string().min(1).max(100).optional(),
});

export const updateContentSchema = z
  .object({
    title: z.string().trim().min(1).max(POST_TITLE_MAX_LENGTH).optional(),
    slug: postSlugSchema.nullable().optional(),
    markdown: z.string().max(POST_MARKDOWN_MAX_LENGTH).optional(),
    status: postStatusSchema.optional(),
    socialVideo: socialVideoAttachmentSchema.nullable().optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.slug !== undefined ||
      data.markdown !== undefined ||
      data.status !== undefined ||
      data.socialVideo !== undefined,
    {
      message: "At least one field must be provided",
    }
  );

export type UpdateContentInput = z.infer<typeof updateContentSchema>;

export const updateContentMetadataInputSchema = contentInputSchema.extend({
  metadata: postMetadataPatchSchema,
});

export const createContentAuthorInputSchema =
  contentOrganizationIdInputSchema.extend({
    author: contentAuthorFieldsSchema,
  });

export const updateContentAuthorInputSchema =
  contentOrganizationIdInputSchema.extend({
    authorId: z.string().min(1),
    author: contentAuthorFieldsSchema
      .partial()
      .refine(
        (author) => Object.values(author).some((value) => value !== undefined),
        { message: "At least one field must be provided" }
      ),
  });

export const deleteContentAuthorInputSchema =
  contentOrganizationIdInputSchema.extend({
    authorId: z.string().min(1),
  });

export const createPostInputSchema = contentOrganizationIdInputSchema
  .extend(contentProjectIdInputSchema.shape)
  .extend(createPostFieldsSchema.shape);

const githubMarkdownPathSchema = repositoryRelativePathSchema
  .transform((path) => (/\.(?:md|mdx)$/i.test(path) ? path : `${path}.md`))
  .pipe(repositoryContentFilePathSchema);

export const deleteContentInputSchema = contentInputSchema.extend({
  removeFromRepository: z.boolean().default(false),
});

export const publishContentToGitHubSchema = z.object({
  contentType: z.enum(GITHUB_PUBLISH_CONTENT_TYPES).default("changelog"),
  repositoryId: z.string().min(1, "Repository is required"),
  path: githubMarkdownPathSchema.optional(),
  siteId: z.string().min(1).optional(),
  /** Reuse the publication destination when updating saved content. */
  linkedOnly: z.boolean().optional(),
});

export const onDemandContentTypeSchema = z.enum([
  ...SUPPORTED_AUTOMATION_OUTPUT_TYPES,
  "image",
] as const);
export type OnDemandContentType = z.infer<typeof onDemandContentTypeSchema>;

export const createPostCollectionInputSchema = contentOrganizationIdInputSchema
  .extend(contentProjectIdInputSchema.shape)
  .extend({
    contentTypes: z.array(onDemandContentTypeSchema).min(1),
    expectedPostCount: z.number().int().positive(),
  });

export const postCollectionsListInputSchema = contentOrganizationIdInputSchema
  .extend(contentProjectIdInputSchema.shape)
  .extend({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  });

export const postCollectionInputSchema =
  contentOrganizationIdInputSchema.extend({
    collectionId: z.string().min(1, "Collection ID is required"),
  });

export const renamePostCollectionInputSchema = postCollectionInputSchema.and(
  renameCollectionSchema
);

export const updateExpectedPostCountInputSchema =
  postCollectionInputSchema.extend({
    expectedPostCount: z.number().int().positive(),
  });

export const generateContentInputSchema = contentOrganizationIdInputSchema
  .and(createContentGenerationRequestSchema)
  .and(z.object({ collectionId: z.string().min(1) }));

export const contentDataPointSettingsSchema = z.object({
  includePullRequests: z.boolean().default(true),
  includeCommits: z.boolean().default(true),
  includeReleases: z.boolean().default(true),
  includeLinearData: z.boolean().default(false),
});

export type ContentDataPointSettings = z.infer<
  typeof contentDataPointSettingsSchema
>;

export const selectedItemsSchema = z.object({
  commitShas: z.array(z.string()).optional(),
  pullRequestNumbers: z
    .array(
      z.object({
        repositoryId: z.string(),
        number: z.number(),
      })
    )
    .optional(),
  releaseTagNames: z
    .array(
      z.union([
        z.string(),
        z.object({
          repositoryId: z.string(),
          tagName: z.string(),
        }),
      ])
    )
    .optional(),
  linearIssueIds: z
    .array(
      z.object({
        integrationId: z.string(),
        issueId: z.string(),
      })
    )
    .optional(),
});

export type SelectedItems = z.infer<typeof selectedItemsSchema> | undefined;
