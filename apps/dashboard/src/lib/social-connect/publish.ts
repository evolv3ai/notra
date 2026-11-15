import { recordDemoPublishedPost } from "@notra/ai/utils/demo-social";
import { db } from "@notra/db/drizzle";
import { connectedSocialAccounts } from "@notra/db/schema";
import { socialConnectPlatformSchema } from "@notra/schemas/dashboard/social-accounts";
import { isDemoMode } from "@notra/utils/demo-mode";
import { and, eq } from "drizzle-orm";
import { Effect } from "effect";
import type { SocialPostResult } from "post-for-me/resources/social-post-results";

import { recordPublishedSocialPost } from "@/lib/analytics/record-post";
import {
  getSocialConnectClient,
  isSocialConnectConfigured,
  isSocialConnectPlatformConfigured,
} from "@/lib/social-connect/client";
import {
  isSocialDeliveryUnknown,
  SocialConnectConfigError,
  SocialConnectDeliveryUnknownError,
  SocialConnectRequestError,
} from "@/lib/social-connect/errors";
import { assertAllowedSocialMediaUrls } from "@/lib/social-connect/media-urls";
import type { PublishSocialPostParams } from "@/types/services/social-connect";

const RESULT_POLL_ATTEMPTS = 5;
const RESULT_POLL_DELAY = "2 seconds";

function getResultErrorMessage(result: SocialPostResult): string {
  const { error } = result;
  if (typeof error === "string" && error) {
    return error;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message
  ) {
    return error.message;
  }
  return "The platform rejected the post";
}

const loadConnectedAccount = Effect.fnUntraced(function* (
  params: PublishSocialPostParams
) {
  const account = yield* Effect.tryPromise({
    try: () =>
      db.query.connectedSocialAccounts.findFirst({
        columns: { provider: true, providerAccountId: true, username: true },
        where: and(
          eq(connectedSocialAccounts.id, params.accountId),
          eq(connectedSocialAccounts.organizationId, params.organizationId)
        ),
      }),
    catch: (cause) =>
      new SocialConnectRequestError({
        message: "Failed to load connected account",
        cause,
      }),
  });
  if (!account) {
    return yield* Effect.fail(
      new SocialConnectRequestError({
        message: "Connected account not found",
        cause: null,
      })
    );
  }
  return account;
});

const publishDemoPost = Effect.fn("publishDemoPost")(function* (
  params: PublishSocialPostParams
) {
  const account = yield* loadConnectedAccount(params);
  const platformPostId = `demo-${crypto.randomUUID()}`;
  yield* Effect.tryPromise({
    try: () =>
      recordDemoPublishedPost(params.organizationId, {
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        platformPostId,
        content: params.content,
        postedAt: new Date().toISOString(),
      }),
    catch: (cause) =>
      new SocialConnectRequestError({
        message: "Failed to publish post",
        cause,
      }),
  });
  return {
    postId: platformPostId,
    platformPostId,
    postUrl: null,
    username: account.username,
    platform: account.provider,
    confirmed: true,
  };
});

export const publishSocialPost = Effect.fn("publishSocialPost")(function* (
  params: PublishSocialPostParams
) {
  yield* Effect.try({
    try: () =>
      assertAllowedSocialMediaUrls(params.mediaUrls, params.organizationId),
    catch: (cause) =>
      cause instanceof SocialConnectRequestError
        ? cause
        : new SocialConnectRequestError({
            message: "Invalid media URL",
            cause: null,
          }),
  });
  if (isDemoMode()) {
    return yield* publishDemoPost(params);
  }
  if (!isSocialConnectConfigured()) {
    return yield* Effect.fail(
      new SocialConnectConfigError({
        message: "Social account linking is not configured",
      })
    );
  }

  const account = yield* loadConnectedAccount(params);

  const parsedPlatform = socialConnectPlatformSchema.safeParse(
    account.provider
  );
  if (!parsedPlatform.success) {
    return yield* Effect.fail(
      new SocialConnectRequestError({
        message: "This account's platform is not supported",
        cause: null,
      })
    );
  }
  if (!isSocialConnectPlatformConfigured(parsedPlatform.data)) {
    return yield* Effect.fail(
      new SocialConnectConfigError({
        message: "Social account linking is not configured",
      })
    );
  }
  const client = getSocialConnectClient(parsedPlatform.data);

  // Creating a post is not idempotent, so the SDK must not resend it on a
  // timeout or a server error: the first request may have posted already.
  const post = yield* Effect.tryPromise({
    try: () =>
      client.socialPosts.create(
        {
          caption: params.content,
          social_accounts: [account.providerAccountId],
          ...(params.mediaUrls?.length
            ? { media: params.mediaUrls.map((url) => ({ url })) }
            : {}),
        },
        { maxRetries: 0 }
      ),
    catch: (cause) =>
      isSocialDeliveryUnknown(cause)
        ? new SocialConnectDeliveryUnknownError({
            message: "The platform did not confirm the post",
            cause,
          })
        : new SocialConnectRequestError({
            message: "Failed to publish post",
            cause,
          }),
  });

  const postResult = yield* Effect.sleep(RESULT_POLL_DELAY).pipe(
    Effect.andThen(
      Effect.tryPromise({
        try: () => client.socialPostResults.list({ post_id: [post.id] }),
        catch: (cause) =>
          new SocialConnectRequestError({
            message: "Failed to load published post",
            cause,
          }),
      })
    ),
    Effect.map(
      (results): SocialPostResult | null => results.data.at(0) ?? null
    ),
    Effect.catch(() => Effect.succeed(null)),
    Effect.repeat({
      until: (result) => result !== null,
      times: (params.resultPollAttempts ?? RESULT_POLL_ATTEMPTS) - 1,
    })
  );

  if (postResult && !postResult.success) {
    return yield* Effect.fail(
      new SocialConnectRequestError({
        message: getResultErrorMessage(postResult),
        cause: null,
      })
    );
  }

  const platformPostId = postResult?.platform_data?.id ?? null;
  const platformPostUrl = postResult?.platform_data?.url ?? null;
  const postUrl =
    platformPostUrl ??
    (platformPostId && account.provider === "twitter"
      ? `https://x.com/${account.username}/status/${platformPostId}`
      : null);

  if (platformPostId) {
    yield* Effect.promise(() =>
      recordPublishedSocialPost({
        organizationId: params.organizationId,
        accountId: params.accountId,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        platformPostId,
        url: postUrl,
        content: params.content,
      })
    );
  }

  return {
    postId: post.id,
    platformPostId,
    postUrl,
    username: account.username,
    platform: account.provider,
    confirmed: postResult !== null,
  };
});
