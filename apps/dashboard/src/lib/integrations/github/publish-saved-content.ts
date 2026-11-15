import {
  getGitHubAppBotLogin,
  getGitHubAppInstallationPublishAccess,
  isGitHubAppConfigured,
  listGitHubAppInstallationsByOrganization,
} from "@notra/ai/integrations/github";
import {
  getGitHubPublishTokenEffect,
  selectGitHubAppInstallationForOwner,
} from "@notra/ai/integrations/github-publish-auth";
import {
  findOpenContentPublicationForPost,
  closeContentPublicationForPullRequest,
  reconcileContentPublication,
} from "@notra/ai/utils/content-publication";
import { githubAncestryValidator } from "@notra/ai/utils/github-ancestry";
import { githubAppInstallationCanPublishContent } from "@notra/ai/utils/github-app-publish-access";
import { getGitHubConnectionMethod } from "@notra/ai/utils/github-connection-method";
import { createOctokit } from "@notra/ai/utils/octokit";
import { retryWrite } from "@notra/ai/utils/retry-write";
import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import {
  githubAppInstallations,
  githubIntegrations,
  organizations,
  posts,
  repositoryOutputs,
  contentPublications,
} from "@notra/db/schema";
import { withAdvisorySessionLocks } from "@notra/db/utils/advisory-session-lock";
import { GITHUB_CONTENT_PATH_MAX_LENGTH } from "@notra/schemas/constants/dashboard/github";
import { postGitHubPublishSchema } from "@notra/schemas/dashboard/content";
import { repositoryContentDirectoryConfigSchema } from "@notra/schemas/dashboard/integrations";
import { slugify } from "@notra/utils/slugify";
import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

import {
  DEFAULT_GITHUB_CONTENT_DIRECTORIES,
  DEFAULT_GITHUB_CONTENT_OUTPUT_ENABLED,
} from "@/constants/github";
import { getTranslations } from "@/lib/i18n/server";
import {
  prepareR2GitHubContentAssets,
  resolveGitHubImagePathTemplate,
} from "@/lib/integrations/github/content-assets";
import { withContentPublicationLock } from "@/lib/integrations/github/content-publication-lock";
import { resolveContentReviewProcess } from "@/lib/integrations/github/content-review-process";
import { clearGitHubPublishFailures } from "@/lib/integrations/github/github-publish-failure-state";
import {
  publishContentDraftPullRequest,
  resolveGitHubContentPath,
} from "@/lib/integrations/github/publish-content-to-github";
import {
  buildOpenInNotraBadgeUrls,
  resolveNotraBaseUrl,
} from "@/lib/integrations/github/pull-request-body";
import { prepareSiteEntryFiles } from "@/lib/integrations/github/site-entry-files";
import {
  findSiteGitHubPublishTarget,
  resolveSiteEntryContext,
} from "@/lib/integrations/github/site-publish-target";
import { runOrpcEffect } from "@/lib/orpc/effect";
import {
  badRequest,
  serviceUnavailable,
  forbidden,
  internalServerError,
  notFound,
} from "@/lib/orpc/utils/errors";
import {
  getGitHubRecoveryMessage,
  toGitHubPublishOrpcError,
} from "@/lib/orpc/utils/github-publish-error";
import { startContentPublicationReconciliation } from "@/lib/workflows/start";
import type {
  PublishSavedContentInput,
  PublishSavedContentOptions,
} from "@/types/integrations/github-publish";
import { githubBlobSha } from "@/utils/github-blob-sha";
import { toGitHubOperationOrpcError } from "@/utils/github-operation-error";
import { getGitHubAppPermissionsRecovery } from "@/utils/github-publish-policy";
import {
  resolveSiteEntryDirectory,
  resolveSiteEntrySlug,
} from "@/utils/site-github-publish";

export async function publishSavedContentToGitHub(
  input: PublishSavedContentInput,
  options: PublishSavedContentOptions = {}
) {
  return await withContentPublicationLock(
    input.organizationId,
    input.contentId,
    () =>
      withAdvisorySessionLocks(
        [
          [
            "content-publish-repository",
            input.organizationId,
            input.repositoryId,
          ],
        ],
        () => publishSavedContent(input, options)
      )
  );
}

async function publishSavedContent(
  input: PublishSavedContentInput,
  options: PublishSavedContentOptions
) {
  const [post, integration, organization] = await Promise.all([
    db.query.posts.findFirst({
      where: and(
        eq(posts.id, input.contentId),
        eq(posts.organizationId, input.organizationId)
      ),
      with: { collection: { columns: { projectId: true } } },
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
    }),
    db
      .select({
        id: githubIntegrations.id,
        owner: githubIntegrations.owner,
        repo: githubIntegrations.repo,
        githubRepositoryId: githubIntegrations.githubRepositoryId,
        defaultBranch: githubIntegrations.defaultBranch,
        installationId: githubAppInstallations.installationId,
        installationAccountType: githubAppInstallations.accountType,
        installationAccountLogin: githubAppInstallations.accountLogin,
        githubAppInstallationId: githubIntegrations.githubAppInstallationId,
        encryptedToken: githubIntegrations.encryptedToken,
        outputConfig: repositoryOutputs.config,
        outputEnabled: repositoryOutputs.enabled,
        outputId: repositoryOutputs.id,
        reviewProcess: repositoryOutputs.reviewProcess,
      })
      .from(githubIntegrations)
      .leftJoin(
        githubAppInstallations,
        and(
          eq(
            githubIntegrations.githubAppInstallationId,
            githubAppInstallations.id
          ),
          eq(githubAppInstallations.organizationId, input.organizationId)
        )
      )
      .leftJoin(
        repositoryOutputs,
        and(
          eq(repositoryOutputs.repositoryId, githubIntegrations.id),
          eq(repositoryOutputs.outputType, input.contentType)
        )
      )
      .where(
        and(
          eq(githubIntegrations.organizationId, input.organizationId),
          eq(githubIntegrations.id, input.repositoryId),
          eq(githubIntegrations.enabled, true),
          eq(githubIntegrations.repositoryEnabled, true)
        )
      )
      .limit(1)
      .then(([result]) => result),
    db.query.organizations.findFirst({
      columns: { slug: true },
      where: eq(organizations.id, input.organizationId),
    }),
  ]);

  if (!post) {
    throw notFound("Content not found");
  }
  if (post.contentType !== input.contentType) {
    const tErrors = await getTranslations("errors.content");
    throw badRequest(tErrors("contentTypeMismatch"));
  }
  if (!post.markdown) {
    const tErrors = await getTranslations("errors.content");
    throw badRequest(tErrors("saveBeforePublishing"));
  }
  const savedMarkdown = post.markdown;
  if (!(integration?.owner && integration.repo)) {
    throw notFound("Selected GitHub repository not found");
  }
  if (!integration.defaultBranch) {
    const tErrors = await getTranslations("errors.content");
    throw badRequest(tErrors("noDefaultBranch"));
  }
  const repositoryOwner = integration.owner;
  const repositoryName = integration.repo;
  const defaultBranch = integration.defaultBranch;
  const connectionMethod = isGitHubAppConfigured()
    ? "github-app"
    : getGitHubConnectionMethod(integration);
  if (connectionMethod === "unauthenticated") {
    const tErrors = await getTranslations("errors.content");
    throw forbidden(tErrors("connectViaGithubApp"), {
      code: "github_repository_connection_required",
    });
  }
  let contentOutput = integration.outputId
    ? {
        id: integration.outputId,
        config: integration.outputConfig,
        reviewProcess: integration.reviewProcess,
        enabled: integration.outputEnabled ?? false,
      }
    : null;
  if (!contentOutput) {
    if (!DEFAULT_GITHUB_CONTENT_OUTPUT_ENABLED[input.contentType]) {
      const tErrors = await getTranslations("errors.content");
      throw forbidden(tErrors("publishingPaused"), {
        code: "github_content_publishing_paused",
      });
    }

    await db
      .insert(repositoryOutputs)
      .values({
        id: nanoid(),
        repositoryId: integration.id,
        outputType: input.contentType,
        enabled: true,
        config: null,
      })
      .onConflictDoNothing({
        target: [repositoryOutputs.repositoryId, repositoryOutputs.outputType],
      });
    contentOutput =
      (await db.query.repositoryOutputs.findFirst({
        where: and(
          eq(repositoryOutputs.repositoryId, integration.id),
          eq(repositoryOutputs.outputType, input.contentType)
        ),
        columns: { id: true, config: true, enabled: true, reviewProcess: true },
      })) ?? null;
  }
  if (!contentOutput) {
    throw internalServerError("Failed to configure GitHub publishing");
  }
  if (!contentOutput.enabled) {
    const tErrors = await getTranslations("errors.content");
    throw forbidden(tErrors("publishingPaused"), {
      code: "github_content_publishing_paused",
    });
  }
  const outputConfig = repositoryContentDirectoryConfigSchema.safeParse(
    contentOutput.config
  );
  const notraBaseUrl = resolveNotraBaseUrl();
  let publishInstallationId = integration.installationId ?? null;
  let publishInstallationAccountType = integration.installationAccountType;
  let publishInstallationAccountLogin = integration.installationAccountLogin;
  if (connectionMethod === "github-app" && !publishInstallationId) {
    const fallback = selectGitHubAppInstallationForOwner(
      await listGitHubAppInstallationsByOrganization(input.organizationId),
      repositoryOwner
    );
    if (fallback) {
      publishInstallationId = fallback.installationId;
      publishInstallationAccountType = fallback.accountType;
      publishInstallationAccountLogin = fallback.accountLogin;
    }
  }
  if (connectionMethod === "github-app" && publishInstallationId) {
    const publishAccess = await getGitHubAppInstallationPublishAccess(
      publishInstallationId
    );
    if (githubAppInstallationCanPublishContent(publishAccess) === false) {
      const recovery = getGitHubAppPermissionsRecovery({
        installationId: publishInstallationId,
        installationAccountType: publishInstallationAccountType,
        installationAccountLogin: publishInstallationAccountLogin,
      });
      throw forbidden(
        await getGitHubRecoveryMessage(recovery.data),
        recovery.data
      );
    }
  }

  const token = await runOrpcEffect(
    getGitHubPublishTokenEffect(integration.id, {
      organizationId: input.organizationId,
    }),
    toGitHubOperationOrpcError
  );

  const storedPublish = postGitHubPublishSchema.safeParse(post.githubPublish);
  const storedPullRequest =
    storedPublish.success &&
    storedPublish.data.pullRequestNumber &&
    storedPublish.data.repositoryId === integration.id &&
    storedPublish.data.owner.toLowerCase() === repositoryOwner.toLowerCase() &&
    storedPublish.data.repo.toLowerCase() === repositoryName.toLowerCase()
      ? {
          branchName: storedPublish.data.branchName,
          number: storedPublish.data.pullRequestNumber,
        }
      : undefined;

  const recordedPublication = await findOpenContentPublicationForPost({
    organizationId: input.organizationId,
    postId: input.contentId,
  });
  const linkedPullRequest =
    recordedPublication?.repositoryId === integration.id
      ? {
          branchName: recordedPublication.branch,
          number: recordedPublication.pullRequestNumber,
        }
      : storedPullRequest;

  let previousBase = storedPublish.data?.baseBranch;
  let openPullRequestBase: string | undefined;
  if (linkedPullRequest) {
    const { data: linked } = await createOctokit(token).request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}",
      {
        owner: repositoryOwner,
        repo: repositoryName,
        pull_number: linkedPullRequest.number,
      }
    );
    previousBase = linked.base.ref;
    if (linked.state === "open") {
      openPullRequestBase = linked.base.ref;
    }
  }
  const siteTarget = await findSiteGitHubPublishTarget({
    organizationId: input.organizationId,
    contentType: input.contentType,
    projectId: post.collection.projectId,
    siteId:
      input.siteId ??
      (recordedPublication?.repositoryId === integration.id ||
      storedPublish.data?.repositoryId === integration.id
        ? undefined
        : outputConfig.success
          ? outputConfig.data.siteId
          : null),
    existingPublication:
      recordedPublication?.repositoryId === integration.id
        ? {
            siteId: storedPublish.data?.siteId,
            baseBranch: previousBase,
            path: recordedPublication.path,
          }
        : storedPublish.success &&
            storedPublish.data.repositoryId === integration.id
          ? { ...storedPublish.data, baseBranch: previousBase }
          : undefined,
    repository: {
      id: integration.id,
      githubRepositoryId: integration.githubRepositoryId,
      owner: repositoryOwner,
      repo: repositoryName,
    },
  });
  const publicationBranch =
    openPullRequestBase ?? siteTarget?.productionBranch ?? defaultBranch;
  const configuredDirectory = outputConfig.success
    ? outputConfig.data.directory
    : undefined;
  const directory =
    configuredDirectory ??
    (siteTarget
      ? resolveSiteEntryDirectory(siteTarget.rootDirectory, input.contentType)
      : DEFAULT_GITHUB_CONTENT_DIRECTORIES[input.contentType]);
  const postSlug = siteTarget
    ? resolveSiteEntrySlug({
        contentId: input.contentId,
        slug: post.slug,
        title: post.title,
      })
    : post.slug;
  const previousPublish = postGitHubPublishSchema.safeParse(post.githubPublish);
  const sameDestination =
    previousPublish.success &&
    previousPublish.data.repositoryId === integration.id;
  const path =
    (sameDestination
      ? previousPublish.data.path
      : recordedPublication?.repositoryId === integration.id
        ? recordedPublication.path
        : null) ??
    resolveGitHubContentPath({
      contentId: input.contentId,
      customPath: input.path,
      directory,
      pathTemplate: outputConfig.success ? outputConfig.data.contentPath : null,
      slug: postSlug,
      title: post.title,
    });
  if (path.length > GITHUB_CONTENT_PATH_MAX_LENGTH) {
    const tErrors = await getTranslations("errors.content");
    throw badRequest(tErrors("filePathTooLong"));
  }

  const contentSlug =
    slugify(postSlug ?? "") || slugify(post.title) || input.contentId;
  const configuredImagePath = outputConfig.success
    ? outputConfig.data.imagePath
    : null;

  let siteEntry: Awaited<ReturnType<typeof resolveSiteEntryContext>> | null =
    null;
  if (siteTarget) {
    try {
      siteEntry = await resolveSiteEntryContext({
        token,
        owner: repositoryOwner,
        repo: repositoryName,
        contentType: input.contentType,
        path,
        target: siteTarget,
        publisherUserId: options.publisherUserId,
        existingEntry:
          linkedPullRequest && storedPublish.success
            ? {
                branchName: linkedPullRequest.branchName,
                path: storedPublish.data.path,
              }
            : undefined,
      });
    } catch (error) {
      logError("Failed to read the existing site entry from GitHub", error, {
        organizationId: input.organizationId,
        contentId: input.contentId,
      });
      const tErrors = await getTranslations("errors.content");
      throw serviceUnavailable(tErrors("existingEntryUnreadable"));
    }
  }

  const octokit = createOctokit(token);
  const publisherLogin =
    getGitHubAppBotLogin() ??
    (await octokit
      .request("GET /user")
      .then(({ data }) => data.login)
      .catch(() => undefined));

  try {
    const publishedAt = new Date().toISOString();
    const previousPublication = recordedPublication;
    const publish = async () => {
      const directDecision = await resolveContentReviewProcess({
        reviewProcess: options.requirePullRequest
          ? "pull_request"
          : (contentOutput.reviewProcess ?? "pull_request"),
        token,
        repository: {
          organizationId: input.organizationId,
          integrationId: integration.id,
          githubRepositoryId: integration.githubRepositoryId,
          installationId: publishInstallationId ?? "",
          owner: repositoryOwner,
          repo: repositoryName,
        },
        branch: publicationBranch,
        siteId: siteTarget?.siteId,
        rootDirectory: siteTarget?.rootDirectory,
        path,
        targetBranch: linkedPullRequest?.branchName,
      });
      let assetPaths: string[] = [];
      let writtenBlobs: Record<string, string> = {};
      const result = await publishContentDraftPullRequest(octokit, {
        contentId: input.contentId,
        contentType: input.contentType,
        owner: repositoryOwner,
        repo: repositoryName,
        defaultBranch: publicationBranch,
        direct: directDecision.direct,
        requireLinkedPullRequest: input.linkedOnly,
        writtenBlobs: sameDestination
          ? previousPublish.data.writtenBlobs
          : undefined,
        previousHeadSha: sameDestination
          ? (previousPublish.data.headSha ?? recordedPublication?.headSha)
          : recordedPublication?.repositoryId === integration.id
            ? recordedPublication.headSha
            : undefined,
        ownedPaths: sameDestination
          ? [
              previousPublish.data.path,
              ...(previousPublish.data.assetPaths ?? []),
            ]
          : recordedPublication?.repositoryId === integration.id
            ? [recordedPublication.path]
            : [],
        path,
        title: post.title,
        markdown: savedMarkdown,
        organizationId: input.organizationId,
        ...(linkedPullRequest ? { linkedPullRequest } : {}),

        ...(publisherLogin ? { publisherLogin } : {}),
        prepareContent: async (contentPath: string) => {
          if (siteTarget) {
            const prepared = await prepareSiteEntryFiles({
              post: { ...post, markdown: savedMarkdown },
              contentType: input.contentType,
              contentPath,
              imagePath: configuredImagePath,
              organizationId: input.organizationId,
              rootDirectory: siteTarget.rootDirectory,
              slug: contentSlug,
              siteEntry,
            });
            assetPaths = prepared.assets.map((asset) => asset.path);
            writtenBlobs = Object.fromEntries([
              [contentPath, githubBlobSha(prepared.markdown)],
              ...prepared.assets.map((asset) => [
                asset.path,
                githubBlobSha(asset.contents),
              ]),
            ]);
            return prepared;
          }
          const preparedContent = await prepareR2GitHubContentAssets({
            contentPath,
            imagePathTemplate: resolveGitHubImagePathTemplate(
              contentPath,
              configuredImagePath
            ),
            markdown: savedMarkdown,
            organizationId: input.organizationId,
            slug: contentSlug,
          });
          if (
            preparedContent.assets.some(
              (asset) => asset.path.length > GITHUB_CONTENT_PATH_MAX_LENGTH
            )
          ) {
            const tErrors = await getTranslations("errors.content");
            throw badRequest(tErrors("imagePathTooLong"));
          }
          assetPaths = preparedContent.assets.map((asset) => asset.path);
          writtenBlobs = Object.fromEntries([
            [contentPath, githubBlobSha(preparedContent.markdown)],
            ...preparedContent.assets.map((asset) => [
              asset.path,
              githubBlobSha(asset.contents),
            ]),
          ]);
          return preparedContent;
        },
        ...(notraBaseUrl && organization
          ? {
              badgeUrls: buildOpenInNotraBadgeUrls(notraBaseUrl),
              contentUrl: `${notraBaseUrl}/${organization.slug}/content/${input.contentId}`,
            }
          : {}),
      });
      return { result, assetPaths, writtenBlobs, directDecision };
    };
    const { result, assetPaths, writtenBlobs, directDecision } = siteTarget
      ? await withAdvisorySessionLocks(
          [
            ["sites-branch", siteTarget.siteId, publicationBranch],
            ["sites-branch-edits", siteTarget.siteId, publicationBranch],
          ],
          publish
        )
      : await publish();
    if (result.skipped) {
      return result;
    }
    await clearGitHubPublishFailures({
      organizationId: input.organizationId,
      outputType: input.contentType,
      repositoryId: integration.id,
    });
    const githubPublish = postGitHubPublishSchema.safeParse({
      branchName: result.branchName,
      owner: repositoryOwner,
      path: result.path,
      pullRequestNumber: result.pullRequestNumber,
      pullRequestUrl: result.pullRequestUrl,
      repo: repositoryName,
      repositoryId: integration.id,
      baseBranch: publicationBranch,
      siteId: siteTarget?.siteId,
      direct: result.direct ?? false,
      headSha: result.headSha,
      writtenBlobs: {
        ...(sameDestination ? previousPublish.data.writtenBlobs : {}),
        ...writtenBlobs,
      },
      assetPaths: [
        ...new Set([
          ...(sameDestination ? (previousPublish.data.assetPaths ?? []) : []),
          ...assetPaths,
        ]),
      ],
    });
    if (!githubPublish.success) {
      throw badRequest(
        (await getTranslations("errors.github"))("pullRequestUnavailable")
      );
    }
    if (
      linkedPullRequest &&
      result.pullRequestNumber !== linkedPullRequest.number
    ) {
      const old = await octokit.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}",
        {
          owner: repositoryOwner,
          repo: repositoryName,
          pull_number: linkedPullRequest.number,
        }
      );
      if (old.data.state === "closed") {
        await closeContentPublicationForPullRequest({
          owner: repositoryOwner,
          repo: repositoryName,
          pullRequestNumber: linkedPullRequest.number,
          merged: Boolean(old.data.merged_at),
        });
      }
    }
    if (result.pullRequestNumber && result.pullRequestUrl) {
      const publication = {
        organizationId: input.organizationId,
        postId: input.contentId,
        repositoryId: integration.id,
        owner: repositoryOwner,
        repo: repositoryName,
        path: result.path,
        branch: result.branchName,
        pullRequestNumber: result.pullRequestNumber,
        pullRequestUrl: result.pullRequestUrl,
        headSha: result.headSha,
        previousHeadSha: previousPublication?.headSha ?? null,
      };
      const logContext = {
        organizationId: input.organizationId,
        contentId: input.contentId,
        pullRequestUrl: result.pullRequestUrl,
      };
      let reconciliationScheduled = false;
      try {
        await startContentPublicationReconciliation(publication, publishedAt);
        reconciliationScheduled = true;
      } catch (error) {
        logError(
          "Failed to start content publication reconciliation",
          error,
          logContext
        );
      }
      try {
        await retryWrite(() =>
          reconcileContentPublication(
            { publication, publishedAt },
            githubAncestryValidator({
              octokit,
              owner: publication.owner,
              repo: publication.repo,
            })
          )
        );
      } catch (error) {
        logError("Failed to record content publication", error, logContext);
      }
      if (!reconciliationScheduled) {
        try {
          await startContentPublicationReconciliation(publication, publishedAt);
        } catch (startError) {
          logError(
            "Failed to start content publication reconciliation",
            startError,
            logContext
          );
        }
      }
    }
    try {
      await retryWrite(() =>
        db.transaction(async (tx) => {
          const updated = await tx
            .update(posts)
            .set({ githubPublish: githubPublish.data })
            .where(
              and(
                eq(posts.id, input.contentId),
                eq(posts.organizationId, input.organizationId),
                sql`${posts.githubPublish} is not distinct from ${post.githubPublish === null ? null : JSON.stringify(post.githubPublish)}::jsonb`
              )
            )
            .returning({ id: posts.id });
          if (result.direct) {
            if (!updated.length) {
              throw new Error(
                "GitHub publication metadata changed during publishing"
              );
            }
            await tx
              .update(contentPublications)
              .set({ status: "closed", updatedAt: new Date() })
              .where(
                and(
                  eq(contentPublications.organizationId, input.organizationId),
                  eq(contentPublications.postId, input.contentId),
                  eq(contentPublications.status, "open")
                )
              );
            await tx.insert(contentPublications).values({
              id: nanoid(),
              organizationId: input.organizationId,
              postId: input.contentId,
              repositoryId: integration.id,
              owner: repositoryOwner,
              repo: repositoryName,
              path: result.path,
              branch: result.branchName,
              headSha: result.headSha,
              status: "merged",
              createdAt: new Date(publishedAt),
            });
          }
        })
      );
    } catch (error) {
      logError("Failed to update GitHub publication metadata", error, {
        organizationId: input.organizationId,
        contentId: input.contentId,
      });
      if (result.direct) {
        throw error;
      }
    }
    return {
      ...result,
      fallbackReason: result.fallbackReason ?? directDecision.reason,
    };
  } catch (error) {
    throw await toGitHubPublishOrpcError(error, {
      organizationId: input.organizationId,
      repositoryId: integration.id,
      outputId: contentOutput.id,
      outputType: input.contentType,
      connectionMethod,
      installationId: publishInstallationId,
      installationAccountType: publishInstallationAccountType,
      installationAccountLogin: publishInstallationAccountLogin,
    });
  }
}
