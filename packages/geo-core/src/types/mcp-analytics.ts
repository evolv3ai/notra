import type { MCP_EVENT_STATUSES } from "../constants/geo";

export type McpEventStatus = (typeof MCP_EVENT_STATUSES)[number];

export interface McpAnalyticsServer {
  name: string;
  version: string;
  protocolVersion: string;
}

export interface McpAnalyticsTotals {
  requests: number;
  previousRequests: number;
  toolCalls: number;
  previousToolCalls: number;
  errors: number;
  previousErrors: number;
  sessions: number;
  previousSessions: number;
  users: number;
  previousUsers: number;
  p95Ms: number;
  previousP95Ms: number;
}

export interface McpAnalyticsDay {
  day: string;
  toolsCall: number;
  resourcesRead: number;
  promptsGet: number;
  other: number;
  errors: number;
}

export interface McpAnalyticsTool {
  name: string;
  description: string;
  calls: number;
  errors: number;
  users: number;
  avgResponseBytes: number;
  p50Ms: number;
  p95Ms: number;
  uiResource: string;
}

export interface McpAnalyticsClient {
  name: string;
  sessions: number;
  requests: number;
  errors: number;
  lastSeenAt: string;
}

export interface McpAnalyticsRequest {
  id: string;
  capturedAt: string;
  sessionId: string;
  clientName: string;
  clientVersion: string;
  protocolVersion: string;
  method: string;
  target: string;
  status: McpEventStatus;
  errorCode: number;
  errorMessage: string;
  durationMs: number;
  responseBytes: number;
  userId: string;
  intent: string;
  model: string;
  arguments: string;
  response: string;
  outcome: string;
}

export interface McpAnalyticsSession {
  id: string;
  clientName: string;
  userId: string;
  model: string;
  startedAt: string;
  endedAt: string;
  requests: number;
  toolCalls: number;
  errors: number;
}

export interface McpAnalyticsModel {
  name: string;
  sessions: number;
  calls: number;
  errors: number;
}

export interface McpAnalyticsIntent {
  intent: string;
  tool: string;
  calls: number;
  errors: number;
}

export interface McpAnalyticsUser {
  id: string;
  calls: number;
  errors: number;
  sessions: number;
  lastSeenAt: string;
}

export interface McpAnalyticsElicitation {
  method: string;
  tool: string;
  requests: number;
  accepted: number;
  declined: number;
  cancelled: number;
  errors: number;
}

export interface McpAnalyticsUiRender {
  resource: string;
  tools: string[];
  renders: number;
  sessions: number;
  errors: number;
}

export interface McpAnalyticsCatalog {
  listedAt: string;
  unusedTools: { name: string; description: string }[];
}

export interface McpAnalyticsResponse {
  configured: boolean;
  server: McpAnalyticsServer | null;
  totals: McpAnalyticsTotals;
  daily: McpAnalyticsDay[];
  tools: McpAnalyticsTool[];
  clients: McpAnalyticsClient[];
  requests: McpAnalyticsRequest[];
  errorRequests: McpAnalyticsRequest[];
  sessions: McpAnalyticsSession[];
  models: McpAnalyticsModel[];
  intents: McpAnalyticsIntent[];
  users: McpAnalyticsUser[];
  elicitations: McpAnalyticsElicitation[];
  uiRenders: McpAnalyticsUiRender[];
  catalog: McpAnalyticsCatalog | null;
}

export interface McpToolNeighbor {
  tool: string;
  calls: number;
  afterFailure: number;
}

export interface McpToolFailure {
  message: string;
  clientName: string;
  status: McpEventStatus;
  errorCode: number;
  calls: number;
  lastSeenAt: string;
}

export interface McpToolDetailResponse {
  before: McpToolNeighbor[];
  after: McpToolNeighbor[];
  failures: McpToolFailure[];
  intents: McpAnalyticsIntent[];
  users: McpAnalyticsUser[];
}

export interface McpSessionEvent {
  id: string;
  capturedAt: string;
  method: string;
  target: string;
  status: McpEventStatus;
  errorCode: number;
  errorMessage: string;
  durationMs: number;
  responseBytes: number;
  intent: string;
  arguments: string;
  response: string;
  outcome: string;
}

export interface McpSessionResponse {
  events: McpSessionEvent[];
}
