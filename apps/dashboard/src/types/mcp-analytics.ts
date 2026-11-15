import type {
  McpAnalyticsResponse,
  McpToolDetailResponse,
  McpAnalyticsClient,
  McpAnalyticsElicitation,
  McpAnalyticsIntent,
  McpAnalyticsModel,
  McpAnalyticsRequest,
  McpAnalyticsSession,
  McpAnalyticsTool,
  McpAnalyticsUiRender,
  McpAnalyticsUser,
  McpSessionEvent,
  McpToolNeighbor,
} from "@notra/geo-core/types/mcp-analytics";

import type { MCP_LOG_FILTERS } from "@/constants/mcp-analytics";
import type { GeoRangeQuery } from "@/types/geo";

export type McpToolStats = McpAnalyticsTool;

export type McpClientStats = McpAnalyticsClient;

export type McpModelStats = McpAnalyticsModel;

export type McpIntentStats = McpAnalyticsIntent;

export type McpUserStats = McpAnalyticsUser;

export type McpElicitationStats = McpAnalyticsElicitation;

export type McpUiRenderStats = McpAnalyticsUiRender;

export type McpSessionSummary = McpAnalyticsSession;

export type McpRequestLogEntry = McpAnalyticsRequest;

export type McpLogFilter = (typeof MCP_LOG_FILTERS)[number];

export type McpRpcErrorKey =
  | "parse"
  | "invalidRequest"
  | "methodNotFound"
  | "invalidParams"
  | "internal"
  | "resourceNotFound";

export type McpServerRequestKey = "elicitation" | "sampling";

export type McpOutcomeBadgeVariant = "success" | "warning" | "secondary";

interface McpAnalyticsSectionsProps {
  data: McpAnalyticsResponse;
  onOpenTool: (name: string) => void;
  onOpenSession: (session: McpSessionSummary) => void;
  onOpenRequest: (entry: McpRequestLogEntry) => void;
}

export type McpToolSectionsProps = Pick<
  McpAnalyticsSectionsProps,
  "data" | "onOpenTool"
>;

export type McpAudienceSectionsProps = Omit<
  McpAnalyticsSectionsProps,
  "onOpenRequest"
>;

export type McpRequestLogProps = Pick<
  McpAnalyticsSectionsProps,
  "data" | "onOpenRequest"
>;

export interface McpOptInHintProps {
  text: string;
}

export interface McpAnalyticsHeroProps {
  data: McpAnalyticsResponse;
}

export interface McpSessionEventItemProps {
  event: McpSessionEvent;
  startedAt: number;
}

export interface McpLoadFailedProps {
  onRetry: () => unknown;
}

export interface McpToolRecoveryProps {
  tool: string;
  after: McpToolNeighbor[];
}

export type McpToolDetailDataProps = Pick<McpToolDetailBodyProps, "data">;

export interface McpToolDetailBodyProps {
  data: McpToolDetailResponse | undefined;
  tool: string;
  onSelectTool: (name: string) => void;
}

export interface McpMetric {
  label: string;
  value: string;
  delta: number;
  lowerIsBetter?: boolean;
}

export interface McpAnalyticsPageProps {
  organizationSlug: string;
}

export interface McpRequestSheetProps {
  entry: McpRequestLogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface McpRequestStatusBadgeProps {
  entry: Pick<McpSessionEvent, "status" | "errorCode"> &
    Partial<Pick<McpSessionEvent, "outcome">>;
}

export interface McpToolSheetProps {
  organizationId: string;
  range: GeoRangeQuery;
  tool: McpToolStats | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTool: (name: string) => void;
}

export interface McpSessionSheetProps {
  organizationId: string;
  range: GeoRangeQuery;
  session: McpSessionSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface McpNeighborListProps {
  title: string;
  edgeLabel: string;
  neighbors: McpToolNeighbor[];
  onSelectTool: (name: string) => void;
}

export interface McpPayloadSnippetsProps {
  arguments: string;
  response: string;
}

export interface TrafficNavProps {
  slug: string;
}
