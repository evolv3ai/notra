import { queryPostingPerformance } from "@notra/analytics/tinybird/client";
import { defineTool } from "eve/tools";

import { getPostingPerformanceInputSchema } from "../schemas/analytics-tools";
import { runSocialAnalyticsQuery } from "../utils/analytics";
import { requireOrganizationId } from "../utils/organization";

export function createGetPostingPerformanceTool() {
  return defineTool({
    description:
      "Get social posting performance broken down by weekday (1 = Monday through 7 = Sunday), with posts, total engagement, and avg_engagement per weekday. Use to advise on the best days to post.",
    inputSchema: getPostingPerformanceInputSchema,
    async execute({ days }, ctx) {
      const organizationId = requireOrganizationId(ctx);
      return await runSocialAnalyticsQuery(
        () =>
          queryPostingPerformance({ organization_id: organizationId, days }),
        (weekdays) => ({ days, weekdays })
      );
    },
  });
}
