import { queryEngagementTimeseries } from "@notra/analytics/tinybird/client";
import { defineTool } from "eve/tools";

import { getEngagementTimeseriesInputSchema } from "../schemas/analytics-tools";
import { runSocialAnalyticsQuery } from "../utils/analytics";
import { requireOrganizationId } from "../utils/organization";

export function createGetEngagementTimeseriesTool() {
  return defineTool({
    description:
      "Get the daily social engagement timeseries for the organization's connected Twitter/X and LinkedIn accounts. Returns one row per day and account with posts, impressions, likes, replies, and reposts. Use to spot trends, growth, or drops over time.",
    inputSchema: getEngagementTimeseriesInputSchema,
    async execute({ days }, ctx) {
      const organizationId = requireOrganizationId(ctx);
      return await runSocialAnalyticsQuery(
        () =>
          queryEngagementTimeseries({ organization_id: organizationId, days }),
        (timeseries) => ({ days, timeseries })
      );
    },
  });
}
