import { querySocialOverview } from "@notra/analytics/tinybird/client";
import { defineTool } from "eve/tools";

import { getSocialAnalyticsOverviewInputSchema } from "../schemas/analytics-tools";
import { runSocialAnalyticsQuery } from "../utils/analytics";
import { requireOrganizationId } from "../utils/organization";

export function createGetSocialAnalyticsOverviewTool() {
  return defineTool({
    description:
      "Get live social analytics for the organization's connected Twitter/X and LinkedIn accounts. Returns one row per account with follower count, number of tracked posts, and lifetime impressions, likes, replies, and reposts. Use when the user asks how their social accounts are performing, how many followers they have, or before advising on content strategy.",
    inputSchema: getSocialAnalyticsOverviewInputSchema,
    async execute(_input, ctx) {
      const organizationId = requireOrganizationId(ctx);
      return await runSocialAnalyticsQuery(
        () => querySocialOverview({ organization_id: organizationId }),
        (rows) => ({
          accounts: rows.map((row) => ({
            provider: row.provider,
            username: row.username,
            followers_count: row.followers_count,
            tracked_posts: row.tracked_posts,
            impressions: row.impressions,
            likes: row.likes,
            replies: row.replies,
            reposts: row.reposts,
          })),
        })
      );
    },
  });
}
