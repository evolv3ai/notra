import { isDemoMode } from "@notra/utils/demo-mode";
import { createTimeoutFetch } from "@notra/utils/timeout-fetch";
import {
  type InferParams,
  type IngestResult,
  type QueryResult,
  Tinybird,
} from "@tinybirdco/sdk";

import { bumpAnalyticsVersions, cachedQuery } from "../cache/query-cache";
import type { AnalyticsCacheScope } from "../types/cache";
import type {
  WebPageEngagementRow,
  WebPageViewRow,
} from "../types/tinybird-datasources";
import type {
  AccountLeaderboardParams,
  AccountLeaderboardRow,
  EngagementTimeseriesParams,
  EngagementTimeseriesRow,
  FollowerGrowthParams,
  FollowerGrowthRow,
  GeoJourneyDetailRow,
  GeoJourneyPagesRow,
  GeoJourneySourcesRow,
  GeoTrafficJourneysRow,
  GeoTrafficLogParams,
  GeoTrafficLogRow,
  GeoTrafficOverviewRow,
  GeoTrafficPagesParams,
  GeoTrafficPagesRow,
  GeoTrafficTimeseriesRow,
  GeoTrafficTrendsDailyRow,
  GeoTrafficTrendsProjectsRow,
  NotraAdoptionRow,
  PostingPerformanceParams,
  PostingPerformanceRow,
  PostMetricsLookupRow,
  SocialOverviewParams,
  SocialOverviewRow,
  TopPostsParams,
  TopPostsRow,
  WebOverviewRow,
  WebTimeseriesRow,
  WebPagesRow,
  WebSourcesRow,
  WebAudienceRow,
  WebHostsRow,
  WebAiOutcomesRow,
  WebEngagementRow,
  McpClientsRow,
  McpLogRow,
  McpOverviewRow,
  McpTimeseriesRow,
  McpToolsRow,
  McpToolNeighborsRow,
  McpToolFailuresRow,
  McpIntentsRow,
  McpUiRendersRow,
  McpUsersRow,
  McpSessionsRow,
  McpSessionEventsRow,
  McpCatalogRow,
  McpElicitationsRow,
  McpModelsRow,
} from "../types/tinybird-endpoints";
import {
  type GeoTrafficEventRow,
  geoTrafficEvents,
  type McpEventRow,
  mcpEvents,
  type SocialAccountRow,
  type SocialAccountStatsRow,
  type SocialPostRow,
  type SocialPostSourceRow,
  type SocialPostStatsRow,
  socialAccountStats,
  socialAccounts,
  socialPostSources,
  socialPostStats,
  socialPosts,
  webPageEngagement,
  webPageViews,
} from "./datasources";
import { queryDemoPipe } from "./demo-geo-traffic";
import { isDemoSocialPipe, queryDemoSocialPipe } from "./demo-social";
import {
  geoJourneyDetail,
  geoJourneyPages,
  geoJourneySources,
  geoTrafficJourneys,
  geoTrafficLog,
  geoTrafficOverview,
  geoTrafficPages,
  geoTrafficTimeseries,
} from "./pipes/geo-traffic";
import {
  geoTrafficTrendsDaily,
  geoTrafficTrendsProjects,
} from "./pipes/geo-traffic-trends";
import {
  mcpCatalog,
  mcpClients,
  mcpElicitations,
  mcpIntents,
  mcpLog,
  mcpModels,
  mcpOverview,
  mcpSessionEvents,
  mcpSessions,
  mcpTimeseries,
  mcpToolFailures,
  mcpToolNeighbors,
  mcpTools,
  mcpUiRenders,
  mcpUsers,
} from "./pipes/mcp";
import {
  accountLeaderboard,
  engagementTimeseries,
  followerGrowth,
  notraAdoption,
  postingPerformance,
  postMetricsLookup,
  socialOverview,
  topPosts,
} from "./pipes/social";
import {
  webAiOutcomes,
  webAudience,
  webEngagement,
  webHosts,
  webOverview,
  webPages,
  webSources,
  webTimeseries,
} from "./pipes/web";

const TINYBIRD_REQUEST_TIMEOUT_MS = 10_000;

function hasTinybirdToken(): boolean {
  return Boolean(process.env.TINYBIRD_TOKEN);
}

/**
 * Whether analytics can be read. The public demo has no Tinybird but answers
 * every mirrored pipe from generated data; writes stay token-gated.
 */
export function isTinybirdConfigured(): boolean {
  return hasTinybirdToken() || isDemoMode();
}

function tinybirdBaseUrl(): string {
  return (
    process.env.TINYBIRD_BASE_URL ??
    process.env.TINYBIRD_URL ??
    "https://api.tinybird.co"
  );
}

function createTinybirdClient(fetch?: typeof globalThis.fetch) {
  return new Tinybird({
    fetch,
    token: process.env.TINYBIRD_TOKEN,
    baseUrl: tinybirdBaseUrl(),
    devMode: false,
    datasources: {
      socialAccounts,
      socialAccountStats,
      socialPosts,
      socialPostStats,
      socialPostSources,
      geoTrafficEvents,
      webPageViews,
      webPageEngagement,
      mcpEvents,
    },
    pipes: {
      socialOverview,
      engagementTimeseries,
      topPosts,
      followerGrowth,
      postingPerformance,
      notraAdoption,
      postMetricsLookup,
      accountLeaderboard,
      geoTrafficOverview,
      geoTrafficTimeseries,
      geoTrafficPages,
      geoTrafficLog,
      geoTrafficJourneys,
      geoJourneySources,
      geoJourneyPages,
      geoJourneyDetail,
      geoTrafficTrendsDaily,
      geoTrafficTrendsProjects,
      webOverview,
      webTimeseries,
      webPages,
      webSources,
      webAudience,
      webHosts,
      webAiOutcomes,
      webEngagement,
      mcpOverview,
      mcpTimeseries,
      mcpTools,
      mcpClients,
      mcpLog,
      mcpToolNeighbors,
      mcpToolFailures,
      mcpIntents,
      mcpUsers,
      mcpSessions,
      mcpSessionEvents,
      mcpCatalog,
      mcpModels,
      mcpElicitations,
      mcpUiRenders,
    },
  });
}

let cachedQueryClient: ReturnType<typeof createTinybirdClient> | null = null;
let cachedMutationClient: ReturnType<typeof createTinybirdClient> | null = null;

function getTinybirdQueryClient() {
  if (!hasTinybirdToken()) {
    return null;
  }
  if (!cachedQueryClient) {
    cachedQueryClient = createTinybirdClient(
      createTimeoutFetch(TINYBIRD_REQUEST_TIMEOUT_MS)
    );
  }
  return cachedQueryClient;
}

function getTinybirdMutationClient() {
  if (!hasTinybirdToken()) {
    return null;
  }
  if (!cachedMutationClient) {
    cachedMutationClient = createTinybirdClient();
  }
  return cachedMutationClient;
}

async function ingestRows<TRow>(
  rows: TRow[],
  scope: AnalyticsCacheScope,
  organizationIds: ReadonlyArray<string | null>,
  ingest: (
    client: NonNullable<ReturnType<typeof getTinybirdMutationClient>>,
    batch: TRow[]
  ) => Promise<IngestResult>
): Promise<IngestResult | null> {
  const client = getTinybirdMutationClient();
  if (!client || rows.length === 0) {
    return null;
  }
  const result = await ingest(client, rows);
  await bumpAnalyticsVersions(scope, organizationIds);
  return result;
}

function cachedPipeQuery<TParams extends Record<string, unknown>, TRow>(
  scope: AnalyticsCacheScope,
  pipe: string,
  params: TParams,
  organizationId: string | null,
  query: (
    client: NonNullable<ReturnType<typeof getTinybirdQueryClient>>
  ) => Promise<QueryResult<TRow>>
): Promise<QueryResult<TRow> | null> {
  if (isDemoMode()) {
    return isDemoSocialPipe(pipe)
      ? queryDemoSocialPipe<TRow>(pipe, params)
      : queryDemoPipe<TRow>(pipe, params);
  }
  const client = getTinybirdQueryClient();
  if (!client) {
    return Promise.resolve(null);
  }
  return cachedQuery({
    scope,
    pipe,
    organizationId,
    params,
    fetch: () => query(client),
  });
}

export function ingestSocialAccounts(
  rows: SocialAccountRow[]
): Promise<IngestResult | null> {
  return ingestRows(
    rows,
    "social",
    rows.map((row) => row.organization_id),
    (client, batch) => client.socialAccounts.ingestBatch(batch)
  );
}

export function ingestSocialAccountStats(
  rows: SocialAccountStatsRow[]
): Promise<IngestResult | null> {
  return ingestRows(
    rows,
    "social",
    rows.map((row) => row.organization_id),
    (client, batch) => client.socialAccountStats.ingestBatch(batch)
  );
}

export function ingestSocialPosts(
  rows: SocialPostRow[]
): Promise<IngestResult | null> {
  return ingestRows(
    rows,
    "social",
    rows.map((row) => row.organization_id),
    (client, batch) => client.socialPosts.ingestBatch(batch)
  );
}

export function ingestSocialPostStats(
  rows: SocialPostStatsRow[]
): Promise<IngestResult | null> {
  return ingestRows(
    rows,
    "social",
    rows.map((row) => row.organization_id),
    (client, batch) => client.socialPostStats.ingestBatch(batch)
  );
}

export function ingestSocialPostSources(
  rows: SocialPostSourceRow[]
): Promise<IngestResult | null> {
  return ingestRows(
    rows,
    "social",
    rows.map((row) => row.organization_id),
    (client, batch) => client.socialPostSources.ingestBatch(batch)
  );
}

export function ingestGeoTrafficEvents(
  rows: GeoTrafficEventRow[]
): Promise<IngestResult | null> {
  return ingestRows(
    rows,
    "geo",
    rows.map((row) => row.organization_id),
    // wait=true holds the response until Tinybird's next flush (p90 ~2.8 s,
    // measured), past the 2 s budget of the SDK that posts these events.
    // Without it Tinybird still validates synchronously and reports
    // quarantined rows, but answers in ~20 ms once the rows are buffered.
    (client, batch) =>
      client.geoTrafficEvents.ingestBatch(batch, { wait: false })
  );
}

export function querySocialOverview(
  params: SocialOverviewParams
): Promise<QueryResult<SocialOverviewRow> | null> {
  return cachedPipeQuery(
    "social",
    "social_overview",
    params,
    params.organization_id,
    (client) => client.socialOverview.query(params)
  );
}

export function queryEngagementTimeseries(
  params: EngagementTimeseriesParams
): Promise<QueryResult<EngagementTimeseriesRow> | null> {
  return cachedPipeQuery(
    "social",
    "engagement_timeseries",
    params,
    params.organization_id,
    (client) => client.engagementTimeseries.query(params)
  );
}

export function queryTopPosts(
  params: TopPostsParams
): Promise<QueryResult<TopPostsRow> | null> {
  return cachedPipeQuery(
    "social",
    "top_posts",
    params,
    params.organization_id,
    (client) => client.topPosts.query(params)
  );
}

export function queryFollowerGrowth(
  params: FollowerGrowthParams
): Promise<QueryResult<FollowerGrowthRow> | null> {
  return cachedPipeQuery(
    "social",
    "follower_growth",
    params,
    params.organization_id,
    (client) => client.followerGrowth.query(params)
  );
}

export function queryPostingPerformance(
  params: PostingPerformanceParams
): Promise<QueryResult<PostingPerformanceRow> | null> {
  return cachedPipeQuery(
    "social",
    "posting_performance",
    params,
    params.organization_id,
    (client) => client.postingPerformance.query(params)
  );
}

export function queryNotraAdoption(params: {
  organization_id: string;
}): Promise<QueryResult<NotraAdoptionRow> | null> {
  return cachedPipeQuery(
    "social",
    "notra_adoption",
    params,
    params.organization_id,
    (client) => client.notraAdoption.query(params)
  );
}

export function queryAccountLeaderboard(
  params: AccountLeaderboardParams
): Promise<QueryResult<AccountLeaderboardRow> | null> {
  return cachedPipeQuery(
    "social",
    "account_leaderboard",
    params,
    params.organization_id,
    (client) => client.accountLeaderboard.query(params)
  );
}

export function queryPostMetricsLookup(params: {
  organization_id: string;
  post_ids: string[];
}): Promise<QueryResult<PostMetricsLookupRow> | null> {
  return cachedPipeQuery(
    "social",
    "post_metrics_lookup",
    params,
    params.organization_id,
    (client) =>
      // The SDK serializes arrays as repeated query keys (post_ids=a&post_ids=b),
      // but Tinybird's Array() template reads a single comma-separated value, so
      // repeated keys silently collapse to one id. Send one pre-joined value.
      client.postMetricsLookup.query({
        organization_id: params.organization_id,
        post_ids: [params.post_ids.join(",")],
      })
  );
}

export function queryGeoTrafficOverview(
  params: InferParams<typeof geoTrafficOverview>
): Promise<QueryResult<GeoTrafficOverviewRow> | null> {
  return cachedPipeQuery(
    "geo",
    "geo_traffic_overview",
    params,
    params.organization_id,
    (client) => client.geoTrafficOverview.query(params)
  );
}

export function queryGeoTrafficTimeseries(
  params: InferParams<typeof geoTrafficTimeseries>
): Promise<QueryResult<GeoTrafficTimeseriesRow> | null> {
  return cachedPipeQuery(
    "geo",
    "geo_traffic_timeseries",
    params,
    params.organization_id,
    (client) => client.geoTrafficTimeseries.query(params)
  );
}

export function queryGeoTrafficPages(
  params: GeoTrafficPagesParams
): Promise<QueryResult<GeoTrafficPagesRow> | null> {
  return cachedPipeQuery(
    "geo",
    "geo_traffic_pages",
    params,
    params.organization_id,
    (client) => client.geoTrafficPages.query(params)
  );
}

export function queryGeoTrafficLog(
  params: GeoTrafficLogParams
): Promise<QueryResult<GeoTrafficLogRow> | null> {
  return cachedPipeQuery(
    "geo",
    "geo_traffic_log",
    params,
    params.organization_id,
    (client) => client.geoTrafficLog.query(params)
  );
}

export function queryGeoTrafficJourneys(
  params: InferParams<typeof geoTrafficJourneys>
): Promise<QueryResult<GeoTrafficJourneysRow> | null> {
  return cachedPipeQuery(
    "geo",
    "geo_traffic_journeys",
    params,
    params.organization_id,
    (client) => client.geoTrafficJourneys.query(params)
  );
}

export function queryGeoJourneySources(
  params: InferParams<typeof geoJourneySources>
): Promise<QueryResult<GeoJourneySourcesRow> | null> {
  return cachedPipeQuery(
    "geo",
    "geo_journey_sources",
    params,
    params.organization_id,
    (client) => client.geoJourneySources.query(params)
  );
}

export function queryGeoJourneyPages(
  params: InferParams<typeof geoJourneyPages>
): Promise<QueryResult<GeoJourneyPagesRow> | null> {
  return cachedPipeQuery(
    "geo",
    "geo_journey_pages",
    params,
    params.organization_id,
    (client) => client.geoJourneyPages.query(params)
  );
}

export function queryGeoJourneyDetail(
  params: InferParams<typeof geoJourneyDetail>
): Promise<QueryResult<GeoJourneyDetailRow> | null> {
  return cachedPipeQuery(
    "geo",
    "geo_journey_detail",
    params,
    params.organization_id,
    (client) => client.geoJourneyDetail.query(params)
  );
}

/**
 * Queries an endpoint with its params in a POST body. The SDK sends them in
 * the URL, which a long id list pushes past the server's limit (HTTP 414).
 */
async function postPipeQuery<TRow>(
  pipe: string,
  params: Record<string, unknown>
): Promise<QueryResult<TRow>> {
  const response = await createTimeoutFetch(TINYBIRD_REQUEST_TIMEOUT_MS)(
    new URL(`/v0/pipes/${pipe}.json`, tinybirdBaseUrl()),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TINYBIRD_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    }
  );
  if (!response.ok) {
    throw new Error(`Tinybird ${pipe} query failed (${response.status})`);
  }
  return (await response.json()) as QueryResult<TRow>;
}

/** Cross-organization AI traffic for the admin console, cached globally. */
export function queryGeoTrafficTrendsDaily(
  params: InferParams<typeof geoTrafficTrendsDaily>
): Promise<QueryResult<GeoTrafficTrendsDailyRow> | null> {
  return cachedPipeQuery(
    "geo",
    "geo_traffic_trends_daily",
    params,
    null,
    // Every sample, demo and deleted project id rides along to be excluded.
    () =>
      postPipeQuery<GeoTrafficTrendsDailyRow>(
        "geo_traffic_trends_daily",
        params
      )
  );
}

export function queryGeoTrafficTrendsProjects(
  params: InferParams<typeof geoTrafficTrendsProjects>
): Promise<QueryResult<GeoTrafficTrendsProjectsRow> | null> {
  return cachedPipeQuery(
    "geo",
    "geo_traffic_trends_projects",
    params,
    null,
    (client) => client.geoTrafficTrendsProjects.query(params)
  );
}

export function ingestWebPageViews(
  rows: WebPageViewRow[]
): Promise<IngestResult | null> {
  return ingestRows(
    rows,
    "geo",
    rows.map((row) => row.organization_id),
    (client, batch) => client.webPageViews.ingestBatch(batch, { wait: false })
  );
}

export function ingestWebPageEngagement(
  rows: WebPageEngagementRow[]
): Promise<IngestResult | null> {
  return ingestRows(
    rows,
    "geo",
    rows.map((row) => row.organization_id),
    (client, batch) =>
      client.webPageEngagement.ingestBatch(batch, { wait: false })
  );
}

export function queryWebEngagement(
  params: InferParams<typeof webEngagement>
): Promise<QueryResult<WebEngagementRow> | null> {
  return cachedPipeQuery(
    "geo",
    "web_engagement",
    params,
    params.organization_id,
    (client) => client.webEngagement.query(params)
  );
}

export function queryWebOverview(
  params: InferParams<typeof webOverview>
): Promise<QueryResult<WebOverviewRow> | null> {
  return cachedPipeQuery(
    "geo",
    "web_overview",
    params,
    params.organization_id,
    (client) => client.webOverview.query(params)
  );
}

export function queryWebTimeseries(
  params: InferParams<typeof webTimeseries>
): Promise<QueryResult<WebTimeseriesRow> | null> {
  return cachedPipeQuery(
    "geo",
    "web_timeseries",
    params,
    params.organization_id,
    (client) => client.webTimeseries.query(params)
  );
}

export function queryWebPages(
  params: InferParams<typeof webPages>
): Promise<QueryResult<WebPagesRow> | null> {
  return cachedPipeQuery(
    "geo",
    "web_pages",
    params,
    params.organization_id,
    (client) => client.webPages.query(params)
  );
}

export function queryWebSources(
  params: InferParams<typeof webSources>
): Promise<QueryResult<WebSourcesRow> | null> {
  return cachedPipeQuery(
    "geo",
    "web_sources",
    params,
    params.organization_id,
    (client) => client.webSources.query(params)
  );
}

export function queryWebAudience(
  params: InferParams<typeof webAudience>
): Promise<QueryResult<WebAudienceRow> | null> {
  return cachedPipeQuery(
    "geo",
    "web_audience",
    params,
    params.organization_id,
    (client) => client.webAudience.query(params)
  );
}

export function queryWebHosts(
  params: InferParams<typeof webHosts>
): Promise<QueryResult<WebHostsRow> | null> {
  return cachedPipeQuery(
    "geo",
    "web_hosts",
    params,
    params.organization_id,
    (client) => client.webHosts.query(params)
  );
}

export function queryWebAiOutcomes(
  params: InferParams<typeof webAiOutcomes>
): Promise<QueryResult<WebAiOutcomesRow> | null> {
  return cachedPipeQuery(
    "geo",
    "web_ai_outcomes",
    params,
    params.organization_id,
    (client) => client.webAiOutcomes.query(params)
  );
}

export function ingestMcpEvents(
  rows: McpEventRow[]
): Promise<IngestResult | null> {
  return ingestRows(
    rows,
    "geo",
    rows.map((row) => row.organization_id),
    (client, batch) => client.mcpEvents.ingestBatch(batch, { wait: false })
  );
}

export function queryMcpOverview(
  params: InferParams<typeof mcpOverview>
): Promise<QueryResult<McpOverviewRow> | null> {
  return cachedPipeQuery(
    "geo",
    "mcp_overview",
    params,
    params.organization_id,
    (client) => client.mcpOverview.query(params)
  );
}

export function queryMcpTimeseries(
  params: InferParams<typeof mcpTimeseries>
): Promise<QueryResult<McpTimeseriesRow> | null> {
  return cachedPipeQuery(
    "geo",
    "mcp_timeseries",
    params,
    params.organization_id,
    (client) => client.mcpTimeseries.query(params)
  );
}

export function queryMcpTools(
  params: InferParams<typeof mcpTools>
): Promise<QueryResult<McpToolsRow> | null> {
  return cachedPipeQuery(
    "geo",
    "mcp_tools",
    params,
    params.organization_id,
    (client) => client.mcpTools.query(params)
  );
}

export function queryMcpClients(
  params: InferParams<typeof mcpClients>
): Promise<QueryResult<McpClientsRow> | null> {
  return cachedPipeQuery(
    "geo",
    "mcp_clients",
    params,
    params.organization_id,
    (client) => client.mcpClients.query(params)
  );
}

export function queryMcpLog(
  params: InferParams<typeof mcpLog>
): Promise<QueryResult<McpLogRow> | null> {
  return cachedPipeQuery(
    "geo",
    "mcp_log",
    params,
    params.organization_id,
    (client) => client.mcpLog.query(params)
  );
}

export function queryMcpToolNeighbors(
  params: InferParams<typeof mcpToolNeighbors>
): Promise<QueryResult<McpToolNeighborsRow> | null> {
  return cachedPipeQuery(
    "geo",
    "mcp_tool_neighbors",
    params,
    params.organization_id,
    (client) => client.mcpToolNeighbors.query(params)
  );
}

export function queryMcpToolFailures(
  params: InferParams<typeof mcpToolFailures>
): Promise<QueryResult<McpToolFailuresRow> | null> {
  return cachedPipeQuery(
    "geo",
    "mcp_tool_failures",
    params,
    params.organization_id,
    (client) => client.mcpToolFailures.query(params)
  );
}

export function queryMcpIntents(
  params: InferParams<typeof mcpIntents>
): Promise<QueryResult<McpIntentsRow> | null> {
  return cachedPipeQuery(
    "geo",
    "mcp_intents",
    params,
    params.organization_id,
    (client) => client.mcpIntents.query(params)
  );
}

export function queryMcpUsers(
  params: InferParams<typeof mcpUsers>
): Promise<QueryResult<McpUsersRow> | null> {
  return cachedPipeQuery(
    "geo",
    "mcp_users",
    params,
    params.organization_id,
    (client) => client.mcpUsers.query(params)
  );
}

export function queryMcpSessions(
  params: InferParams<typeof mcpSessions>
): Promise<QueryResult<McpSessionsRow> | null> {
  return cachedPipeQuery(
    "geo",
    "mcp_sessions",
    params,
    params.organization_id,
    (client) => client.mcpSessions.query(params)
  );
}

export function queryMcpSessionEvents(
  params: InferParams<typeof mcpSessionEvents>
): Promise<QueryResult<McpSessionEventsRow> | null> {
  return cachedPipeQuery(
    "geo",
    "mcp_session_events",
    params,
    params.organization_id,
    (client) => client.mcpSessionEvents.query(params)
  );
}

export function queryMcpCatalog(
  params: InferParams<typeof mcpCatalog>
): Promise<QueryResult<McpCatalogRow> | null> {
  return cachedPipeQuery(
    "geo",
    "mcp_catalog",
    params,
    params.organization_id,
    (client) => client.mcpCatalog.query(params)
  );
}

export function queryMcpModels(
  params: InferParams<typeof mcpModels>
): Promise<QueryResult<McpModelsRow> | null> {
  return cachedPipeQuery(
    "geo",
    "mcp_models",
    params,
    params.organization_id,
    (client) => client.mcpModels.query(params)
  );
}

export function queryMcpElicitations(
  params: InferParams<typeof mcpElicitations>
): Promise<QueryResult<McpElicitationsRow> | null> {
  return cachedPipeQuery(
    "geo",
    "mcp_elicitations",
    params,
    params.organization_id,
    (client) => client.mcpElicitations.query(params)
  );
}

export function queryMcpUiRenders(
  params: InferParams<typeof mcpUiRenders>
): Promise<QueryResult<McpUiRendersRow> | null> {
  return cachedPipeQuery(
    "geo",
    "mcp_ui_renders",
    params,
    params.organization_id,
    (client) => client.mcpUiRenders.query(params)
  );
}
