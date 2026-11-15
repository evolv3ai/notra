import { checkContentBilling } from "@notra/ai/billing/content-billing";
import { GITHUB_API_VERSION_HEADERS } from "@notra/ai/constants/github";
import { getTokenForIntegrationId } from "@notra/ai/integrations/github";
import {
  getDecryptedLinearToken,
  getLinearIntegrationsByOrganization,
} from "@notra/ai/integrations/linear";
import { type ContentType, contentTypeSchema } from "@notra/ai/schemas/content";
import { supportsPostSlug } from "@notra/ai/schemas/post";
import { postCoverImageSchema } from "@notra/ai/schemas/post-metadata";
import {
  createLinearClient,
  getLinearIssuePreviews,
} from "@notra/ai/utils/linear";
import { createOctokit } from "@notra/ai/utils/octokit";
import { stripLeadingFrontmatter } from "@notra/ai/utils/post-markdown";
import {
  isPostSlugConflict,
  listOrganizationTags,
} from "@notra/ai/utils/post-service";
import { sanitizeMarkdownHtml } from "@notra/ai/utils/sanitize";
import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import {
  siteDeployments,
  sites,
  contentAuthors,
  githubIntegrations,
  postCollections,
  posts,
} from "@notra/db/schema";
import type { BlogPostSubtype } from "@notra/db/types/content";
import { isPgUniqueViolation } from "@notra/db/utils/pg-errors";
import { buildPostCollectionName } from "@notra/db/utils/post-collections";
import {
  checkpointPostHistory,
  setPostHistoryContext,
  supportsPostHistory,
} from "@notra/db/utils/post-history";
import { extractImageArtifactHtml } from "@notra/db/utils/post-image-artifacts";
import {
  contentAuthorsInOrganization,
  postMetadataUpdateData,
} from "@notra/db/utils/post-metadata";
import { publishedAtForStatusChange } from "@notra/db/utils/post-published-at";
import {
  isProjectInOrganization,
  projectScopedCollectionIds,
  projectScopeFilter,
} from "@notra/db/utils/projects";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import {
  contentListQuerySchema,
  dashboardHomeContentQuerySchema,
} from "@notra/schemas/dashboard/api-params";
import type {
  ContentResponse,
  PostsResponse,
} from "@notra/schemas/dashboard/content";
import {
  contentInputSchema,
  deleteContentInputSchema,
  contentOrganizationIdInputSchema,
  contentPreviewRequestSchema,
  createPostCollectionInputSchema,
  createPostInputSchema,
  generateContentInputSchema,
  postCollectionInputSchema,
  postCollectionsListInputSchema,
  postGitHubPublishSchema,
  publishContentToGitHubSchema,
  renamePostCollectionInputSchema,
  updateContentMetadataInputSchema,
  updateContentSchema,
  updateExpectedPostCountInputSchema,
} from "@notra/schemas/dashboard/content";
import { saveContentDocumentSchema } from "@notra/schemas/dashboard/content-history";
import { clearCompletedGenerationSchema } from "@notra/schemas/dashboard/generations";
import type { PostMetadata } from "@notra/schemas/shared/post-metadata";
import { primaryMountUrl } from "@notra/sites-server/utils/urls";
import { slugify } from "@notra/utils/slugify";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { marked } from "marked";
import { nanoid } from "nanoid";

import { TAG_SUGGESTIONS_LIMIT } from "@/constants/content-overview";
import {
  DASHBOARD_HOME_POST_LIMIT,
  GITHUB_API_MAX_PAGES,
  GITHUB_API_MAX_RESULTS,
  GITHUB_API_PAGE_SIZE,
} from "@/constants/content-preview";
import { SOCIAL_VIDEO } from "@/constants/social-video";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { getEnabledDataPoints } from "@/lib/analytics/studio-events";
import { assertActiveSubscription } from "@/lib/billing/subscription";
import { getUtcDayRange } from "@/lib/content/content-calendar";
import { getContentPublishingMetrics } from "@/lib/content/content-publishing-metrics.server";
import { githubRepositoryClient } from "@/lib/content/scheduled-publication-destinations";
import { afterResponse } from "@/lib/framework/after-response";
import {
  addActiveGeneration,
  clearCompletedGeneration,
  generateRunId,
  getActiveGenerations,
  getCompletedGenerations,
} from "@/lib/generations/tracking";
import { requestGeoRescanForPublishedPost } from "@/lib/geo/rescan";
import { getTranslations } from "@/lib/i18n/server";
import { assertContentPublishAllowed } from "@/lib/integrations/github/assert-content-publish";
import { withContentPublicationLock } from "@/lib/integrations/github/content-publication-lock";
import { getContentPullRequestState } from "@/lib/integrations/github/content-pull-request";
import { publishSavedContentToGitHub } from "@/lib/integrations/github/publish-saved-content";
import { removePublishedContent } from "@/lib/integrations/github/remove-published-content";
import { baseProcedure, withOrganizationAccess } from "@/lib/orpc/base";
import { contentAuthorsRouter } from "@/lib/orpc/routers/content-authors";
import { contentHistoryRouter } from "@/lib/orpc/routers/content-history";
import { contentRecentsProcedure } from "@/lib/orpc/routers/content-recents";
import { isOwnSocialVideo } from "@/lib/social-connect/media-urls";
import { startOnDemandRun } from "@/lib/workflows/start";
import type { PostMetadataColumns } from "@/types/content/overview";
import type {
  CommitPreview,
  ContentListPreviewVariant,
  LinearIntegrationPreviewItem,
  PullRequestPreview,
  ReleasePreview,
  RepositoryPreview,
  RepositoryPreviewFailure,
} from "@/types/content/preview";
import type {
  ContentUpdateDataInput,
  ContentUpdatePost,
} from "@/types/content/update";
import { getContentListPreview } from "@/utils/content-list-preview";
import { resolveLookbackRange } from "@/utils/lookback";
import { ratelimit } from "@/utils/ratelimit";

import {
  assertNotDemo,
  badRequest,
  conflict,
  internalServerError,
  notFound,
  paymentRequired,
} from "../utils/errors";

const TITLE_REGEX = /^#\s+(.+)$/m;

const CONTENT_SIBLING_LIMIT = 100;

const postReadColumns = {
  id: true,
  revision: true,
  organizationId: true,
  collectionId: true,
  title: true,
  slug: true,
  content: true,
  htmlUrl: true,
  markdown: true,
  recommendations: true,
  contentType: true,
  contentSubtype: true,
  createdAt: true,
  sourceMetadata: true,
  githubPublish: true,
  coverImage: true,
  tags: true,
  excerpt: true,
  authorIds: true,
  featured: true,
  noindex: true,
  hidden: true,
  displayDate: true,
  status: true,
  updatedAt: true,
} as const;

const postListColumns = {
  id: true,
  title: true,
  slug: true,
  htmlUrl: true,
  contentType: true,
  contentSubtype: true,
  createdAt: true,
  status: true,
  updatedAt: true,
  markdown: true,
} as const;

const postListExtras = {
  content:
    sql<string>`case when ${posts.contentType} = 'image' then ${posts.content} else '' end`.as(
      "content"
    ),
};

function serializePost(
  post: {
    content: string;
    contentType: string;
    contentSubtype: BlogPostSubtype | null;
    createdAt: Date;
    htmlUrl: string | null;
    id: string;
    markdown: string | null;
    slug: string | null;
    status: "draft" | "published";
    title: string;
    updatedAt: Date;
  },
  variant: ContentListPreviewVariant = "collection"
) {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    ...getContentListPreview(post, variant),
    htmlUrl: post.contentType === "image" ? post.htmlUrl : null,
    contentType:
      post.contentType as PostsResponse["posts"][number]["contentType"],
    contentSubtype: post.contentSubtype,
    status: post.status,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

function serializePostMetadata(post: PostMetadataColumns): PostMetadata {
  const cover = postCoverImageSchema.safeParse(post.coverImage);
  return {
    coverImage: cover.success ? cover.data : null,
    tags: post.tags,
    excerpt: post.excerpt,
    authorIds: post.authorIds,
    featured: post.featured,
    noindex: post.noindex,
    hidden: post.hidden,
    displayDate: post.displayDate
      ? post.displayDate.toISOString().slice(0, 10)
      : null,
  };
}

function serializeContent(
  post: PostMetadataColumns & {
    content: string;
    contentType: string;
    createdAt: Date;
    htmlUrl: string | null;
    id: string;
    markdown: string | null;
    recommendations: string | null;
    slug: string | null;
    sourceMetadata: unknown;
    githubPublish: unknown;
    status: "draft" | "published";
    title: string;
    revision: number;
  }
): ContentResponse {
  const githubPublish = postGitHubPublishSchema.safeParse(post.githubPublish);

  return {
    id: post.id,
    revision: post.revision,
    title: post.title,
    slug: post.slug,
    content: post.content,
    htmlUrl: post.contentType === "image" ? post.htmlUrl : null,
    markdown: post.markdown,
    rawHtml: extractImageArtifactHtml(post.sourceMetadata),
    recommendations: post.recommendations,
    contentType: post.contentType as ContentResponse["contentType"],
    status: post.status,
    date: post.createdAt.toISOString(),
    sourceMetadata: post.sourceMetadata as ContentResponse["sourceMetadata"],
    githubPublish: githubPublish.success ? githubPublish.data : null,
    metadata: serializePostMetadata(post),
  };
}

function normalizeContentTypes(contentTypes: string[]): ContentType[] {
  const normalized = new Set<ContentType>();
  for (const contentType of contentTypes) {
    const parsed = contentTypeSchema.safeParse(contentType);
    if (parsed.success) {
      normalized.add(parsed.data);
    }
  }
  return [...normalized];
}

function normalizeContentType(contentType: string): ContentType {
  return contentTypeSchema.parse(contentType);
}

function storedContentTypes(contentTypes: unknown): string[] {
  return Array.isArray(contentTypes)
    ? contentTypes.filter((type): type is string => typeof type === "string")
    : [];
}

function isCollectionGenerating(collection: {
  completedPostCount: number;
  expectedPostCount: number | null;
}) {
  return (
    collection.expectedPostCount !== null &&
    collection.completedPostCount < collection.expectedPostCount
  );
}

async function toSlugConflict(error: unknown) {
  if (isPgUniqueViolation(error)) {
    const tErrors = await getTranslations("errors.content");
    return conflict(tErrors("slugTaken"));
  }
  return error;
}

function formatFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown error";
}

export async function buildContentUpdateData(
  existingPost: ContentUpdatePost,
  input: ContentUpdateDataInput
) {
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (input.title !== undefined) {
    updateData.title = input.title;
  }

  if (input.markdown !== undefined) {
    const markdown = stripLeadingFrontmatter(input.markdown);
    const titleMatch = markdown.match(TITLE_REGEX);
    updateData.markdown = markdown;

    if (input.title === undefined) {
      updateData.title = titleMatch?.[1] ?? existingPost.title;
    }

    updateData.content = sanitizeMarkdownHtml(await marked.parse(markdown));
  }

  if (input.status !== undefined) {
    updateData.status = input.status;
    const publishedAt = publishedAtForStatusChange(
      existingPost.status,
      input.status
    );
    if (publishedAt !== undefined) {
      updateData.publishedAt = publishedAt;
    }
  }

  if (input.socialVideo !== undefined) {
    updateData.sourceMetadata = sql`(case when jsonb_typeof(${posts.sourceMetadata}) = 'object' then ${posts.sourceMetadata} else '{}'::jsonb end) || jsonb_build_object('socialVideo', ${JSON.stringify(input.socialVideo)}::jsonb)`;
  }

  return updateData;
}

async function fetchReleasesPreview(params: {
  end: Date;
  octokit: ReturnType<typeof createOctokit>;
  owner: string;
  repo: string;
  start: Date;
}): Promise<ReleasePreview[]> {
  const { octokit, owner, repo, start, end } = params;
  const results: ReleasePreview[] = [];
  let page = 1;

  while (page <= GITHUB_API_MAX_PAGES) {
    const response = await octokit.request(
      "GET /repos/{owner}/{repo}/releases",
      {
        owner,
        repo,
        per_page: GITHUB_API_PAGE_SIZE,
        page,
        headers: GITHUB_API_VERSION_HEADERS,
      }
    );

    const releases = response.data;

    if (releases.length === 0) {
      break;
    }

    for (const release of releases) {
      if (!release.published_at) {
        continue;
      }

      const publishedDate = new Date(release.published_at);

      if (publishedDate >= start && publishedDate <= end) {
        results.push({
          tagName: release.tag_name,
          name: release.name ?? release.tag_name,
          publishedAt: release.published_at,
          authorLogin: release.author?.login ?? "Unknown",
          htmlUrl: release.html_url,
          prerelease: release.prerelease,
        });
      }
    }

    const oldest = releases.at(-1);

    if (!oldest?.published_at || new Date(oldest.published_at) < start) {
      break;
    }

    if (releases.length < GITHUB_API_PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  return results.slice(0, GITHUB_API_MAX_RESULTS);
}

async function fetchMergedPullRequestsPreview(params: {
  end: Date;
  octokit: ReturnType<typeof createOctokit>;
  owner: string;
  repo: string;
  start: Date;
}): Promise<PullRequestPreview[]> {
  const { octokit, owner, repo, start, end } = params;
  const mergedPullRequests: PullRequestPreview[] = [];
  let page = 1;

  while (page <= GITHUB_API_MAX_PAGES) {
    const response = await octokit.request("GET /repos/{owner}/{repo}/pulls", {
      owner,
      repo,
      state: "closed",
      sort: "updated",
      direction: "desc",
      per_page: GITHUB_API_PAGE_SIZE,
      page,
      headers: GITHUB_API_VERSION_HEADERS,
    });

    const pullRequests = response.data;

    if (pullRequests.length === 0) {
      break;
    }

    for (const pullRequest of pullRequests) {
      if (!pullRequest.merged_at) {
        continue;
      }

      const mergedAt = new Date(pullRequest.merged_at);

      if (mergedAt < start || mergedAt > end) {
        continue;
      }

      mergedPullRequests.push({
        number: pullRequest.number,
        title: pullRequest.title,
        state: pullRequest.state,
        merged: true,
        authorLogin: pullRequest.user?.login ?? "Unknown",
        mergedAt: pullRequest.merged_at,
        htmlUrl: pullRequest.html_url,
      });
    }

    if (pullRequests.length < GITHUB_API_PAGE_SIZE) {
      break;
    }

    const oldestUpdatedAt = pullRequests.at(-1)?.updated_at;

    if (!oldestUpdatedAt || new Date(oldestUpdatedAt) < start) {
      break;
    }

    page += 1;
  }

  return mergedPullRequests
    .sort((left, right) => {
      const leftMergedAt = left.mergedAt
        ? new Date(left.mergedAt).getTime()
        : 0;
      const rightMergedAt = right.mergedAt
        ? new Date(right.mergedAt).getTime()
        : 0;

      return rightMergedAt - leftMergedAt;
    })
    .slice(0, GITHUB_API_MAX_RESULTS);
}

async function fetchCommitsPreview(params: {
  end: Date;
  octokit: ReturnType<typeof createOctokit>;
  owner: string;
  repo: string;
  start: Date;
}): Promise<CommitPreview[]> {
  const { octokit, owner, repo, start, end } = params;
  const results: CommitPreview[] = [];
  let page = 1;

  while (page <= GITHUB_API_MAX_PAGES) {
    const response = await octokit.request(
      "GET /repos/{owner}/{repo}/commits",
      {
        owner,
        repo,
        since: start.toISOString(),
        until: end.toISOString(),
        per_page: GITHUB_API_PAGE_SIZE,
        page,
        headers: GITHUB_API_VERSION_HEADERS,
      }
    );

    const commits = response.data;

    if (commits.length === 0) {
      break;
    }

    for (const commit of commits) {
      results.push({
        sha: commit.sha,
        message: commit.commit.message.split("\n")[0] ?? "",
        authorName: commit.commit.author?.name ?? "Unknown",
        authorLogin: commit.author?.login ?? null,
        authoredAt: commit.commit.author?.date ?? "",
        htmlUrl: commit.html_url,
      });
    }

    if (commits.length < GITHUB_API_PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  return results.slice(0, GITHUB_API_MAX_RESULTS);
}

export const contentRouter = {
  history: contentHistoryRouter,
  home: {
    get: baseProcedure
      .input(
        contentOrganizationIdInputSchema.and(dashboardHomeContentQuerySchema)
      )
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        const dateRange = getUtcDayRange("today");
        const filters = [eq(posts.organizationId, input.organizationId)];
        const collectionIds = projectScopedCollectionIds(
          input.organizationId,
          input.projectId
        );

        if (collectionIds) {
          filters.push(inArray(posts.collectionId, collectionIds));
        }
        if (dateRange) {
          filters.push(
            gte(posts.createdAt, dateRange.startDate),
            lt(posts.createdAt, dateRange.endDate)
          );
        }

        const items = await db.query.posts.findMany({
          where: and(...filters),
          orderBy: [desc(posts.createdAt), desc(posts.id)],
          limit: DASHBOARD_HOME_POST_LIMIT,
          columns: postListColumns,
          extras: postListExtras,
        });

        return {
          posts: items.map((post) => serializePost(post, "dashboard")),
        };
      }),
  },
  recents: contentRecentsProcedure,
  list: baseProcedure
    .input(contentOrganizationIdInputSchema.and(contentListQuerySchema))
    .use(withOrganizationAccess)
    .handler(async ({ input }) => {
      const dateRange = getUtcDayRange(input.date ?? null);

      if (input.date && !dateRange) {
        throw badRequest(
          (await getTranslations("errors.actions"))("invalidInput")
        );
      }

      const baseFilters = [eq(posts.organizationId, input.organizationId)];
      const projectCollectionIds = projectScopedCollectionIds(
        input.organizationId,
        input.projectId
      );
      if (projectCollectionIds) {
        baseFilters.push(inArray(posts.collectionId, projectCollectionIds));
      }

      if (dateRange) {
        baseFilters.push(
          gte(posts.createdAt, dateRange.startDate),
          lt(posts.createdAt, dateRange.endDate)
        );
      }

      const whereClause = and(...baseFilters);
      const offset = (input.page - 1) * input.pageSize;

      const [items, totalCountResult] = await Promise.all([
        db.query.posts.findMany({
          where: whereClause,
          orderBy: [desc(posts.createdAt), desc(posts.id)],
          limit: input.pageSize,
          offset,
          columns: postListColumns,
          extras: postListExtras,
        }),
        db.select({ value: count() }).from(posts).where(whereClause),
      ]);

      const totalCount = totalCountResult[0]?.value ?? 0;
      const totalPages = Math.max(1, Math.ceil(totalCount / input.pageSize));

      return {
        posts: items.map((post) => serializePost(post)),
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          totalCount,
          totalPages,
        },
      };
    }),
  get: baseProcedure
    .input(contentInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input }) => {
      const post = await db.query.posts.findFirst({
        where: and(
          eq(posts.id, input.contentId),
          eq(posts.organizationId, input.organizationId)
        ),
        columns: postReadColumns,
      });

      if (!post) {
        throw notFound("Content not found");
      }

      const collection = await db.query.postCollections.findFirst({
        where: and(
          eq(postCollections.id, post.collectionId),
          eq(postCollections.organizationId, input.organizationId)
        ),
        with: {
          posts: {
            columns: {
              id: true,
              title: true,
              contentType: true,
              status: true,
            },
            where: ne(posts.id, post.id),
            orderBy: [asc(posts.createdAt), asc(posts.id)],
            limit: CONTENT_SIBLING_LIMIT,
          },
        },
      });

      return {
        content: serializeContent(post),
        collection: collection
          ? {
              id: collection.id,
              name: collection.name,
              source: collection.source,
              siblings: collection.posts.map((sibling) => ({
                id: sibling.id,
                title: sibling.title,
                contentType: normalizeContentType(sibling.contentType),
                status: sibling.status,
              })),
            }
          : null,
      };
    }),
  pullRequestState: baseProcedure
    .input(contentInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input }) => {
      const post = await db.query.posts.findFirst({
        where: and(
          eq(posts.id, input.contentId),
          eq(posts.organizationId, input.organizationId)
        ),
        columns: { githubPublish: true },
      });
      const publish = postGitHubPublishSchema.safeParse(post?.githubPublish);
      if (!(publish.success && publish.data)) {
        return { status: null, siteName: null, previewUrl: null };
      }
      const { pullRequestNumber, repositoryId } = publish.data;
      const site = publish.data.siteId
        ? await db.query.sites.findFirst({
            where: and(
              eq(sites.id, publish.data.siteId),
              eq(sites.organizationId, input.organizationId)
            ),
            columns: { name: true },
          })
        : null;
      const deployment =
        pullRequestNumber && publish.data.siteId
          ? await db.query.siteDeployments.findFirst({
              where: and(
                eq(siteDeployments.siteId, publish.data.siteId),
                eq(siteDeployments.pullRequestNumber, pullRequestNumber),
                eq(siteDeployments.status, "ready")
              ),
              orderBy: [desc(siteDeployments.createdAt)],
              columns: { target: true },
            })
          : null;
      const details = {
        siteName: site?.name ?? null,
        previewUrl: deployment
          ? primaryMountUrl(
              deployment.target.publicOrigin,
              deployment.target.mounts
            )
          : null,
      };
      if (!pullRequestNumber) {
        return { status: "merged" as const, ...details };
      }
      // No GitHub App, a revoked token or a deleted repository just falls
      // back to a plain link.
      const state = await githubRepositoryClient(
        input.organizationId,
        repositoryId
      )
        .then((client) =>
          client
            ? getContentPullRequestState(client.octokit, {
                owner: client.owner,
                repo: client.repo,
                pullNumber: pullRequestNumber,
              })
            : null
        )
        .catch(() => null);
      if (!state) {
        return { status: null, ...details };
      }
      return {
        ...details,
        status: state.status === "open" && state.draft ? "draft" : state.status,
      } as const;
    }),
  create: baseProcedure
    .input(createPostInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      const { auth } = context;
      await assertActiveSubscription(input.organizationId);

      if (
        input.projectId &&
        !(await isProjectInOrganization(input.organizationId, input.projectId))
      ) {
        throw badRequest((await getTranslations("errors.server"))("notFound"));
      }

      if (input.slug && !supportsPostSlug(input.contentType)) {
        const tErrors = await getTranslations("errors.content");
        throw badRequest(tErrors("slugNotSupported"));
      }

      const now = new Date();
      const collectionId = nanoid();
      const contentId = nanoid();
      const markdown = stripLeadingFrontmatter(input.markdown ?? "");
      const content =
        markdown.length > 0
          ? sanitizeMarkdownHtml(await marked.parse(markdown))
          : "";

      try {
        await db.transaction(async (tx) => {
          await setPostHistoryContext(tx, {
            actorUserId: auth.user.id,
            source: "editor_save",
          });
          await tx.insert(postCollections).values({
            id: collectionId,
            organizationId: input.organizationId,
            projectId: input.projectId ?? null,
            source: "manual",
            sourceId: collectionId,
            name: buildPostCollectionName([input.contentType], now),
            nameSource: "generated",
            contentTypes: [input.contentType],
            expectedPostCount: 1,
            completedPostCount: 1,
            createdAt: now,
            updatedAt: now,
          });

          await tx.insert(posts).values({
            id: contentId,
            organizationId: input.organizationId,
            collectionId,
            title: input.title,
            slug: input.slug ?? null,
            content,
            markdown,
            contentType: input.contentType,
            status: "draft",
            sourceMetadata: null,
            createdAt: now,
            updatedAt: now,
          });
        });
      } catch (error) {
        throw await toSlugConflict(error);
      }

      trackServerEvent({
        event: POSTHOG_EVENTS.CONTENT_SAVED,
        headers: context.headers,
        userId: auth.user.id,
        organizationId: input.organizationId,
        properties: {
          content_id: contentId,
          type: input.contentType,
        },
      });

      return { contentId, collectionId };
    }),
  saveDocument: baseProcedure
    .input(saveContentDocumentSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      const { auth } = context;
      await assertActiveSubscription(input.organizationId);
      const [existingPost, tErrors] = await Promise.all([
        db.query.posts.findFirst({
          where: and(
            eq(posts.id, input.contentId),
            eq(posts.organizationId, input.organizationId)
          ),
          columns: { title: true, contentType: true, status: true },
        }),
        getTranslations("errors.content"),
      ]);
      if (!existingPost) {
        throw notFound(tErrors("historyNotFound"));
      }
      const updateData = await buildContentUpdateData(existingPost, input);
      if (input.slug !== undefined) {
        if (!supportsPostSlug(existingPost.contentType)) {
          throw badRequest(tErrors("slugNotSupported"));
        }
        updateData.slug = input.slug;
      }
      try {
        const [saved] = await db.transaction(async (tx) => {
          await setPostHistoryContext(tx, {
            actorUserId: auth.user.id,
            source: input.autosave ? "editor_autosave" : "editor_save",
          });
          const updated = await tx
            .update(posts)
            .set(updateData)
            .where(
              and(
                eq(posts.id, input.contentId),
                eq(posts.organizationId, input.organizationId),
                eq(posts.revision, input.expectedRevision)
              )
            )
            .returning({
              id: posts.id,
              title: posts.title,
              slug: posts.slug,
              markdown: posts.markdown,
              content: posts.content,
              revision: posts.revision,
              updatedAt: posts.updatedAt,
            });
          const document = updated[0];
          if (
            document &&
            !input.autosave &&
            document.revision === input.expectedRevision &&
            supportsPostHistory(existingPost.contentType)
          ) {
            await checkpointPostHistory(tx, {
              organizationId: input.organizationId,
              postId: input.contentId,
              expectedRevision: document.revision,
              actorUserId: auth.user.id,
              source: "editor_save",
            });
          }
          return updated;
        });
        if (!saved) {
          const current = await db.query.posts.findFirst({
            where: and(
              eq(posts.id, input.contentId),
              eq(posts.organizationId, input.organizationId)
            ),
            columns: { revision: true },
          });
          if (!current) {
            throw notFound(tErrors("historyNotFound"));
          }
          throw conflict(tErrors("concurrentEdit"), {
            currentRevision: current.revision,
          });
        }
        if (
          input.markdown !== undefined &&
          saved.revision > input.expectedRevision
        ) {
          trackServerEvent({
            event: POSTHOG_EVENTS.CONTENT_SAVED,
            headers: context.headers,
            userId: auth.user.id,
            organizationId: input.organizationId,
            properties: {
              content_id: input.contentId,
              type: existingPost.contentType,
            },
          });
        }
        return {
          success: true,
          document: { ...saved, updatedAt: saved.updatedAt.toISOString() },
        };
      } catch (error) {
        if (isPostSlugConflict(error)) {
          throw conflict(tErrors("slugTaken"));
        }
        throw error;
      }
    }),
  update: baseProcedure
    .input(contentInputSchema.and(updateContentSchema))
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      const { auth } = context;
      await assertActiveSubscription(input.organizationId);

      const existingPost = await db.query.posts.findFirst({
        where: and(
          eq(posts.id, input.contentId),
          eq(posts.organizationId, input.organizationId)
        ),
        columns: {
          title: true,
          contentType: true,
          status: true,
        },
      });

      if (!existingPost) {
        throw notFound("Content not found");
      }

      if (
        input.socialVideo &&
        !(
          SOCIAL_VIDEO.contentTypes.has(existingPost.contentType) &&
          isOwnSocialVideo(input.socialVideo, input.organizationId)
        )
      ) {
        const tErrors = await getTranslations("errors.content");
        throw badRequest(tErrors("socialVideoNotAllowed"));
      }

      const updateData = await buildContentUpdateData(existingPost, input);

      if (input.slug !== undefined) {
        if (!supportsPostSlug(existingPost.contentType)) {
          const tErrors = await getTranslations("errors.content");
          throw badRequest(tErrors("slugNotSupported"));
        }
        updateData.slug = input.slug;
      }

      try {
        const [updatedPost] = await db.transaction(async (tx) => {
          await setPostHistoryContext(tx, {
            actorUserId: auth.user.id,
            source: "system",
          });
          return await tx
            .update(posts)
            .set(updateData)
            .where(
              and(
                eq(posts.id, input.contentId),
                eq(posts.organizationId, input.organizationId)
              )
            )
            .returning({
              id: posts.id,
              revision: posts.revision,
              organizationId: posts.organizationId,
              collectionId: posts.collectionId,
              title: posts.title,
              slug: posts.slug,
              content: posts.content,
              htmlUrl: posts.htmlUrl,
              markdown: posts.markdown,
              recommendations: posts.recommendations,
              contentType: posts.contentType,
              createdAt: posts.createdAt,
              sourceMetadata: posts.sourceMetadata,
              githubPublish: posts.githubPublish,
              coverImage: posts.coverImage,
              tags: posts.tags,
              excerpt: posts.excerpt,
              authorIds: posts.authorIds,
              featured: posts.featured,
              noindex: posts.noindex,
              hidden: posts.hidden,
              displayDate: posts.displayDate,
              status: posts.status,
              updatedAt: posts.updatedAt,
            });
        });

        if (!updatedPost) {
          throw internalServerError("Failed to update content");
        }

        if (input.markdown !== undefined) {
          trackServerEvent({
            event: POSTHOG_EVENTS.CONTENT_SAVED,
            headers: context.headers,
            userId: auth.user.id,
            organizationId: input.organizationId,
            properties: {
              content_id: input.contentId,
              type: existingPost.contentType,
            },
          });
        }

        if (
          input.status !== undefined &&
          input.status !== existingPost.status
        ) {
          trackServerEvent({
            event:
              input.status === "published"
                ? POSTHOG_EVENTS.CONTENT_PUBLISHED
                : POSTHOG_EVENTS.CONTENT_UNPUBLISHED,
            headers: context.headers,
            userId: auth.user.id,
            organizationId: input.organizationId,
            properties: {
              content_id: input.contentId,
              type: existingPost.contentType,
            },
          });
        }

        if (
          updatedPost.status === "published" &&
          existingPost.status !== "published"
        ) {
          afterResponse(() =>
            requestGeoRescanForPublishedPost({
              organizationId: input.organizationId,
              postId: updatedPost.id,
            })
          );
        }

        return {
          success: true,
          content: serializeContent(updatedPost),
        };
      } catch (error) {
        throw await toSlugConflict(error);
      }
    }),
  updateMetadata: baseProcedure
    .input(updateContentMetadataInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      const { auth } = context;
      await assertActiveSubscription(input.organizationId);

      const existingPost = await db.query.posts.findFirst({
        where: and(
          eq(posts.id, input.contentId),
          eq(posts.organizationId, input.organizationId)
        ),
        columns: { contentType: true },
      });
      if (!existingPost) {
        throw notFound("Content not found");
      }
      const tErrors = await getTranslations("errors.content");
      if (!supportsPostSlug(existingPost.contentType)) {
        throw badRequest(tErrors("metadataNotSupported"));
      }

      const { metadata } = input;
      if (metadata.authorIds && metadata.authorIds.length > 0) {
        const known = await db
          .select({ id: contentAuthors.id })
          .from(contentAuthors)
          .where(
            contentAuthorsInOrganization(
              input.organizationId,
              metadata.authorIds
            )
          );
        if (known.length !== metadata.authorIds.length) {
          throw badRequest(tErrors("unknownAuthor"));
        }
      }

      const [updated] = await db.transaction(async (tx) => {
        await setPostHistoryContext(tx, {
          actorUserId: auth.user.id,
          source: "editor_autosave",
        });
        return await tx
          .update(posts)
          .set({
            ...postMetadataUpdateData(metadata),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(posts.id, input.contentId),
              eq(posts.organizationId, input.organizationId)
            )
          )
          .returning();
      });
      if (!updated) {
        throw notFound("Content not found");
      }
      const linked = postGitHubPublishSchema.safeParse(updated.githubPublish);
      let githubSyncError: string | null = null;
      if (
        linked.success &&
        (updated.contentType === "blog_post" ||
          updated.contentType === "changelog")
      ) {
        try {
          await assertContentPublishAllowed(auth.user.id, input.organizationId);
          await publishSavedContentToGitHub(
            {
              organizationId: input.organizationId,
              contentId: input.contentId,
              contentType: updated.contentType,
              repositoryId: linked.data.repositoryId,
              linkedOnly: true,
            },
            { publisherUserId: auth.user.id }
          );
        } catch (error) {
          logError("Metadata saved, but GitHub sync failed", error, {
            contentId: input.contentId,
          });
          githubSyncError = (await getTranslations("content.gitPublishing"))(
            "savedSyncFailed"
          );
        }
      }
      return { content: serializeContent(updated), githubSyncError };
    }),
  authors: contentAuthorsRouter,
  tagSuggestions: baseProcedure
    .input(contentOrganizationIdInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input }) => {
      return {
        tags: await listOrganizationTags(
          input.organizationId,
          TAG_SUGGESTIONS_LIMIT
        ),
      };
    }),
  publishChangelogToGitHub: baseProcedure
    .input(contentInputSchema.and(publishContentToGitHubSchema))
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      const { auth } = context;
      await assertActiveSubscription(input.organizationId);
      await assertContentPublishAllowed(auth.user.id, input.organizationId);

      return publishSavedContentToGitHub(input, {
        publisherUserId: auth.user.id,
      });
    }),
  delete: baseProcedure
    .input(deleteContentInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      const { auth } = context;
      const existingPost = await db.query.posts.findFirst({
        where: and(
          eq(posts.id, input.contentId),
          eq(posts.organizationId, input.organizationId)
        ),
        columns: {
          id: true,
          contentType: true,
        },
      });

      if (!existingPost) {
        throw notFound("Content not found");
      }

      await withContentPublicationLock(
        input.organizationId,
        input.contentId,
        async () => {
          if (input.removeFromRepository) {
            assertNotDemo();
            await removePublishedContent(input.organizationId, input.contentId);
          }
          await db
            .delete(posts)
            .where(
              and(
                eq(posts.id, input.contentId),
                eq(posts.organizationId, input.organizationId)
              )
            );
        }
      );

      trackServerEvent({
        event: POSTHOG_EVENTS.CONTENT_DELETED,
        headers: context.headers,
        userId: auth.user.id,
        organizationId: input.organizationId,
        properties: {
          content_id: input.contentId,
          type: existingPost.contentType,
        },
      });

      return { success: true };
    }),
  collections: {
    list: baseProcedure
      .input(postCollectionsListInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        const whereClause = and(
          eq(postCollections.organizationId, input.organizationId),
          projectScopeFilter(postCollections.projectId, input.projectId)
        );
        const offset = (input.page - 1) * input.pageSize;

        const [collectionRows, totalCountResult] = await Promise.all([
          db.query.postCollections.findMany({
            where: whereClause,
            orderBy: [
              desc(postCollections.createdAt),
              desc(postCollections.id),
            ],
            limit: input.pageSize,
            offset,
          }),
          db
            .select({ value: count() })
            .from(postCollections)
            .where(whereClause),
        ]);

        const collectionIds = collectionRows.map((collection) => collection.id);
        const aggregateRows =
          collectionIds.length > 0
            ? await db
                .select({
                  collectionId: posts.collectionId,
                  total: sql<number>`count(*)::int`,
                  draft: sql<number>`count(*) filter (where ${posts.status} <> 'published')::int`,
                  published: sql<number>`count(*) filter (where ${posts.status} = 'published')::int`,
                  postId: sql<
                    string | null
                  >`case when count(*) = 1 then min(${posts.id}) end`,
                  postTitle: sql<
                    string | null
                  >`case when count(*) = 1 then min(${posts.title}) end`,
                  types: sql<
                    string[] | null
                  >`array_agg(distinct ${posts.contentType})`,
                })
                .from(posts)
                .where(inArray(posts.collectionId, collectionIds))
                .groupBy(posts.collectionId)
            : [];

        const aggregates = new Map(
          aggregateRows.map((row) => [
            row.collectionId,
            {
              total: Number(row.total),
              draft: Number(row.draft),
              published: Number(row.published),
              types: row.types ?? [],
              postId: row.postId,
              postTitle: row.postTitle,
            },
          ])
        );

        const collections = collectionRows.map((collection) => {
          const aggregate = aggregates.get(collection.id);
          const contentTypes = normalizeContentTypes(
            aggregate && aggregate.types.length > 0
              ? aggregate.types
              : storedContentTypes(collection.contentTypes)
          );
          const postCount = aggregate?.total ?? 0;

          return {
            id: collection.id,
            name: collection.name,
            source: collection.source,
            nameSource: collection.nameSource,
            contentTypes,
            postCount,
            singlePost:
              postCount === 1 && aggregate?.postId
                ? {
                    id: aggregate.postId,
                    title: aggregate.postTitle ?? collection.name,
                  }
                : null,
            expectedPostCount: collection.expectedPostCount,
            isGenerating: isCollectionGenerating(collection),
            statusSummary: {
              total: postCount,
              draft: aggregate?.draft ?? 0,
              published: aggregate?.published ?? 0,
            },
            createdAt: collection.createdAt.toISOString(),
          };
        });

        const totalCount = totalCountResult[0]?.value ?? 0;
        const totalPages = Math.max(1, Math.ceil(totalCount / input.pageSize));

        return {
          collections,
          pagination: {
            page: input.page,
            pageSize: input.pageSize,
            totalCount,
            totalPages,
          },
        };
      }),
    get: baseProcedure
      .input(postCollectionInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        const collection = await db.query.postCollections.findFirst({
          where: and(
            eq(postCollections.id, input.collectionId),
            eq(postCollections.organizationId, input.organizationId)
          ),
          with: {
            posts: {
              columns: {
                id: true,
                title: true,
                markdown: true,
                contentType: true,
                contentSubtype: true,
                status: true,
                createdAt: true,
                updatedAt: true,
              },
              extras: postListExtras,
              orderBy: [asc(posts.createdAt), asc(posts.id)],
            },
          },
        });

        if (!collection) {
          throw notFound("Post collection not found");
        }

        const postTypes = [
          ...new Set(collection.posts.map((post) => post.contentType)),
        ];
        return {
          collection: {
            id: collection.id,
            name: collection.name,
            source: collection.source,
            nameSource: collection.nameSource,
            contentTypes: normalizeContentTypes(
              postTypes.length > 0
                ? postTypes
                : storedContentTypes(collection.contentTypes)
            ),
            expectedPostCount: collection.expectedPostCount,
            isGenerating: isCollectionGenerating(collection),
            createdAt: collection.createdAt.toISOString(),
            posts: collection.posts.map((post) => ({
              id: post.id,
              title: post.title,
              ...getContentListPreview(post),
              contentType: normalizeContentType(post.contentType),
              contentSubtype: post.contentSubtype,
              status: post.status,
              createdAt: post.createdAt.toISOString(),
              updatedAt: post.updatedAt.toISOString(),
            })),
          },
        };
      }),
    rename: baseProcedure
      .input(renamePostCollectionInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ context, input }) => {
        const { auth } = context;
        await assertActiveSubscription(input.organizationId);

        const [updatedCollection] = await db
          .update(postCollections)
          .set({
            name: input.name,
            nameSource: "user",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(postCollections.id, input.collectionId),
              eq(postCollections.organizationId, input.organizationId)
            )
          )
          .returning();

        if (!updatedCollection) {
          throw notFound("Post collection not found");
        }

        trackServerEvent({
          event: POSTHOG_EVENTS.COLLECTION_RENAMED,
          headers: context.headers,
          userId: auth.user.id,
          organizationId: input.organizationId,
          properties: {
            collection_id: updatedCollection.id,
          },
        });

        return {
          collection: {
            id: updatedCollection.id,
            name: updatedCollection.name,
            nameSource: updatedCollection.nameSource,
          },
        };
      }),
    delete: baseProcedure
      .input(postCollectionInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        const [deletedCollection] = await db
          .delete(postCollections)
          .where(
            and(
              eq(postCollections.id, input.collectionId),
              eq(postCollections.organizationId, input.organizationId),
              or(
                isNull(postCollections.expectedPostCount),
                gte(
                  postCollections.completedPostCount,
                  postCollections.expectedPostCount
                )
              )
            )
          )
          .returning({ id: postCollections.id });

        if (!deletedCollection) {
          const existingCollection = await db.query.postCollections.findFirst({
            where: and(
              eq(postCollections.id, input.collectionId),
              eq(postCollections.organizationId, input.organizationId)
            ),
            columns: { id: true },
          });

          if (!existingCollection) {
            throw notFound("Post collection not found");
          }

          throw conflict("Cannot delete a collection while it is generating");
        }

        return { success: true };
      }),
    updateExpectedPostCount: baseProcedure
      .input(updateExpectedPostCountInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        await assertActiveSubscription(input.organizationId);

        const [updatedCollection] = await db
          .update(postCollections)
          .set({
            expectedPostCount: input.expectedPostCount,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(postCollections.id, input.collectionId),
              eq(postCollections.organizationId, input.organizationId)
            )
          )
          .returning({ id: postCollections.id });

        if (!updatedCollection) {
          throw notFound("Post collection not found");
        }

        return { success: true };
      }),
  },
  metrics: {
    get: baseProcedure
      .input(contentOrganizationIdInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        return getContentPublishingMetrics(input.organizationId);
      }),
  },
  preview: baseProcedure
    .input(contentOrganizationIdInputSchema.and(contentPreviewRequestSchema))
    .use(withOrganizationAccess)
    .handler(async ({ input }) => {
      const lookback = resolveLookbackRange(
        input.lookbackWindow,
        input.timezone
      );
      const repositories = await db
        .select({
          id: githubIntegrations.id,
          owner: githubIntegrations.owner,
          repo: githubIntegrations.repo,
        })
        .from(githubIntegrations)
        .where(
          and(
            eq(githubIntegrations.organizationId, input.organizationId),
            eq(githubIntegrations.enabled, true),
            inArray(githubIntegrations.id, input.repositoryIds)
          )
        );

      const failures: RepositoryPreviewFailure[] = [];
      const repoById = new Map(
        repositories.map((repository) => [repository.id, repository])
      );

      for (const repositoryId of input.repositoryIds) {
        if (!repoById.has(repositoryId)) {
          failures.push({
            repositoryId,
            owner: null,
            repo: null,
            stage: "repository_lookup",
            message: "Repository was not found or is not enabled",
          });
        }
      }

      const validRepos = repositories.filter(
        (
          repository
        ): repository is (typeof repositories)[number] & {
          owner: string;
          repo: string;
        } => {
          if (repository.owner && repository.repo) {
            return true;
          }

          failures.push({
            repositoryId: repository.id,
            owner: repository.owner,
            repo: repository.repo,
            stage: "repository_metadata",
            message: "Repository is missing owner or name",
          });

          return false;
        }
      );

      const repositoryResults = await Promise.all(
        validRepos.map(async (repository) => {
          let token: string | null = null;

          try {
            token = await getTokenForIntegrationId(repository.id, {
              organizationId: input.organizationId,
            });
          } catch (error) {
            return {
              repository: null,
              failures: [
                {
                  repositoryId: repository.id,
                  owner: repository.owner,
                  repo: repository.repo,
                  stage: "token" as const,
                  message: formatFailureMessage(error),
                },
              ],
            };
          }

          const fetchParams = {
            octokit: createOctokit(token ?? undefined),
            owner: repository.owner,
            repo: repository.repo,
            start: lookback.start,
            end: lookback.end,
          };
          const [commitsResult, pullsResult, releasesResult] =
            await Promise.allSettled([
              input.includeCommits
                ? fetchCommitsPreview(fetchParams)
                : Promise.resolve([]),
              input.includePullRequests
                ? fetchMergedPullRequestsPreview(fetchParams)
                : Promise.resolve([]),
              input.includeReleases
                ? fetchReleasesPreview(fetchParams)
                : Promise.resolve([]),
            ]);

          const repoFailures: RepositoryPreviewFailure[] = [];
          const valueOrFailure = <T>(
            result: PromiseSettledResult<T[]>,
            stage: "commits" | "pull_requests" | "releases"
          ): T[] => {
            if (result.status === "fulfilled") {
              return result.value;
            }
            repoFailures.push({
              repositoryId: repository.id,
              owner: repository.owner,
              repo: repository.repo,
              stage,
              message: formatFailureMessage(result.reason),
            });
            return [];
          };
          const commits = valueOrFailure(commitsResult, "commits");
          const pullRequests = valueOrFailure(pullsResult, "pull_requests");
          const releases = valueOrFailure(releasesResult, "releases");

          return {
            repository: {
              repositoryId: repository.id,
              owner: repository.owner,
              repo: repository.repo,
              commits,
              pullRequests,
              releases,
            } satisfies RepositoryPreview,
            failures: repoFailures,
          };
        })
      );

      const results = repositoryResults
        .map((result) => {
          failures.push(...result.failures);
          return result.repository;
        })
        .filter(
          (repository): repository is RepositoryPreview => repository !== null
        );

      let linearIntegrationPreviews: LinearIntegrationPreviewItem[] = [];

      if (input.linearIntegrationIds && input.linearIntegrationIds.length > 0) {
        const linearIntegrations = await getLinearIntegrationsByOrganization(
          input.organizationId
        );
        const requestedIds = new Set(input.linearIntegrationIds);
        const enabledIntegrations = linearIntegrations.filter(
          (i) => i.enabled && requestedIds.has(i.id)
        );

        linearIntegrationPreviews = await Promise.all(
          enabledIntegrations.map(async (integration) => {
            const empty = {
              integrationId: integration.id,
              displayName: integration.displayName,
              issues: [],
            };
            try {
              const token = await getDecryptedLinearToken(integration.id);
              if (!token) {
                return empty;
              }

              const client = createLinearClient(token);
              const filter: Record<string, unknown> = {
                completedAt: {
                  gte: lookback.start.toISOString(),
                  lte: lookback.end.toISOString(),
                },
              };

              if (integration.linearTeamId) {
                filter.team = { id: { eq: integration.linearTeamId } };
              }

              const issues = await getLinearIssuePreviews(client, {
                filter,
                first: 50,
                orderBy: "updatedAt" as never,
              });

              return {
                integrationId: integration.id,
                displayName: integration.displayName,
                issues,
              };
            } catch (error) {
              logError("[Preview] Failed to fetch Linear issues", error, {
                integrationId: integration.id,
              });
              return empty;
            }
          })
        );
      }

      return {
        repositories: results,
        linearIntegrations:
          linearIntegrationPreviews.length > 0
            ? linearIntegrationPreviews
            : undefined,
        failures,
      };
    }),
  createCollection: baseProcedure
    .input(createPostCollectionInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input }) => {
      await assertActiveSubscription(input.organizationId);

      if (
        input.projectId &&
        !(await isProjectInOrganization(input.organizationId, input.projectId))
      ) {
        throw badRequest((await getTranslations("errors.server"))("notFound"));
      }

      const now = new Date();
      const collectionId = nanoid();

      await db.insert(postCollections).values({
        id: collectionId,
        organizationId: input.organizationId,
        projectId: input.projectId ?? null,
        source: "manual",
        sourceId: collectionId,
        name: buildPostCollectionName(input.contentTypes, now),
        nameSource: "generated",
        contentTypes: input.contentTypes,
        expectedPostCount: input.expectedPostCount,
        completedPostCount: 0,
        createdAt: now,
        updatedAt: now,
      });

      return { collectionId };
    }),
  generate: baseProcedure
    .input(generateContentInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      const { auth } = context;
      await assertActiveSubscription(input.organizationId);

      const collection = await db.query.postCollections.findFirst({
        where: and(
          eq(postCollections.id, input.collectionId),
          eq(postCollections.organizationId, input.organizationId)
        ),
      });

      if (!collection) {
        throw notFound("Post collection not found");
      }

      if (
        !input.dataPoints.includePullRequests &&
        !input.dataPoints.includeCommits &&
        !input.dataPoints.includeReleases &&
        !input.dataPoints.includeLinearData
      ) {
        const tErrors = await getTranslations("errors.content");
        throw badRequest(tErrors("dataSourceRequired"));
      }

      if (input.selectedItems) {
        const hasAnySelected =
          (input.selectedItems.commitShas?.length ?? 0) > 0 ||
          (input.selectedItems.pullRequestNumbers?.length ?? 0) > 0 ||
          (input.selectedItems.releaseTagNames?.length ?? 0) > 0 ||
          (input.selectedItems.linearIssueIds?.length ?? 0) > 0;

        if (!hasAnySelected) {
          const tErrors = await getTranslations("errors.content");
          throw badRequest(tErrors("eventRequired"));
        }
      }

      let billing: Awaited<ReturnType<typeof checkContentBilling>>;
      try {
        billing = await checkContentBilling({
          organizationId: input.organizationId,
          outputType: input.contentType,
        });
      } catch {
        throw internalServerError("Failed to verify plan limits");
      }

      if (!billing.allowed) {
        trackServerEvent({
          event: POSTHOG_EVENTS.CONTENT_GENERATION_DENIED,
          headers: context.headers,
          userId: auth.user.id,
          organizationId: input.organizationId,
          properties: {
            reason: billing.reason ?? null,
            format: input.contentType,
          },
        });
        throw paymentRequired(
          (await getTranslations("errors.billing"))("contentLimitReached")
        );
      }

      const runId = generateRunId("manual_on_demand");

      trackServerEvent({
        event: POSTHOG_EVENTS.CONTENT_GENERATION_REQUESTED,
        headers: context.headers,
        userId: auth.user.id,
        organizationId: input.organizationId,
        properties: {
          format: input.contentType,
          voice_id: input.brandIdentityId ?? input.brandVoiceId ?? null,
          source_count:
            (input.repositoryIds ?? input.integrations?.github ?? []).length +
            (input.linearIntegrationIds ?? input.integrations?.linear ?? [])
              .length,
          data_points: getEnabledDataPoints(input.dataPoints),
          lookback: input.lookbackWindow,
          collection_id: input.collectionId,
          run_id: runId,
        },
      });

      await addActiveGeneration(input.organizationId, {
        runId,
        triggerId: "manual_on_demand",
        outputType: input.contentType,
        triggerName: input.contentType,
        startedAt: new Date().toISOString(),
        source: "dashboard",
      });

      let linearIntegrationIds: string[] | undefined;
      if (input.dataPoints.includeLinearData) {
        const linearIntegrations = await getLinearIntegrationsByOrganization(
          input.organizationId
        );
        const requestedLinearIds = new Set(
          input.linearIntegrationIds ?? input.integrations?.linear ?? []
        );

        linearIntegrationIds = linearIntegrations
          .filter(
            (integration) =>
              integration.enabled &&
              (requestedLinearIds.size === 0 ||
                requestedLinearIds.has(integration.id))
          )
          .map((integration) => integration.id);
      }

      await startOnDemandRun({
        organizationId: input.organizationId,
        userId: auth.user.id,
        collectionId: input.collectionId,
        runId,
        contentType: input.contentType,
        lookbackWindow: input.lookbackWindow,
        timezone: input.timezone,
        repositoryIds: input.repositoryIds ?? input.integrations?.github,
        linearIntegrationIds,
        brandVoiceId: input.brandIdentityId ?? input.brandVoiceId,
        dataPoints: input.dataPoints,
        selectedItems: input.selectedItems,
        aiCreditReserved: billing.mode === "ai_credits",
        aiCreditMarkup: billing.useMarkup,
        source: "dashboard",
      });

      return {
        success: true,
        runId,
      };
    }),
  activeGenerations: {
    list: baseProcedure
      .input(contentOrganizationIdInputSchema)
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        const [generations, results] = await Promise.all([
          getActiveGenerations(input.organizationId),
          getCompletedGenerations(input.organizationId),
        ]);

        return { generations, results };
      }),
    clearCompleted: baseProcedure
      .input(
        contentOrganizationIdInputSchema.and(clearCompletedGenerationSchema)
      )
      .use(withOrganizationAccess)
      .handler(async ({ input }) => {
        await assertActiveSubscription(input.organizationId);

        await clearCompletedGeneration(input.organizationId, input.runId);

        return { success: true };
      }),
  },
};
