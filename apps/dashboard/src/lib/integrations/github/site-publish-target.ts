import { GITHUB_API_VERSION_HEADERS } from "@notra/ai/constants/github";
import {
  createOctokit,
  GITHUB_INTERACTIVE_READ_TIMEOUT_MS,
} from "@notra/ai/utils/octokit";
import { db } from "@notra/db/drizzle";
import { sites, users } from "@notra/db/schema";
import { and, asc, eq, or, sql } from "drizzle-orm";

import { SITE_ENTRY_DIRECTORIES } from "@/constants/site-github-publish";
import { getTranslations } from "@/lib/i18n/server";
import { badRequest } from "@/lib/orpc/utils/errors";
import type {
  SiteGitHubPublishTarget,
  FindSiteGitHubPublishTargetParams,
  ReadSiteRepositoryTextFileParams,
  ResolveSiteEntryContextParams,
  SiteEntryContext,
} from "@/types/integrations/site-github-publish";
import { hasGitHubStatus } from "@/utils/github-publish-failure";
import {
  normalizeSiteRootDirectory,
  parseSiteConfigAuthors,
  readSiteEntryAuthor,
  resolveSiteAuthor,
  resolveSiteConfigPath,
} from "@/utils/site-github-publish";

export async function listSiteGitHubPublishTargets(
  params: FindSiteGitHubPublishTargetParams
) {
  const { repository } = params;
  return await db
    .select({
      id: sites.id,
      name: sites.name,
      rootDirectory: sites.rootDirectory,
      productionBranch: sites.productionBranch,
      mounts: sites.mounts,
    })
    .from(sites)
    .where(
      and(
        eq(sites.organizationId, params.organizationId),
        params.projectId && !params.existingPublication
          ? eq(sites.projectId, params.projectId)
          : undefined,
        or(
          eq(sites.repositoryId, repository.id),
          repository.githubRepositoryId
            ? eq(sites.githubRepositoryId, repository.githubRepositoryId)
            : undefined,
          and(
            sql`lower(${sites.repositoryOwner}) = ${repository.owner.toLowerCase()}`,
            sql`lower(${sites.repositoryName}) = ${repository.repo.toLowerCase()}`
          )
        )
      )
    )
    .orderBy(asc(sites.createdAt));
}

export async function findSiteGitHubPublishTarget(
  params: FindSiteGitHubPublishTargetParams
): Promise<SiteGitHubPublishTarget | null> {
  const candidates = await listSiteGitHubPublishTargets(params);
  const previous = params.existingPublication;
  const previousSite = candidates.find((site) => site.id === previous?.siteId);
  const stale = Boolean(previous?.siteId && !previousSite);
  const matchingTarget = previous?.baseBranch
    ? candidates
        .filter((site) => {
          const root = normalizeSiteRootDirectory(site.rootDirectory);
          return (
            site.productionBranch === previous.baseBranch &&
            (!root || previous.path.startsWith(`${root}/`))
          );
        })
        .sort((a, b) => b.rootDirectory.length - a.rootDirectory.length)
    : [];
  const recovered =
    matchingTarget.length === 1 ||
    (matchingTarget[0] &&
      matchingTarget[0].rootDirectory.length >
        (matchingTarget[1]?.rootDirectory.length ?? -1))
      ? matchingTarget[0]
      : undefined;
  const selected =
    previousSite ??
    (stale ? undefined : recovered) ??
    candidates.find((site) => site.id === params.siteId);
  // A deleted/moved site ID cannot poison every subsequent save. Ask for a
  // new explicit destination, rather than silently choosing another site.
  if (
    (stale && !selected) ||
    (params.siteId && !selected) ||
    (candidates.length > 1 && !selected)
  ) {
    throw badRequest(
      (await getTranslations("errors.content"))("choosePublishingSite")
    );
  }
  if (candidates.length === 0) {
    return null;
  }

  const section = SITE_ENTRY_DIRECTORIES[params.contentType];
  const site = selected ?? candidates[0];
  if (!site) {
    return null;
  }
  return {
    siteId: site.id,
    rootDirectory: normalizeSiteRootDirectory(site.rootDirectory),
    productionBranch: previous?.baseBranch ?? site.productionBranch,
    sectionMounted: Boolean(site.mounts[section]),
  };
}

async function readRepositoryTextFile(
  token: string,
  params: ReadSiteRepositoryTextFileParams,
  options: { strict?: boolean } = {}
): Promise<string | null> {
  try {
    const { data } = await createOctokit(token, {
      requestTimeoutMs: GITHUB_INTERACTIVE_READ_TIMEOUT_MS,
    }).request("GET /repos/{owner}/{repo}/contents/{path}", {
      ...params,
      headers: GITHUB_API_VERSION_HEADERS,
    });
    if (
      Array.isArray(data) ||
      data.type !== "file" ||
      typeof data.content !== "string"
    ) {
      return null;
    }
    return Buffer.from(data.content, "base64").toString("utf8");
  } catch (error) {
    if (options.strict && !hasGitHubStatus(error, 404)) {
      throw error;
    }
    return null;
  }
}

async function readPublisherName(userId: string | undefined) {
  if (!userId) {
    return null;
  }
  const user = await db.query.users.findFirst({
    columns: { name: true },
    where: eq(users.id, userId),
  });
  return user?.name ?? null;
}

/**
 * Reads what the repository already has for this entry: the open pull
 * request's version if there is one, otherwise the live file. Also resolves
 * the legacy author fallback (the publisher, matched against notra.json).
 */
export async function resolveSiteEntryContext(
  params: ResolveSiteEntryContextParams
): Promise<SiteEntryContext> {
  const productionPath = params.existingEntry?.path ?? params.path;
  const [branchMarkdown, liveMarkdown, publisherName, siteConfig] =
    await Promise.all([
      params.existingEntry
        ? readRepositoryTextFile(
            params.token,
            {
              owner: params.owner,
              repo: params.repo,
              path: params.existingEntry.path,
              ref: params.existingEntry.branchName,
            },
            { strict: true }
          )
        : null,
      readRepositoryTextFile(
        params.token,
        {
          owner: params.owner,
          repo: params.repo,
          path: productionPath,
          ref: params.target.productionBranch,
        },
        { strict: true }
      ),
      params.contentType === "blog_post"
        ? readPublisherName(params.publisherUserId)
        : null,
      params.contentType === "blog_post"
        ? readRepositoryTextFile(params.token, {
            owner: params.owner,
            repo: params.repo,
            path: resolveSiteConfigPath(params.target.rootDirectory),
            ref: params.target.productionBranch,
          })
        : null,
    ]);
  const existingMarkdown = branchMarkdown ?? liveMarkdown;
  const existingAuthor = existingMarkdown
    ? readSiteEntryAuthor(existingMarkdown)
    : null;
  return {
    existingMarkdown,
    isLive: liveMarkdown !== null,
    author:
      params.contentType === "blog_post"
        ? (existingAuthor ??
          resolveSiteAuthor(
            siteConfig ? parseSiteConfigAuthors(siteConfig) : {},
            publisherName
          ))
        : null,
  };
}
