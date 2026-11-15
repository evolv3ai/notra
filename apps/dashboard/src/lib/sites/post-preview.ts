import { db } from "@notra/db/drizzle";
import { posts, siteJobs, sites } from "@notra/db/schema";
import { postGitHubPublishSchema } from "@notra/schemas/dashboard/content";
import { postPreviewKey } from "@notra/sites-core/utils/hosts";
import { isPreviewExpired } from "@notra/sites-core/utils/serving-state";
import { siteRepositoryAccess } from "@notra/sites-server/github";
import { readPostPreviewSource } from "@notra/sites-server/post-preview-source";
import {
  createPostPreview,
  latestPreviewDeployment,
} from "@notra/sites-server/previews";
import { readServingState } from "@notra/sites-server/state";
import type {
  PostPreviewAccessInput,
  Site,
} from "@notra/sites-server/types/sites";
import { sitePreviewOrigin } from "@notra/sites-server/utils/urls";
import { slugify } from "@notra/utils/slugify";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import {
  SITE_ENTRY_DIRECTORIES,
  SITE_ENTRY_EXTENSION,
} from "@/constants/site-github-publish";
import { getTranslations } from "@/lib/i18n/server";
import { resolveGitHubContentPath } from "@/lib/integrations/github/publish-content-to-github";
import { prepareSiteEntryFiles } from "@/lib/integrations/github/site-entry-files";
import { resolveSiteEntryContext } from "@/lib/integrations/github/site-publish-target";
import { badRequest, notFound } from "@/lib/orpc/utils/errors";
import type { GitHubPublishContentType } from "@/types/integrations/github";
import {
  normalizeSiteRootDirectory,
  resolveSiteEntryDirectory,
  resolveSiteEntrySlug,
} from "@/utils/site-github-publish";

function isSiteContentType(type: string): type is GitHubPublishContentType {
  return type in SITE_ENTRY_DIRECTORIES;
}

async function loadPost(organizationId: string, postId: string) {
  const post = await db.query.posts.findFirst({
    where: and(eq(posts.id, postId), eq(posts.organizationId, organizationId)),
    columns: {
      title: true,
      slug: true,
      markdown: true,
      contentType: true,
      githubPublish: true,
      createdAt: true,
      publishedAt: true,
      coverImage: true,
      tags: true,
      excerpt: true,
      authorIds: true,
      featured: true,
      noindex: true,
      hidden: true,
      displayDate: true,
    },
  });
  if (!post) {
    throw notFound("Content not found");
  }
  return post;
}

/** Sites with a blog or changelog mount that fits this post. */
export async function listPostPreviewSites(
  organizationId: string,
  postId: string
) {
  const post = await loadPost(organizationId, postId);
  if (!isSiteContentType(post.contentType)) {
    return [];
  }
  const section = SITE_ENTRY_DIRECTORIES[post.contentType];
  const rows = await db
    .select({
      id: sites.id,
      name: sites.name,
      mounts: sites.mounts,
      previewsEnabled: sites.previewsEnabled,
      status: sites.status,
    })
    .from(sites)
    .where(eq(sites.organizationId, organizationId))
    .orderBy(asc(sites.createdAt));
  return rows
    .filter((site) => site.status === "active" && site.mounts[section])
    .map((site) => ({
      id: site.id,
      name: site.name,
      previewsEnabled: site.previewsEnabled,
    }));
}

/** Where the post lives in the site's repository, and its page on the site. */
function postEntryLocation(
  site: Site,
  postId: string,
  post: Awaited<ReturnType<typeof loadPost>> & {
    contentType: GitHubPublishContentType;
  }
) {
  const rootDirectory = normalizeSiteRootDirectory(site.rootDirectory);
  const slug = resolveSiteEntrySlug({
    contentId: postId,
    slug: post.slug,
    title: post.title,
  });
  const published = postGitHubPublishSchema.safeParse(post.githubPublish);
  // Only reuse a published path the site builds; others never reach the build.
  const path =
    published.success &&
    published.data.owner.toLowerCase() ===
      site.repositoryOwner?.toLowerCase() &&
    published.data.repo.toLowerCase() === site.repositoryName?.toLowerCase() &&
    (!rootDirectory || published.data.path.startsWith(`${rootDirectory}/`))
      ? published.data.path
      : resolveGitHubContentPath({
          contentId: postId,
          directory: resolveSiteEntryDirectory(rootDirectory, post.contentType),
          pathTemplate: null,
          slug,
          title: post.title,
        });
  const mount = site.mounts[SITE_ENTRY_DIRECTORIES[post.contentType]] ?? "/";
  // The theme names entries after their file.
  const name = slugify(
    path.split("/").at(-1)?.replace(SITE_ENTRY_EXTENSION, "") ?? ""
  );
  return {
    rootDirectory,
    slug: slugify(slug) || postId,
    path,
    pagePath: `${mount === "/" ? "" : mount}/${name}`,
  };
}

/**
 * Builds the site with the saved post laid over the production branch, the
 * same files a GitHub publish would write, without a branch or pull request.
 */
export async function previewPostOnSite(
  params: {
    site: Site;
    postId: string;
    userId?: string;
  } & PostPreviewAccessInput
) {
  const { site } = params;
  const [post, tErrors] = await Promise.all([
    loadPost(site.organizationId, params.postId),
    getTranslations("errors.content"),
  ]);
  const { contentType, markdown } = post;
  if (!isSiteContentType(contentType)) {
    throw badRequest(tErrors("sitePreviewUnsupported"));
  }
  if (!site.mounts[SITE_ENTRY_DIRECTORIES[contentType]]) {
    throw badRequest(tErrors("sitePreviewNoSection"));
  }
  if (!markdown) {
    throw badRequest(tErrors("saveBeforePublishing"));
  }
  const entry = postEntryLocation(site, params.postId, {
    ...post,
    contentType,
  });
  const { repository, token } = await siteRepositoryAccess(site, {
    contents: "read",
  });
  const siteEntry = await resolveSiteEntryContext({
    token,
    owner: repository.owner,
    repo: repository.repo,
    contentType,
    path: entry.path,
    target: {
      siteId: site.id,
      rootDirectory: entry.rootDirectory,
      productionBranch: site.productionBranch,
      sectionMounted: true,
    },
    publisherUserId: params.userId,
    existingEntry: undefined,
  });
  const prepared = await prepareSiteEntryFiles({
    post: { ...post, markdown },
    contentType,
    contentPath: entry.path,
    organizationId: site.organizationId,
    rootDirectory: entry.rootDirectory,
    slug: entry.slug,
    siteEntry,
  });
  const prefix = entry.rootDirectory ? `${entry.rootDirectory}/` : "";
  const files = [
    { path: entry.path, contents: new TextEncoder().encode(prepared.markdown) },
    ...prepared.assets.map((asset) => ({
      path: asset.path,
      contents: asset.contents,
    })),
  ].filter((file) => file.path.startsWith(prefix));
  const { jobId, previewKey } = await createPostPreview(site, {
    postId: params.postId,
    title: post.title,
    pagePath: entry.pagePath,
    userId: params.userId,
    lifetime: params.lifetime,
    password: params.password,
    files: files.map((file) => ({
      ...file,
      path: file.path.slice(prefix.length),
    })),
  });
  return { jobId, previewKey, pagePath: entry.pagePath };
}

export async function postPreviewStatus(site: Site, postId: string) {
  const post = await loadPost(site.organizationId, postId);
  const { contentType } = post;
  if (!isSiteContentType(contentType)) {
    return null;
  }
  const previewKey = postPreviewKey(postId, site.slug);
  const [deployment, source, serving, removals] = await Promise.all([
    latestPreviewDeployment(site.id, previewKey),
    readPostPreviewSource(site.id, previewKey),
    readServingState(site.id),
    db
      .select({ payload: siteJobs.payload })
      .from(siteJobs)
      .where(
        and(
          eq(siteJobs.siteId, site.id),
          eq(siteJobs.kind, "remove_preview"),
          inArray(siteJobs.status, ["pending", "running"]),
          sql`${siteJobs.payload}->>'previewKey' = ${previewKey}`
        )
      ),
  ]);
  if (!(deployment && source)) {
    return null;
  }
  const pointer = serving?.state.previews[previewKey] ?? null;
  // The page this build has, even if the slug changed since.
  const { pagePath } = source;
  return {
    previewKey,
    status: deployment.status,
    deleting: removals.some(
      ({ payload }) =>
        "generation" in payload &&
        typeof payload.generation === "number" &&
        payload.generation >= source.generation
    ),
    errorMessage: deployment.errorMessage,
    createdAt: deployment.createdAt,
    live: pointer !== null && !isPreviewExpired(pointer, new Date()),
    lifetime: source.access.lifetime,
    expiresAt: source.access.expiresAt,
    hasPassword: source.access.password !== null,
    pagePath,
    url: `${sitePreviewOrigin(site.slug, previewKey)}${pagePath}`,
  };
}
