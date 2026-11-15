import { defineEndpoint, node, p, t } from "@tinybirdco/sdk";

/**
 * Cross-organization AI traffic for the Notra admin console. Unlike the
 * `geo_traffic_*` endpoints these are not scoped to one organization; the
 * console calls them through the dashboard's internal route with an admin
 * secret.
 */
const TRENDS_PARAMS = {
  date_from: p.string().describe("Inclusive first day (YYYY-MM-DD)"),
  date_to: p.string().describe("Exclusive last day (YYYY-MM-DD)"),
  excluded_project_ids: p
    .string()
    .optional("")
    .describe("Comma-separated project ids to leave out, empty for none"),
};

const TRENDS_SCOPE_SQL = `
          day >= toDateOrNull({{String(date_from, '')}})
          AND day < toDateOrNull({{String(date_to, '')}})
          AND visitor_type IN ('crawler', 'ai_referral')
          AND (
            {{String(excluded_project_ids, '')}} = ''
            OR NOT has(splitByChar(',', {{String(excluded_project_ids, '')}}), project_id)
          )`;

export const geoTrafficTrendsDaily = defineEndpoint(
  "geo_traffic_trends_daily",
  {
    description:
      "Daily AI crawler and referral visits per source across all organizations, with the median project's visits. Rows with an empty source count the projects that received any AI traffic that day.",
    params: TRENDS_PARAMS,
    nodes: [
      node({
        name: "per_project",
        sql: `
        SELECT
          day,
          visitor_type,
          source,
          project_id,
          anyMerge(category_state) AS project_category,
          countMerge(visits_state) AS project_visits,
          countIfMerge(markdown_visits_state) AS project_markdown_visits
        FROM geo_traffic_daily
        WHERE ${TRENDS_SCOPE_SQL}
        GROUP BY day, visitor_type, source, project_id
      `,
      }),
      // The median keeps one site with 10× everyone's traffic from setting
      // the per-site line. Per-project columns are prefixed so the sums'
      // aliases don't shadow them inside the quantile.
      node({
        name: "per_source",
        sql: `
        SELECT
          day,
          visitor_type,
          source,
          any(project_category) AS category,
          sum(project_visits) AS visits,
          sum(project_markdown_visits) AS markdown_visits,
          count() AS projects,
          toFloat64(quantileExact(0.5)(project_visits)) AS median_visits
        FROM per_project
        GROUP BY day, visitor_type, source
      `,
      }),
      // Empty labels are added in `result`: an alias named like a column
      // would shadow it in this node's WHERE.
      node({
        name: "per_day",
        sql: `
        SELECT
          day,
          countMerge(visits_state) AS visits,
          countIfMerge(markdown_visits_state) AS markdown_visits,
          uniqExact(project_id) AS projects
        FROM geo_traffic_daily
        WHERE ${TRENDS_SCOPE_SQL}
        GROUP BY day
      `,
      }),
      node({
        name: "result",
        sql: `
        SELECT * FROM (
          SELECT * FROM per_source
          UNION ALL
          SELECT
            day,
            '' AS visitor_type,
            '' AS source,
            '' AS category,
            visits,
            markdown_visits,
            projects,
            0 AS median_visits
          FROM per_day
        )
        ORDER BY day ASC, visitor_type ASC, source ASC
      `,
      }),
    ],
    output: {
      day: t.date(),
      visitor_type: t.string(),
      source: t.string(),
      category: t.string(),
      visits: t.uint64(),
      markdown_visits: t.uint64(),
      projects: t.uint64(),
      median_visits: t.float64(),
    },
  }
);

export const geoTrafficTrendsProjects = defineEndpoint(
  "geo_traffic_trends_projects",
  {
    description:
      "AI crawler and referral visits per project, source and week: week 0 starts at recent_from, weeks 1 and up count back from it to baseline_from. Lists every project with AI traffic in the window, so callers can also exclude projects from geo_traffic_trends_daily.",
    params: {
      ...TRENDS_PARAMS,
      baseline_from: p
        .string()
        .describe("First day (YYYY-MM-DD) of the baseline period"),
      recent_from: p
        .string()
        .describe("First day (YYYY-MM-DD) of the recent period"),
    },
    nodes: [
      node({
        name: "project_sources",
        sql: `
        SELECT
          project_id,
          visitor_type,
          source,
          toUInt32(greatest(
            0,
            intDiv(dateDiff('day', day, toDateOrNull({{String(recent_from, '')}})) + 6, 7)
          )) AS weeks_ago,
          countMerge(visits_state) AS visits
        FROM geo_traffic_daily
        WHERE ${TRENDS_SCOPE_SQL}
          AND day >= toDateOrNull({{String(baseline_from, '')}})
        GROUP BY project_id, visitor_type, source, weeks_ago
        ORDER BY project_id ASC, visitor_type ASC, source ASC, weeks_ago ASC
      `,
      }),
    ],
    output: {
      project_id: t.string(),
      visitor_type: t.string(),
      source: t.string(),
      weeks_ago: t.uint32(),
      visits: t.uint64(),
    },
  }
);
