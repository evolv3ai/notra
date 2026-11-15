import {
  isTinybirdConfigured,
  queryMcpCatalog,
  queryMcpClients,
  queryMcpElicitations,
  queryMcpIntents,
  queryMcpLog,
  queryMcpModels,
  queryMcpOverview,
  queryMcpSessionEvents,
  queryMcpSessions,
  queryMcpTimeseries,
  queryMcpToolFailures,
  queryMcpToolNeighbors,
  queryMcpTools,
  queryMcpUiRenders,
  queryMcpUsers,
} from "@notra/analytics/tinybird/client";
import type {
  McpIntentsRow,
  McpLogRow,
  McpUsersRow,
} from "@notra/analytics/types/tinybird-endpoints";
import { parseClickHouseDateTime } from "@notra/analytics/utils/datetime";
import { isDemoMode } from "@notra/utils/demo-mode";
import { Effect } from "effect";

import {
  MCP_ANALYTICS_DEFAULT_DAYS,
  MCP_ANALYTICS_DETAIL_LIMIT,
  MCP_ANALYTICS_LOG_LIMIT,
  MCP_ANALYTICS_TABLE_LIMIT,
  MCP_EVENT_STATUSES,
  MCP_SESSION_EVENTS_LIMIT,
} from "../constants/geo";
import type { GeoScopeInput, GeoWindowInput } from "../types/geo";
import type {
  McpAnalyticsIntent,
  McpAnalyticsRequest,
  McpAnalyticsResponse,
  McpAnalyticsUser,
  McpEventStatus,
  McpSessionResponse,
  McpToolDetailResponse,
} from "../types/mcp-analytics";
import { geoQuery, geoRequiredQuery } from "./effect";
import { geoScopeParams, resolveGeoScope } from "./projects";
import { geoTrafficWindowParams } from "./window";

function toStatus(value: string): McpEventStatus {
  return MCP_EVENT_STATUSES.find((status) => status === value) ?? "ok";
}

function toIso(value: string): string {
  return parseClickHouseDateTime(value).toISOString();
}

function toIntents(rows: readonly McpIntentsRow[] | undefined) {
  return (rows ?? []).map((row): McpAnalyticsIntent => ({
    intent: row.intent,
    tool: row.intent_tool,
    calls: Number(row.calls),
    errors: Number(row.errors),
  }));
}

function toUsers(rows: readonly McpUsersRow[] | undefined) {
  return (rows ?? []).map((row): McpAnalyticsUser => ({
    id: row.user_id,
    calls: Number(row.calls),
    errors: Number(row.errors),
    sessions: Number(row.sessions),
    lastSeenAt: toIso(row.last_seen_at),
  }));
}

function toRequests(rows: readonly McpLogRow[] | undefined) {
  return (rows ?? []).map((row, index): McpAnalyticsRequest => ({
    id: `${row.captured_at}-${row.session_id}-${index}`,
    capturedAt: toIso(row.captured_at),
    sessionId: row.session_id,
    clientName: row.client_name,
    clientVersion: row.client_version,
    protocolVersion: row.protocol_version,
    method: row.method,
    target: row.target,
    status: toStatus(row.status),
    errorCode: row.error_code,
    errorMessage: row.error_message,
    durationMs: row.duration_ms,
    responseBytes: row.response_bytes,
    userId: row.user_id,
    intent: row.intent,
    model: row.model,
    arguments: row.arguments,
    response: row.response,
    outcome: row.outcome,
  }));
}

const resolveMcpQuery = Effect.fn("mcp.resolveQuery")(function* (
  input: GeoScopeInput,
  window: GeoWindowInput
) {
  const scope = yield* resolveGeoScope(input);
  const configured = isTinybirdConfigured();
  return {
    configured,
    query: configured && !isDemoMode() ? geoRequiredQuery : geoQuery,
    params: {
      ...geoScopeParams(scope),
      ...geoTrafficWindowParams(window, MCP_ANALYTICS_DEFAULT_DAYS),
    },
  };
});

export const loadMcpAnalytics = Effect.fn("mcp.analytics")(function* (
  input: GeoScopeInput,
  window: GeoWindowInput
) {
  const { configured, query, params } = yield* resolveMcpQuery(input, window);
  const limited = { ...params, limit: MCP_ANALYTICS_TABLE_LIMIT };

  const [
    overview,
    timeseries,
    tools,
    clients,
    log,
    errorLog,
    sessions,
    models,
    intents,
    users,
    catalog,
    elicitations,
    uiRenders,
  ] = yield* Effect.all(
    [
      query("mcp overview query failed", () => queryMcpOverview(params)),
      query("mcp timeseries query failed", () => queryMcpTimeseries(params)),
      query("mcp tools query failed", () => queryMcpTools(limited)),
      query("mcp clients query failed", () => queryMcpClients(limited)),
      query("mcp log query failed", () =>
        queryMcpLog({ ...params, limit: MCP_ANALYTICS_LOG_LIMIT })
      ),
      query("mcp error log query failed", () =>
        queryMcpLog({
          ...params,
          limit: MCP_ANALYTICS_LOG_LIMIT,
          status_filter: "errors",
        })
      ),
      query("mcp sessions query failed", () => queryMcpSessions(limited)),
      query("mcp models query failed", () => queryMcpModels(limited)),
      query("mcp intents query failed", () => queryMcpIntents(limited)),
      query("mcp users query failed", () => queryMcpUsers(limited)),
      query("mcp catalog query failed", () => queryMcpCatalog(params)),
      query("mcp elicitations query failed", () =>
        queryMcpElicitations(limited)
      ),
      query("mcp ui renders query failed", () => queryMcpUiRenders(limited)),
    ],
    { concurrency: "unbounded" }
  );

  const totals = overview?.data[0];
  const latest = log?.data[0];
  const listing = catalog?.data[0];
  const descriptions = new Map(
    (listing?.tools ?? []).map((name, index) => [
      name,
      listing?.descriptions[index] ?? "",
    ])
  );
  const uiResources = new Map(
    (listing?.tools ?? []).map((name, index) => [
      name,
      listing?.ui_resources[index] ?? "",
    ])
  );

  const response: McpAnalyticsResponse = {
    configured,
    server: latest
      ? {
          name: latest.server_name,
          version: latest.server_version,
          protocolVersion: latest.protocol_version,
        }
      : null,
    totals: {
      requests: Number(totals?.requests ?? 0),
      previousRequests: Number(totals?.previous_requests ?? 0),
      toolCalls: Number(totals?.tool_calls ?? 0),
      previousToolCalls: Number(totals?.previous_tool_calls ?? 0),
      errors: Number(totals?.errors ?? 0),
      previousErrors: Number(totals?.previous_errors ?? 0),
      sessions: Number(totals?.sessions ?? 0),
      previousSessions: Number(totals?.previous_sessions ?? 0),
      users: Number(totals?.users ?? 0),
      previousUsers: Number(totals?.previous_users ?? 0),
      p95Ms: Math.round(Number(totals?.p95_ms ?? 0)),
      previousP95Ms: Math.round(Number(totals?.previous_p95_ms ?? 0)),
    },
    daily: (timeseries?.data ?? []).map((row) => ({
      day: row.day,
      toolsCall: Number(row.tools_call),
      resourcesRead: Number(row.resources_read),
      promptsGet: Number(row.prompts_get),
      other: Number(row.other),
      errors: Number(row.errors),
    })),
    tools: (tools?.data ?? []).map((row) => ({
      name: row.name,
      description: descriptions.get(row.name) ?? "",
      calls: Number(row.calls),
      errors: Number(row.errors),
      users: Number(row.users),
      avgResponseBytes: Math.round(Number(row.avg_response_bytes)),
      p50Ms: Math.round(Number(row.p50_ms)),
      p95Ms: Math.round(Number(row.p95_ms)),
      uiResource: uiResources.get(row.name) ?? "",
    })),
    clients: (clients?.data ?? []).map((row) => ({
      name: row.client_name,
      sessions: Number(row.sessions),
      requests: Number(row.requests),
      errors: Number(row.errors),
      lastSeenAt: toIso(row.last_seen_at),
    })),
    requests: toRequests(log?.data),
    errorRequests: toRequests(errorLog?.data),
    sessions: (sessions?.data ?? []).map((row) => ({
      id: row.session_id,
      clientName: row.session_client,
      userId: row.session_user,
      model: row.session_model,
      startedAt: toIso(row.started_at),
      endedAt: toIso(row.ended_at),
      requests: Number(row.requests),
      toolCalls: Number(row.tool_calls),
      errors: Number(row.errors),
    })),
    models: (models?.data ?? []).map((row) => ({
      name: row.model,
      sessions: Number(row.sessions),
      calls: Number(row.calls),
      errors: Number(row.errors),
    })),
    intents: toIntents(intents?.data),
    users: toUsers(users?.data),
    elicitations: (elicitations?.data ?? []).map((row) => ({
      method: row.method,
      tool: row.tool,
      requests: Number(row.requests),
      accepted: Number(row.accepted),
      declined: Number(row.declined),
      cancelled: Number(row.cancelled),
      errors: Number(row.errors),
    })),
    uiRenders: (uiRenders?.data ?? []).map((row) => ({
      resource: row.resource,
      tools: [...uiResources]
        .filter(([, resource]) => resource === row.resource)
        .map(([name]) => name),
      renders: Number(row.renders),
      sessions: Number(row.sessions),
      errors: Number(row.errors),
    })),
    catalog:
      listing && listing.tools.length > 0
        ? {
            listedAt: toIso(listing.listed_at),
            unusedTools: listing.unused_tools.map((name) => ({
              name,
              description: descriptions.get(name) ?? "",
            })),
          }
        : null,
  };
  return response;
});

export const loadMcpToolDetail = Effect.fn("mcp.toolDetail")(function* (
  input: GeoScopeInput,
  window: GeoWindowInput,
  tool: string
) {
  const { query, params } = yield* resolveMcpQuery(input, window);
  const detail = { ...params, tool, limit: MCP_ANALYTICS_DETAIL_LIMIT };

  const [neighbors, failures, intents, users] = yield* Effect.all(
    [
      query("mcp neighbors query failed", () => queryMcpToolNeighbors(detail)),
      query("mcp failures query failed", () => queryMcpToolFailures(detail)),
      query("mcp tool intents query failed", () => queryMcpIntents(detail)),
      query("mcp tool users query failed", () => queryMcpUsers(detail)),
    ],
    { concurrency: "unbounded" }
  );

  const hops = (direction: string) =>
    (neighbors?.data ?? [])
      .filter((row) => row.direction === direction)
      .map((row) => ({
        tool: row.neighbor,
        calls: Number(row.calls),
        afterFailure: Number(row.after_failure),
      }));

  const response: McpToolDetailResponse = {
    before: hops("before"),
    after: hops("after"),
    failures: (failures?.data ?? []).map((row) => ({
      message: row.message,
      clientName: row.client_name,
      status: toStatus(row.failure_status),
      errorCode: row.failure_code,
      calls: Number(row.calls),
      lastSeenAt: toIso(row.last_seen_at),
    })),
    intents: toIntents(intents?.data),
    users: toUsers(users?.data),
  };
  return response;
});

export const loadMcpSession = Effect.fn("mcp.session")(function* (
  input: GeoScopeInput,
  window: GeoWindowInput,
  sessionId: string
) {
  const { query, params } = yield* resolveMcpQuery(input, window);
  const events = yield* query("mcp session query failed", () =>
    queryMcpSessionEvents({
      ...params,
      session_id: sessionId,
      limit: MCP_SESSION_EVENTS_LIMIT,
    })
  );

  const response: McpSessionResponse = {
    events: (events?.data ?? []).map((row, index) => ({
      id: `${row.captured_at}-${index}`,
      capturedAt: toIso(row.captured_at),
      method: row.method,
      target: row.target,
      status: toStatus(row.status),
      errorCode: row.error_code,
      errorMessage: row.error_message,
      durationMs: row.duration_ms,
      responseBytes: row.response_bytes,
      intent: row.intent,
      arguments: row.arguments,
      response: row.response,
      outcome: row.outcome,
    })),
  };
  return response;
});
