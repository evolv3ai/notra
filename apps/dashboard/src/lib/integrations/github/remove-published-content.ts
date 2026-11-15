import { getGitHubPublishToken } from "@notra/ai/integrations/github-publish-auth";
import { closeContentPublicationForPullRequest } from "@notra/ai/utils/content-publication";
import { createOctokit } from "@notra/ai/utils/octokit";
import { db } from "@notra/db/drizzle";
import { githubIntegrations, posts, repositoryOutputs } from "@notra/db/schema";
import { withAdvisorySessionLocks } from "@notra/db/utils/advisory-session-lock";
import { postGitHubPublishSchema } from "@notra/schemas/dashboard/content";
import { repositoryContentDirectoryConfigSchema } from "@notra/schemas/dashboard/integrations";
import { and, eq, ne } from "drizzle-orm";

import { withContentPublicationLock } from "@/lib/integrations/github/content-publication-lock";
import { resolveContentReviewProcess } from "@/lib/integrations/github/content-review-process";
import { publishContentDraftPullRequest } from "@/lib/integrations/github/publish-content-to-github";
import { findSiteGitHubPublishTarget } from "@/lib/integrations/github/site-publish-target";
import { notFound } from "@/lib/orpc/utils/errors";
import { hasGitHubStatus } from "@/utils/github-publish-failure";

/** Remove only the exact files recorded by Notra's publication, never a directory glob. */
export async function removePublishedContent(
  organizationId: string,
  contentId: string
) {
  return await withContentPublicationLock(
    organizationId,
    contentId,
    async () => {
      const post = await db.query.posts.findFirst({
        where: and(
          eq(posts.id, contentId),
          eq(posts.organizationId, organizationId)
        ),
        columns: { githubPublish: true },
      });
      const publication = postGitHubPublishSchema.safeParse(
        post?.githubPublish
      ).data;
      if (!publication) {
        return null;
      }
      return await withAdvisorySessionLocks(
        [
          [
            "content-publish-repository",
            organizationId,
            publication.repositoryId,
          ],
        ],
        () => removeContent(organizationId, contentId)
      );
    }
  );
}

async function removeContent(organizationId: string, contentId: string) {
  const post = await db.query.posts.findFirst({
    where: and(
      eq(posts.id, contentId),
      eq(posts.organizationId, organizationId)
    ),
    with: { collection: { columns: { projectId: true } } },
  });
  const linked = postGitHubPublishSchema.safeParse(post?.githubPublish);
  if (
    !post ||
    !linked.success ||
    (post.contentType !== "blog_post" && post.contentType !== "changelog")
  ) {
    return null;
  }
  const publication = linked.data;
  const contentType = post.contentType;
  const repository = await db.query.githubIntegrations.findFirst({
    where: and(
      eq(githubIntegrations.id, publication.repositoryId),
      eq(githubIntegrations.organizationId, organizationId)
    ),
  });
  if (!repository?.owner || !repository.repo || !repository.defaultBranch) {
    throw notFound("Repository not found");
  }
  const owner = repository.owner;
  const repo = repository.repo;
  const token = await getGitHubPublishToken(repository.id, { organizationId });
  const octokit = createOctokit(token ?? undefined);
  const pullRequest = publication.pullRequestNumber
    ? (
        await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
          owner,
          repo,
          pull_number: publication.pullRequestNumber,
        })
      ).data
    : null;
  const baseBranch = pullRequest?.base.ref ?? publication.baseBranch;
  const output = await db.query.repositoryOutputs.findFirst({
    where: and(
      eq(repositoryOutputs.repositoryId, repository.id),
      eq(repositoryOutputs.outputType, post.contentType)
    ),
  });
  const config = repositoryContentDirectoryConfigSchema.safeParse(
    output?.config
  );
  const site = await findSiteGitHubPublishTarget({
    organizationId,
    existingPublication: { ...publication, baseBranch },
    siteId: publication.siteId ?? config.data?.siteId,
    contentType,
    repository: {
      id: repository.id,
      owner,
      repo,
      githubRepositoryId: repository.githubRepositoryId,
    },
  });
  const branch =
    baseBranch ?? site?.productionBranch ?? repository.defaultBranch;
  const otherPosts = await db.query.posts.findMany({
    where: and(
      eq(posts.organizationId, organizationId),
      ne(posts.id, contentId)
    ),
    columns: { githubPublish: true },
  });
  const sharedAssets = new Set(
    otherPosts.flatMap((other) => {
      const linked = postGitHubPublishSchema.safeParse(
        other.githubPublish
      ).data;
      return linked?.owner.toLowerCase() === owner.toLowerCase() &&
        linked.repo.toLowerCase() === repo.toLowerCase()
        ? (linked.assetPaths ?? [])
        : [];
    })
  );
  const ownedPaths = [
    publication.path,
    ...(publication.assetPaths ?? []).filter((path) => !sharedAssets.has(path)),
  ];
  const existing = await Promise.all(
    ownedPaths.map(async (path) => {
      try {
        await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
          owner,
          repo,
          path,
          ref: branch,
        });
        return path;
      } catch (error) {
        if (!hasGitHubStatus(error, 404)) {
          throw error;
        }
        return null;
      }
    })
  );
  const deletions = existing.filter((path) => path !== null);
  let result = null;
  if (deletions.length) {
    const remove = async () => {
      const decision = await resolveContentReviewProcess({
        reviewProcess: output?.reviewProcess ?? "pull_request",
        token: token ?? "",
        repository: {
          organizationId,
          integrationId: repository.id,
          githubRepositoryId: repository.githubRepositoryId,
          installationId: "",
          owner,
          repo,
        },
        branch,
        siteId: site?.siteId,
        rootDirectory: site?.rootDirectory,
        path: publication.path,
        targetBranch: publication.branchName,
      });
      return await publishContentDraftPullRequest(octokit, {
        contentId: `${contentId}-remove-${crypto.randomUUID()}`,
        contentType,
        owner,
        repo,
        defaultBranch: branch,
        path: publication.path,
        title: `Remove ${post.title}`,
        markdown: "",
        direct: decision.direct,
        deletions,
        ownedPaths,
        writtenBlobs: publication.writtenBlobs,
        previousHeadSha: publication.headSha,
      });
    };
    result = site
      ? await withAdvisorySessionLocks(
          [
            ["sites-branch", site.siteId, branch],
            ["sites-branch-edits", site.siteId, branch],
          ],
          remove
        )
      : await remove();
  }
  if (publication.pullRequestNumber) {
    const { data: pr } = await octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}",
      {
        owner,
        repo,
        pull_number: publication.pullRequestNumber,
      }
    );
    if (pr.state === "open") {
      await octokit.request("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", {
        owner,
        repo,
        pull_number: publication.pullRequestNumber,
        state: "closed",
      });
    }
    await closeContentPublicationForPullRequest({
      owner,
      repo,
      pullRequestNumber: publication.pullRequestNumber,
      merged: Boolean(pr.merged_at),
    });
  }
  return result;
}
