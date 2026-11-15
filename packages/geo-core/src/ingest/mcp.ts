import type { McpEventRow } from "@notra/analytics/tinybird/datasources";
import { toClickHouseDateTime64 } from "@notra/analytics/utils/datetime";

import type { McpEventInput } from "../types/ingest";

export function isMcpEventBody(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    "type" in body &&
    body.type === "mcp"
  );
}

export function buildMcpEventRow(input: McpEventInput): McpEventRow {
  const { identity, payload, capturedAt } = input;
  return {
    organization_id: identity.organizationId,
    project_id: identity.projectId ?? "",
    captured_at: toClickHouseDateTime64(capturedAt),
    sequence: payload.sequence ?? 0,
    session_id: payload.sessionId ?? "",
    server_name: payload.server?.name ?? "",
    server_version: payload.server?.version ?? "",
    protocol_version: payload.protocolVersion ?? "",
    client_name: payload.client?.name ?? "",
    client_version: payload.client?.version ?? "",
    method: payload.method,
    target: payload.target ?? "",
    status: payload.status,
    error_code: payload.errorCode ?? 0,
    error_message: payload.errorMessage ?? "",
    duration_ms: payload.durationMs,
    response_bytes: payload.responseBytes ?? 0,
    user_id: payload.userId ?? "",
    intent: payload.intent ?? "",
    model: payload.model ?? "",
    arguments: payload.arguments ?? "",
    response: payload.response ?? "",
    outcome: payload.outcome ?? "",
    listed_tools: payload.tools?.map((tool) => tool.name) ?? [],
    listed_descriptions:
      payload.tools?.map((tool) => tool.description ?? "") ?? [],
    listed_ui_resources:
      payload.tools?.map((tool) => tool.uiResource ?? "") ?? [],
  };
}
