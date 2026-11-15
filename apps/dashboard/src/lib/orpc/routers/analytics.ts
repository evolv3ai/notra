import { POSTHOG_EVENTS } from "@notra/posthog/events";
import {
  analyticsOrganizationInputSchema,
  analyticsPostingPerformanceInputSchema,
  analyticsTimeseriesInputSchema,
  analyticsTopPostsInputSchema,
  leaderboardInputSchema,
  trackAccountInputSchema,
  untrackAccountInputSchema,
} from "@notra/schemas/dashboard/analytics";
import { os } from "@orpc/server";

import { assertAnalyticsAccess } from "@/lib/analytics/access";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import {
  loadEngagementTimeseries,
  loadFollowerGrowth,
  loadLeaderboard,
  loadNotraAdoption,
  loadPostingPerformance,
  loadSocialOverview,
  loadTopPosts,
  previewTrackedAccount,
  trackTwitterAccount,
  untrackTwitterAccount,
} from "@/lib/analytics/programs";
import { authorizedProcedure } from "@/lib/orpc/base";
import { runOrpcEffect } from "@/lib/orpc/effect";
import { toAnalyticsOrpcError } from "@/lib/orpc/utils/analytics-errors";
import type {
  EngagementTimeseriesResponse,
  FollowerGrowthResponse,
  LeaderboardResponse,
  NotraAdoptionResponse,
  PostingPerformanceResponse,
  SocialOverviewResponse,
  TopPostsResponse,
  TrackAccountPreviewResponse,
} from "@/types/analytics";
import type { ORPCContext } from "@/types/orpc/context";

const withAnalyticsAccess = os
  .$context<ORPCContext>()
  .middleware(async ({ context, next }, input: { organizationId: string }) => {
    await assertAnalyticsAccess({
      headers: context.headers,
      organizationId: input.organizationId,
      user: context.user ?? undefined,
    });
    return next();
  });

export const analyticsRouter = {
  overview: authorizedProcedure
    .input(analyticsOrganizationInputSchema)
    .use(withAnalyticsAccess)
    .handler(async ({ input }): Promise<SocialOverviewResponse> => {
      return await runOrpcEffect(
        loadSocialOverview(input.organizationId),
        toAnalyticsOrpcError
      );
    }),
  engagementTimeseries: authorizedProcedure
    .input(analyticsTimeseriesInputSchema)
    .use(withAnalyticsAccess)
    .handler(async ({ input }): Promise<EngagementTimeseriesResponse> => {
      return await runOrpcEffect(
        loadEngagementTimeseries(input.organizationId, {
          days: input.days,
          timezone: input.timezone,
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
        }),
        toAnalyticsOrpcError
      );
    }),
  topPosts: authorizedProcedure
    .input(analyticsTopPostsInputSchema)
    .use(withAnalyticsAccess)
    .handler(async ({ input }): Promise<TopPostsResponse> => {
      return await runOrpcEffect(
        loadTopPosts(input.organizationId, input.limit, {
          timezone: input.timezone,
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
        }),
        toAnalyticsOrpcError
      );
    }),
  adoption: authorizedProcedure
    .input(analyticsOrganizationInputSchema)
    .use(withAnalyticsAccess)
    .handler(async ({ input }): Promise<NotraAdoptionResponse> => {
      return await runOrpcEffect(
        loadNotraAdoption(input.organizationId),
        toAnalyticsOrpcError
      );
    }),
  postingPerformance: authorizedProcedure
    .input(analyticsPostingPerformanceInputSchema)
    .use(withAnalyticsAccess)
    .handler(async ({ input }): Promise<PostingPerformanceResponse> => {
      return await runOrpcEffect(
        loadPostingPerformance(input.organizationId, {
          days: input.days,
          timezone: input.timezone,
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
        }),
        toAnalyticsOrpcError
      );
    }),
  leaderboard: authorizedProcedure
    .input(leaderboardInputSchema)
    .use(withAnalyticsAccess)
    .handler(async ({ input }): Promise<LeaderboardResponse> => {
      return await runOrpcEffect(
        loadLeaderboard(input.organizationId, input.days, {
          timezone: input.timezone,
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
        }),
        toAnalyticsOrpcError
      );
    }),
  previewTrackAccount: authorizedProcedure
    .input(trackAccountInputSchema)
    .use(withAnalyticsAccess)
    .handler(async ({ input }): Promise<TrackAccountPreviewResponse> => {
      return await runOrpcEffect(
        previewTrackedAccount(input.username),
        toAnalyticsOrpcError
      );
    }),
  trackAccount: authorizedProcedure
    .input(trackAccountInputSchema)
    .use(withAnalyticsAccess)
    .handler(async ({ input }) => {
      return await runOrpcEffect(
        trackTwitterAccount(input.organizationId, input.username),
        toAnalyticsOrpcError
      );
    }),
  untrackAccount: authorizedProcedure
    .input(untrackAccountInputSchema)
    .use(withAnalyticsAccess)
    .handler(async ({ context, input }) => {
      const result = await runOrpcEffect(
        untrackTwitterAccount(input.organizationId, input.trackedAccountId),
        toAnalyticsOrpcError
      );

      trackServerEvent({
        event: POSTHOG_EVENTS.ANALYTICS_ACCOUNT_UNTRACKED,
        headers: context.headers,
        userId: context.user.id,
        organizationId: input.organizationId,
        properties: {
          tracked_account_id: input.trackedAccountId,
          bulk: false,
          count: 1,
        },
      });

      return result;
    }),
  followerGrowth: authorizedProcedure
    .input(analyticsTimeseriesInputSchema)
    .use(withAnalyticsAccess)
    .handler(async ({ input }): Promise<FollowerGrowthResponse> => {
      return await runOrpcEffect(
        loadFollowerGrowth(input.organizationId, {
          days: input.days,
          timezone: input.timezone,
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
        }),
        toAnalyticsOrpcError
      );
    }),
};
