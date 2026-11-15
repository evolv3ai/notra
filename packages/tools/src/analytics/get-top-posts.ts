import { queryTopPosts } from "@notra/analytics/tinybird/client";
import { defineTool } from "eve/tools";

import { getTopPostsInputSchema } from "../schemas/analytics-tools";
import { runSocialAnalyticsQuery } from "../utils/analytics";
import { requireOrganizationId } from "../utils/organization";

export function createGetTopPostsTool() {
  return defineTool({
    description:
      "Get the organization's best performing social posts, ranked by live engagement. Returns each post's content, url, posted_at, likes, replies, reposts, impressions, and total engagement. Use to learn what actually resonates with the audience before writing new content.",
    inputSchema: getTopPostsInputSchema,
    async execute({ limit }, ctx) {
      const organizationId = requireOrganizationId(ctx);
      return await runSocialAnalyticsQuery(
        () => queryTopPosts({ organization_id: organizationId, limit }),
        (rows) => ({
          posts: rows.map((row) => ({
            provider: row.provider,
            content: row.content,
            url: row.url,
            posted_at: row.posted_at,
            likes: row.likes,
            replies: row.replies,
            reposts: row.reposts,
            impressions: row.impressions,
            engagement: row.engagement,
          })),
        })
      );
    },
  });
}
