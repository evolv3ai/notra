import type { InferOutputRow, InferParams } from "@tinybirdco/sdk";

import type {
  geoJourneyDetail,
  geoJourneyPages,
  geoJourneySources,
  geoTrafficJourneys,
  geoTrafficLog,
  geoTrafficOverview,
  geoTrafficPages,
  geoTrafficTimeseries,
} from "../tinybird/pipes/geo-traffic";
import type {
  geoTrafficTrendsDaily,
  geoTrafficTrendsProjects,
} from "../tinybird/pipes/geo-traffic-trends";
import type {
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
} from "../tinybird/pipes/mcp";
import type {
  accountLeaderboard,
  engagementTimeseries,
  followerGrowth,
  notraAdoption,
  postingPerformance,
  postMetricsLookup,
  socialOverview,
  topPosts,
} from "../tinybird/pipes/social";
import type {
  webAiOutcomes,
  webEngagement,
  webAudience,
  webHosts,
  webOverview,
  webPages,
  webSources,
  webTimeseries,
} from "../tinybird/pipes/web";

export type AccountLeaderboardParams = InferParams<typeof accountLeaderboard>;
export type AccountLeaderboardRow = InferOutputRow<typeof accountLeaderboard>;
export type PostingPerformanceParams = InferParams<typeof postingPerformance>;
export type PostingPerformanceRow = InferOutputRow<typeof postingPerformance>;
export type SocialOverviewParams = InferParams<typeof socialOverview>;
export type SocialOverviewRow = InferOutputRow<typeof socialOverview>;
export type EngagementTimeseriesParams = InferParams<
  typeof engagementTimeseries
>;
export type EngagementTimeseriesRow = InferOutputRow<
  typeof engagementTimeseries
>;
export type TopPostsParams = InferParams<typeof topPosts>;
export type TopPostsRow = InferOutputRow<typeof topPosts>;
export type FollowerGrowthParams = InferParams<typeof followerGrowth>;
export type FollowerGrowthRow = InferOutputRow<typeof followerGrowth>;

export type NotraAdoptionRow = InferOutputRow<typeof notraAdoption>;
export type PostMetricsLookupRow = InferOutputRow<typeof postMetricsLookup>;
export type GeoTrafficOverviewRow = InferOutputRow<typeof geoTrafficOverview>;
export type GeoTrafficTimeseriesRow = InferOutputRow<
  typeof geoTrafficTimeseries
>;
export type GeoTrafficPagesRow = InferOutputRow<typeof geoTrafficPages>;
export type GeoTrafficLogRow = InferOutputRow<typeof geoTrafficLog>;
export type GeoTrafficLogParams = InferParams<typeof geoTrafficLog>;
export type GeoTrafficPagesParams = InferParams<typeof geoTrafficPages>;
export type GeoTrafficJourneysRow = InferOutputRow<typeof geoTrafficJourneys>;
export type GeoJourneySourcesRow = InferOutputRow<typeof geoJourneySources>;
export type GeoJourneyPagesRow = InferOutputRow<typeof geoJourneyPages>;
export type GeoJourneyDetailRow = InferOutputRow<typeof geoJourneyDetail>;

export type WebOverviewRow = InferOutputRow<typeof webOverview>;
export type WebTimeseriesRow = InferOutputRow<typeof webTimeseries>;
export type WebPagesRow = InferOutputRow<typeof webPages>;
export type WebSourcesRow = InferOutputRow<typeof webSources>;
export type WebAudienceRow = InferOutputRow<typeof webAudience>;
export type WebHostsRow = InferOutputRow<typeof webHosts>;
export type WebAiOutcomesRow = InferOutputRow<typeof webAiOutcomes>;
export type WebEngagementRow = InferOutputRow<typeof webEngagement>;
export type GeoTrafficTrendsDailyRow = InferOutputRow<
  typeof geoTrafficTrendsDaily
>;
export type GeoTrafficTrendsProjectsRow = InferOutputRow<
  typeof geoTrafficTrendsProjects
>;
export type McpOverviewRow = InferOutputRow<typeof mcpOverview>;
export type McpTimeseriesRow = InferOutputRow<typeof mcpTimeseries>;
export type McpToolsRow = InferOutputRow<typeof mcpTools>;
export type McpClientsRow = InferOutputRow<typeof mcpClients>;
export type McpLogRow = InferOutputRow<typeof mcpLog>;
export type McpToolNeighborsRow = InferOutputRow<typeof mcpToolNeighbors>;
export type McpToolFailuresRow = InferOutputRow<typeof mcpToolFailures>;
export type McpIntentsRow = InferOutputRow<typeof mcpIntents>;
export type McpUsersRow = InferOutputRow<typeof mcpUsers>;
export type McpSessionsRow = InferOutputRow<typeof mcpSessions>;
export type McpSessionEventsRow = InferOutputRow<typeof mcpSessionEvents>;
export type McpCatalogRow = InferOutputRow<typeof mcpCatalog>;
export type McpModelsRow = InferOutputRow<typeof mcpModels>;
export type McpElicitationsRow = InferOutputRow<typeof mcpElicitations>;
export type McpUiRendersRow = InferOutputRow<typeof mcpUiRenders>;
