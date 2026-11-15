import { logError } from "@notra/ai/utils/server-log";
import {
  isTinybirdConfigured,
  queryWebAudience,
  queryWebOverview,
  queryWebPages,
  queryWebSources,
  queryWebTimeseries,
} from "@notra/analytics/tinybird/client";
import { defineTool } from "eve/tools";

import {
  ANALYTICS_PROJECT_NOT_FOUND_MESSAGE,
  WEB_ANALYTICS_NOT_CONFIGURED_MESSAGE,
  WEB_ANALYTICS_QUERY_FAILED_MESSAGE,
} from "../constants/analytics";
import { getWebAnalyticsInputSchema } from "../schemas/analytics-tools";
import {
  normalizeHostFilter,
  resolveAnalyticsProject,
  resolveAnalyticsRange,
} from "../utils/analytics";
import { requireOrganizationId } from "../utils/organization";

export function createGetWebAnalyticsTool() {
  return defineTool({
    description:
      "Get website traffic from Notra web analytics: page views, visitors, sessions and AI-referred visitors with the previous period of equal length for comparison, daily views and visitors, top pages, top referrer sources, and visitors broken down by country, device, browser or OS. Use for questions about traffic, visitors, or where visitors are located (country codes are ISO 3166-1 alpha-2). Scope with siteId for one Notra hosted site, otherwise a project (default: the oldest). Region and city are not tracked. Returns the exact UTC date range covered.",
    inputSchema: getWebAnalyticsInputSchema,
    async execute(input, ctx) {
      const organizationId = requireOrganizationId(ctx);
      if (!isTinybirdConfigured()) {
        return WEB_ANALYTICS_NOT_CONFIGURED_MESSAGE;
      }
      const range = resolveAnalyticsRange(input);
      if (typeof range === "string") {
        return range;
      }

      try {
        const project = input.siteId
          ? null
          : await resolveAnalyticsProject(organizationId, input.projectId);
        if (!(input.siteId || project)) {
          return ANALYTICS_PROJECT_NOT_FOUND_MESSAGE;
        }

        const params = {
          organization_id: organizationId,
          project_id: project?.id ?? "",
          include_unassigned: project?.isDefault ? 1 : 0,
          site_id: input.siteId ?? "",
          hosts: normalizeHostFilter(input.host),
          path: input.path ?? "",
          days: range.days,
          date_from: range.from,
          date_to: range.to,
        };
        const [overview, timeseries, pages, sources, audience] =
          await Promise.all([
            queryWebOverview(params),
            queryWebTimeseries(params),
            queryWebPages({ ...params, not_found: 0, limit: input.limit }),
            queryWebSources({ ...params, limit: input.limit }),
            queryWebAudience({
              ...params,
              dimension: input.dimension,
              limit: input.limit,
            }),
          ]);
        if (!overview) {
          return WEB_ANALYTICS_NOT_CONFIGURED_MESSAGE;
        }

        const totals = overview.data[0];
        const views = Number(totals?.views ?? 0);
        return {
          scope: project
            ? { project }
            : { siteId: input.siteId, host: input.host ?? null },
          range,
          comparison:
            "previous_* values cover the same number of days immediately before range.from.",
          totals: {
            views,
            previous_views: Number(totals?.previous_views ?? 0),
            visitors: Number(totals?.visitors ?? 0),
            previous_visitors: Number(totals?.previous_visitors ?? 0),
            sessions: Number(totals?.sessions ?? 0),
            previous_sessions: Number(totals?.previous_sessions ?? 0),
            engaged_sessions: Number(totals?.engaged_sessions ?? 0),
            ai_visitors: Number(totals?.ai_visitors ?? 0),
            previous_ai_visitors: Number(totals?.previous_ai_visitors ?? 0),
          },
          daily: (timeseries?.data ?? []).map((row) => ({
            day: row.day,
            views: Number(row.views),
            visitors: Number(row.visitors),
          })),
          breakdown: {
            dimension: input.dimension,
            rows: (audience?.data ?? []).map((row) => ({
              value: row.value || "Unknown",
              visitors: Number(row.visitors),
              previous_visitors: Number(row.previous_visitors),
              views: Number(row.views),
            })),
          },
          top_pages: (pages?.data ?? []).map((row) => ({
            host: row.host,
            path: row.path,
            views: Number(row.views),
            visitors: Number(row.visitors),
            ai_visitors: Number(row.ai_visitors),
          })),
          top_sources: (sources?.data ?? []).map((row) => ({
            group: row.referrer_group,
            source: row.referrer_source,
            ai_product: row.ai_product || null,
            sessions: Number(row.sessions),
            previous_sessions: Number(row.previous_sessions),
          })),
          ...(views === 0
            ? {
                note: "No tracked page views in this range. Notra web analytics may not be installed on this site yet.",
              }
            : {}),
        };
      } catch (error) {
        logError("Web analytics tool failed", error, {
          organizationId,
          projectId: input.projectId,
          siteId: input.siteId,
        });
        return WEB_ANALYTICS_QUERY_FAILED_MESSAGE;
      }
    },
  });
}
