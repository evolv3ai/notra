import { logError } from "@notra/ai/utils/server-log";
import {
  queryGeoCheckCompetitorShare,
  queryGeoCheckOverview,
  queryGeoCheckTimeseries,
  toGeoCheckWindow,
} from "@notra/db/utils/geo-checks";
import { defineTool } from "eve/tools";

import {
  ANALYTICS_PROJECT_NOT_FOUND_MESSAGE,
  GEO_QUERY_FAILED_MESSAGE,
} from "../constants/analytics";
import { getGeoOverviewInputSchema } from "../schemas/analytics-tools";
import {
  resolveAnalyticsProject,
  resolveAnalyticsRange,
} from "../utils/analytics";
import { requireOrganizationId } from "../utils/organization";

const COMPETITOR_LIMIT = 10;

export function createGetGeoOverviewTool() {
  return defineTool({
    description:
      "Get one project's GEO (generative engine optimization) results: how often AI assistants such as ChatGPT, Gemini and Perplexity mention or cite the brand. This is AI search visibility, not visitor geography; use get_web_analytics for traffic by country. Returns per-engine checks, mentions, citations (the brand's own site cited), visibility (mentioned or cited) and rates as 0-1 fractions, competitor brands, and daily per-engine counts for trend charts, plus the exact UTC date range covered. Never combines different projects.",
    inputSchema: getGeoOverviewInputSchema,
    async execute({ days, from, to, projectId }, ctx) {
      const organizationId = requireOrganizationId(ctx);
      const range = resolveAnalyticsRange({ days, from, to });
      if (typeof range === "string") {
        return range;
      }

      try {
        const project = await resolveAnalyticsProject(
          organizationId,
          projectId
        );
        if (!project) {
          return ANALYTICS_PROJECT_NOT_FOUND_MESSAGE;
        }
        const scope = { organizationId, projectId: project.id };
        const window = toGeoCheckWindow({ from: range.from, to: range.to });
        const [overview, competitors, timeseries] = await Promise.all([
          queryGeoCheckOverview(scope, window),
          queryGeoCheckCompetitorShare(scope, window, COMPETITOR_LIMIT),
          queryGeoCheckTimeseries(scope, window),
        ]);

        return {
          project,
          range,
          timeseries,
          engines: overview.map((row) => ({
            engine: row.engine,
            checks: row.checks,
            mentions: row.mentions,
            mention_rate: row.mentionRate,
            citations: row.citations,
            visibility: row.visibility,
            visibility_rate: row.visibilityRate,
            avg_position: row.avgPosition,
            last_checked_at: row.lastCheckedAt,
          })),
          competitor_share: competitors.map((row) => ({
            brand: row.brand,
            mentions: row.mentions,
          })),
          ...(overview.length === 0
            ? {
                note: "No GEO checks ran in this range. Scans may not have run yet for this project.",
              }
            : {}),
        };
      } catch (error) {
        logError("GEO overview tool failed", error, {
          organizationId,
          projectId,
        });
        return GEO_QUERY_FAILED_MESSAGE;
      }
    },
  });
}
