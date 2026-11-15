import { SCHEDULED_PUBLICATION_ERROR_CODES } from "@notra/ai/constants/scheduled-publications";
import { getGitHubPublishToken } from "@notra/ai/integrations/github-publish-auth";
import type {
  ScheduledPublicationAttempt,
  ScheduledPublicationOutcome,
} from "@notra/ai/types/scheduled-publications";
import { createOctokit } from "@notra/ai/utils/octokit";
import { isGitHubScheduleContentType } from "@notra/ai/utils/schedule-destinations";
import {
  markScheduledPublicationExternalAttempt,
  recordScheduledPullRequest,
} from "@notra/ai/utils/scheduled-publications";
import { db } from "@notra/db/drizzle";
import { githubIntegrations, posts, repositoryOutputs } from "@notra/db/schema";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { postGitHubPublishSchema } from "@notra/schemas/dashboard/content";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { Effect } from "effect";

import { DEFAULT_GITHUB_CONTENT_OUTPUT_ENABLED } from "@/constants/github";
import { trackServerEventAndFlush } from "@/lib/analytics/posthog-server";
import { resolveAiProductAccess } from "@/lib/billing/subscription";
import { requestGeoRescanForPublishedPost } from "@/lib/geo/rescan";
import {
  getContentPullRequestState,
  mergeContentPullRequest,
} from "@/lib/integrations/github/content-pull-request";
import { publishSavedContentToGitHub } from "@/lib/integrations/github/publish-saved-content";
import { SocialConnectDeliveryUnknownError } from "@/lib/social-connect/errors";
import { publishSocialPost } from "@/lib/social-connect/publish";
import type {
  ScheduledPublicationPost,
  ScheduledPullRequest,
} from "@/types/content/scheduled-publications";
import type { ContentPullRequestState } from "@/types/integrations/github";
import {
  classifyGitHubPublishFailure,
  hasGitHubStatus,
} from "@/utils/github-publish-failure";
import {
  postContentHash,
  matchesPostContentHash,
} from "@/utils/scheduled-post-content-hash";
import { getSocialVideoUrls } from "@/utils/social-video";

const GITHUB_MERGE_NEEDS_PERSON_REGEX = /is failing|not up to date/i;

const RETRYABLE_ORPC_CODES = new Set([
  "INTERNAL_SERVER_ERROR",
  "BAD_GATEWAY",
  "SERVICE_UNAVAILABLE",
  "GATEWAY_TIMEOUT",
  "TOO_MANY_REQUESTS",
  "TIMEOUT",
]);

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

const SCHEDULED_SOCIAL_RESULT_POLL_ATTEMPTS = 15;

function publicErrorMessage(error: unknown, fallback: string) {
  return error instanceof ORPCError && error.message ? error.message : fallback;
}

function isRetryableGitHubMergeError(error: unknown) {
  if ([404, 409, 422].some((status) => hasGitHubStatus(error, status))) {
    return false;
  }
  if (
    hasGitHubStatus(error, 405) &&
    error instanceof Error &&
    GITHUB_MERGE_NEEDS_PERSON_REGEX.test(error.message)
  ) {
    return false;
  }
  const kind = classifyGitHubPublishFailure(error);
  return kind === "rate_limit" || kind === "unknown";
}

function failure(
  code: string,
  message: string,
  retryable: boolean,
  result?: Extract<ScheduledPublicationOutcome, { kind: "error" }>["result"]
): ScheduledPublicationOutcome {
  return { kind: "error", code, message, retryable, result };
}

function isRetryablePublishError(error: unknown) {
  if (error instanceof ORPCError) {
    return RETRYABLE_ORPC_CODES.has(error.code);
  }
  return true;
}

async function publishInNotra(
  attempt: ScheduledPublicationAttempt,
  post: ScheduledPublicationPost
): Promise<ScheduledPublicationOutcome> {
  const [published] = await db
    .update(posts)
    .set({ status: "published", publishedAt: new Date() })
    .where(
      and(
        eq(posts.id, attempt.postId),
        eq(posts.organizationId, attempt.organizationId),
        eq(posts.status, "draft")
      )
    )
    .returning({ id: posts.id });
  if (!published) {
    return { kind: "published", result: { alreadyPublished: true } };
  }
  await Promise.all([
    requestGeoRescanForPublishedPost({
      organizationId: attempt.organizationId,
      postId: attempt.postId,
    }),
    trackServerEventAndFlush({
      event: POSTHOG_EVENTS.CONTENT_PUBLISHED,
      userId: attempt.createdByUserId,
      organizationId: attempt.organizationId,
      properties: {
        content_id: attempt.postId,
        type: post.contentType,
        from: "schedule",
      },
    }).catch((error: unknown) => {
      console.error("[ScheduledPublication] PostHog capture failed", error);
    }),
  ]);
  return { kind: "published", result: {} };
}

export async function githubRepositoryClient(
  organizationId: string,
  repositoryId: string
) {
  const repository = await db.query.githubIntegrations.findFirst({
    columns: { owner: true, repo: true },
    where: and(
      eq(githubIntegrations.id, repositoryId),
      eq(githubIntegrations.organizationId, organizationId)
    ),
  });
  if (!(repository?.owner && repository.repo)) {
    return null;
  }
  const token = await getGitHubPublishToken(repositoryId, { organizationId });
  return {
    octokit: createOctokit(token ?? undefined),
    owner: repository.owner,
    repo: repository.repo,
  };
}

type GitHubRepositoryClient = NonNullable<
  Awaited<ReturnType<typeof githubRepositoryClient>>
>;

async function mergePullRequest(
  client: GitHubRepositoryClient,
  pullRequest: ScheduledPullRequest
): Promise<ScheduledPublicationOutcome> {
  const merged = {
    kind: "published",
    result: { ...pullRequest, merged: true },
  } as const;
  const ref = {
    owner: client.owner,
    repo: client.repo,
    pullNumber: pullRequest.pullRequestNumber,
  };

  let state: ContentPullRequestState;
  try {
    state = await getContentPullRequestState(client.octokit, ref);
  } catch (error) {
    return failure(
      SCHEDULED_PUBLICATION_ERROR_CODES.GITHUB_MERGE_FAILED,
      `The pull request could not be loaded: ${errorMessage(error, "unknown error")}`,
      isRetryableGitHubMergeError(error),
      pullRequest
    );
  }
  if (state.status === "merged") {
    return merged;
  }
  if (state.status === "closed") {
    return failure(
      SCHEDULED_PUBLICATION_ERROR_CODES.GITHUB_MERGE_FAILED,
      "The pull request was closed without merging.",
      false,
      pullRequest
    );
  }

  try {
    await mergeContentPullRequest(
      client.octokit,
      ref,
      state,
      pullRequest.headSha
    );
    return merged;
  } catch (error) {
    const after = await getContentPullRequestState(client.octokit, ref).catch(
      () => null
    );
    if (after?.status === "merged") {
      return merged;
    }
    return failure(
      SCHEDULED_PUBLICATION_ERROR_CODES.GITHUB_MERGE_FAILED,
      hasGitHubStatus(error, 409)
        ? "The pull request changed after Notra pushed it. Review it and merge it on GitHub."
        : `The pull request is open but could not be merged: ${errorMessage(error, "unknown error")}`,
      isRetryableGitHubMergeError(error),
      pullRequest
    );
  }
}

/**
 * Same pause rules as publishSavedContentToGitHub, for runs that only merge a
 * pull request opened earlier and so never pass through that check.
 */
async function isGitHubPublishingEnabled(
  organizationId: string,
  repositoryId: string,
  contentType: keyof typeof DEFAULT_GITHUB_CONTENT_OUTPUT_ENABLED
) {
  const [repository, output] = await Promise.all([
    db.query.githubIntegrations.findFirst({
      columns: { enabled: true, repositoryEnabled: true },
      where: and(
        eq(githubIntegrations.id, repositoryId),
        eq(githubIntegrations.organizationId, organizationId)
      ),
    }),
    db.query.repositoryOutputs.findFirst({
      columns: { enabled: true },
      where: and(
        eq(repositoryOutputs.repositoryId, repositoryId),
        eq(repositoryOutputs.outputType, contentType)
      ),
    }),
  ]);
  return Boolean(
    repository?.enabled &&
    repository.repositoryEnabled &&
    (output?.enabled ?? DEFAULT_GITHUB_CONTENT_OUTPUT_ENABLED[contentType])
  );
}

function completePullRequest(
  client: GitHubRepositoryClient,
  merge: boolean,
  pullRequest: ScheduledPullRequest
): Promise<ScheduledPublicationOutcome> | ScheduledPublicationOutcome {
  return merge
    ? mergePullRequest(client, pullRequest)
    : { kind: "published", result: pullRequest };
}

async function findMergedLinkedPullRequest(
  client: GitHubRepositoryClient,
  attempt: ScheduledPublicationAttempt,
  repositoryId: string,
  post: ScheduledPublicationPost
) {
  const linked = postGitHubPublishSchema.safeParse(post.githubPublish);
  if (
    !(
      linked.success &&
      linked.data.pullRequestNumber &&
      linked.data.repositoryId === repositoryId
    )
  ) {
    return null;
  }
  const state = await getContentPullRequestState(client.octokit, {
    owner: client.owner,
    repo: client.repo,
    pullNumber: linked.data.pullRequestNumber,
  }).catch(() => null);
  const mergedSinceScheduled =
    state?.status === "merged" &&
    state.mergedAt !== null &&
    state.mergedAt >= attempt.createdAt;
  return mergedSinceScheduled ? linked.data : null;
}

async function publishToGitHub(
  attempt: ScheduledPublicationAttempt,
  post: ScheduledPublicationPost,
  config: { repositoryId: string; merge: boolean }
): Promise<ScheduledPublicationOutcome> {
  if (!isGitHubScheduleContentType(post.contentType)) {
    return failure(
      SCHEDULED_PUBLICATION_ERROR_CODES.GITHUB_PUBLISH_FAILED,
      "This content type cannot be published to GitHub.",
      false
    );
  }
  const client = await githubRepositoryClient(
    attempt.organizationId,
    config.repositoryId
  );
  if (!client) {
    return failure(
      SCHEDULED_PUBLICATION_ERROR_CODES.GITHUB_PUBLISH_FAILED,
      "The GitHub repository is no longer connected.",
      false,
      attempt.result ?? undefined
    );
  }

  const previous = attempt.result;
  const pushedIsStale =
    previous?.contentHash !== undefined &&
    !matchesPostContentHash(previous.contentHash, post);
  if (!pushedIsStale) {
    const merged = config.merge
      ? await findMergedLinkedPullRequest(
          client,
          attempt,
          config.repositoryId,
          post
        )
      : null;
    if (merged) {
      return {
        kind: "published",
        result: {
          merged: true,
          pullRequestNumber: merged.pullRequestNumber ?? undefined,
          pullRequestUrl: merged.pullRequestUrl ?? undefined,
        },
      };
    }
    if (
      previous?.pullRequestNumber &&
      previous.pullRequestUrl &&
      !previous.merged
    ) {
      if (
        config.merge &&
        !(await isGitHubPublishingEnabled(
          attempt.organizationId,
          config.repositoryId,
          post.contentType
        ))
      ) {
        return failure(
          SCHEDULED_PUBLICATION_ERROR_CODES.GITHUB_PUBLISH_FAILED,
          "Publishing to this GitHub repository is paused.",
          false,
          previous
        );
      }
      return completePullRequest(client, config.merge, {
        pullRequestNumber: previous.pullRequestNumber,
        pullRequestUrl: previous.pullRequestUrl,
        headSha: previous.headSha ?? null,
        contentHash: previous.contentHash,
      });
    }
  }

  let published: Awaited<ReturnType<typeof publishSavedContentToGitHub>>;
  try {
    published = await publishSavedContentToGitHub({
      organizationId: attempt.organizationId,
      contentId: attempt.postId,
      contentType: post.contentType,
      repositoryId: config.repositoryId,
    });
  } catch (error) {
    return failure(
      SCHEDULED_PUBLICATION_ERROR_CODES.GITHUB_PUBLISH_FAILED,
      publicErrorMessage(error, "Publishing to GitHub failed."),
      isRetryablePublishError(error)
    );
  }
  if (!published.pullRequestNumber || !published.pullRequestUrl) {
    return {
      kind: "published",
      result: {
        merged: true,
        headSha: published.headSha,
        contentHash: postContentHash(post),
      },
    };
  }
  return completePullRequest(client, config.merge, {
    pullRequestNumber: published.pullRequestNumber,
    pullRequestUrl: published.pullRequestUrl,
    headSha: published.headSha ?? null,
    contentHash: postContentHash(post),
  });
}

/**
 * Opens the GitHub pull request when a post is scheduled, so reviews and CI
 * run before the slot; the scheduled run then only updates and merges it.
 * Best effort: without it the run opens the pull request itself.
 */
export async function openScheduledPullRequestAhead(params: {
  organizationId: string;
  postId: string;
  repositoryId: string;
}): Promise<void> {
  try {
    const post = await db.query.posts.findFirst({
      columns: {
        contentType: true,
        githubPublish: true,
        markdown: true,
        slug: true,
        title: true,
        coverImage: true,
        tags: true,
        excerpt: true,
        authorIds: true,
        featured: true,
        hidden: true,
        noindex: true,
        displayDate: true,
      },
      where: and(
        eq(posts.id, params.postId),
        eq(posts.organizationId, params.organizationId)
      ),
    });
    if (
      !post?.markdown ||
      post.githubPublish ||
      !isGitHubScheduleContentType(post.contentType)
    ) {
      return;
    }
    const output = await db.query.repositoryOutputs.findFirst({
      where: and(
        eq(repositoryOutputs.repositoryId, params.repositoryId),
        eq(repositoryOutputs.outputType, post.contentType)
      ),
      columns: { reviewProcess: true },
    });
    if (output?.reviewProcess === "direct") {
      return;
    }
    const published = await publishSavedContentToGitHub({
      organizationId: params.organizationId,
      contentId: params.postId,
      contentType: post.contentType,
      repositoryId: params.repositoryId,
    });
    if (!published.pullRequestNumber || !published.pullRequestUrl) {
      return;
    }
    const after = await db.query.posts.findFirst({
      columns: {
        markdown: true,
        slug: true,
        title: true,
        coverImage: true,
        tags: true,
        excerpt: true,
        authorIds: true,
        featured: true,
        hidden: true,
        noindex: true,
        displayDate: true,
      },
      where: and(
        eq(posts.id, params.postId),
        eq(posts.organizationId, params.organizationId)
      ),
    });
    const contentHash = postContentHash(post);
    if (!after || postContentHash(after) !== contentHash) {
      return;
    }
    await recordScheduledPullRequest({
      organizationId: params.organizationId,
      postId: params.postId,
      repositoryId: params.repositoryId,
      result: {
        pullRequestNumber: published.pullRequestNumber,
        pullRequestUrl: published.pullRequestUrl,
        headSha: published.headSha ?? null,
        contentHash,
      },
    });
  } catch (error) {
    console.warn("[ScheduledPublication] Opening the PR ahead failed", {
      postId: params.postId,
      error,
    });
  }
}

async function publishToSocial(
  attempt: ScheduledPublicationAttempt,
  claimToken: string,
  post: ScheduledPublicationPost,
  accountId: string
): Promise<ScheduledPublicationOutcome> {
  const content = (post.markdown ?? "").trim();
  if (!content) {
    return failure(
      SCHEDULED_PUBLICATION_ERROR_CODES.EMPTY_CONTENT,
      "The post has no text to publish.",
      false
    );
  }
  const marked = await markScheduledPublicationExternalAttempt({
    id: attempt.id,
    claimToken,
  });
  if (!marked) {
    return failure(
      SCHEDULED_PUBLICATION_ERROR_CODES.OUTCOME_UNKNOWN,
      "Another attempt already sent this post.",
      false
    );
  }
  const outcome = await Effect.runPromise(
    Effect.result(
      publishSocialPost({
        organizationId: attempt.organizationId,
        accountId,
        content,
        mediaUrls: getSocialVideoUrls(post.sourceMetadata),
        resultPollAttempts: SCHEDULED_SOCIAL_RESULT_POLL_ATTEMPTS,
      }).pipe(
        Effect.catchDefect((defect) =>
          Effect.fail(
            new SocialConnectDeliveryUnknownError({
              message: "Publishing crashed after the post was sent",
              cause: defect,
            })
          )
        )
      )
    )
  );
  const unconfirmed =
    outcome._tag === "Failure"
      ? outcome.failure._tag === "SocialConnectDeliveryUnknownError"
      : !outcome.success.confirmed;
  if (unconfirmed) {
    console.error("[ScheduledPublication] Social send unconfirmed", {
      scheduledPublicationId: attempt.id,
      outcome,
    });
    return failure(
      SCHEDULED_PUBLICATION_ERROR_CODES.OUTCOME_UNKNOWN,
      "The post may have gone out, but the platform did not confirm it. Check the account before retrying so it is not posted twice.",
      false
    );
  }
  if (outcome._tag === "Failure") {
    return failure(
      SCHEDULED_PUBLICATION_ERROR_CODES.SOCIAL_PUBLISH_FAILED,
      outcome.failure.message,
      false
    );
  }
  await trackServerEventAndFlush({
    event: POSTHOG_EVENTS.CONTENT_SOCIAL_PUBLISHED,
    userId: attempt.createdByUserId,
    organizationId: attempt.organizationId,
    properties: {
      platform: outcome.success.platform,
      from: "schedule",
      account_id: accountId,
    },
  }).catch((error: unknown) => {
    console.error("[ScheduledPublication] PostHog capture failed", error);
  });
  return {
    kind: "published",
    result: {
      platformPostId: outcome.success.platformPostId,
      postUrl: outcome.success.postUrl,
    },
  };
}

/** Publishes one claimed destination. Never throws for destination errors. */
export async function publishScheduledDestination(
  attempt: ScheduledPublicationAttempt,
  claimToken: string
): Promise<ScheduledPublicationOutcome> {
  const post = await db.query.posts.findFirst({
    columns: {
      contentType: true,
      title: true,
      slug: true,
      markdown: true,
      githubPublish: true,
      sourceMetadata: true,
      coverImage: true,
      tags: true,
      excerpt: true,
      authorIds: true,
      featured: true,
      hidden: true,
      noindex: true,
      displayDate: true,
    },
    where: and(
      eq(posts.id, attempt.postId),
      eq(posts.organizationId, attempt.organizationId)
    ),
  });
  if (!post) {
    return failure(
      SCHEDULED_PUBLICATION_ERROR_CODES.POST_NOT_FOUND,
      "The post no longer exists.",
      false
    );
  }

  let hasAccess: boolean;
  try {
    ({ hasAccess } = await resolveAiProductAccess(attempt.organizationId));
  } catch (error) {
    console.error("[ScheduledPublication] Subscription check failed", {
      scheduledPublicationId: attempt.id,
      error,
    });
    return failure(
      SCHEDULED_PUBLICATION_ERROR_CODES.UNEXPECTED,
      "Could not check the subscription.",
      true
    );
  }
  if (!hasAccess) {
    return failure(
      SCHEDULED_PUBLICATION_ERROR_CODES.SUBSCRIPTION_REQUIRED,
      "An active subscription is required to publish scheduled content.",
      false
    );
  }

  const config = attempt.destinationConfig;
  switch (config.destination) {
    case "notra":
      return publishInNotra(attempt, post);
    case "github":
      return publishToGitHub(attempt, post, config);
    case "social":
      return publishToSocial(attempt, claimToken, post, config.accountId);
    default:
      return failure(
        SCHEDULED_PUBLICATION_ERROR_CODES.UNEXPECTED,
        "Unknown destination.",
        false
      );
  }
}
