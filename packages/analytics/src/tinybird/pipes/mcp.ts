import {
  defineEndpoint,
  defineMaterializedView,
  node,
  p,
  t,
} from "@tinybirdco/sdk";

import {
  GEO_CAPTURED_WINDOW_SQL,
  GEO_DAY_COMPARISON_WINDOW_SQL,
  GEO_DAY_CURRENT_CONDITION,
  GEO_DAY_PREVIOUS_CONDITION,
  GEO_DAY_WINDOW_SQL,
  GEO_PROJECT_SCOPE_PARAMS,
  GEO_PROJECT_SCOPE_SQL,
  GEO_WINDOW_PARAMS,
} from "../../constants/geo-queries";
import { mcpDaily } from "../datasources";

const MCP_QUERY_PARAMS = {
  organization_id: p.string().describe("Organization id"),
  ...GEO_PROJECT_SCOPE_PARAMS,
  ...GEO_WINDOW_PARAMS,
};

const MCP_WHERE = `WHERE organization_id = {{String(organization_id)}}
          ${GEO_PROJECT_SCOPE_SQL}`;

const MCP_LIMIT_PARAM = {
  limit: p.int32().optional(50).describe("Maximum rows"),
};

export const mcpDailyMv = defineMaterializedView("mcp_daily_mv", {
  description: "Rolls mcp_events into mcp_daily on every ingest",
  datasource: mcpDaily,
  nodes: [
    node({
      name: "mcp_daily_rollup",
      sql: `
        SELECT
          toDate(captured_at) AS day,
          organization_id,
          project_id,
          method,
          status,
          client_name,
          target,
          countState() AS requests_state,
          uniqState(session_id) AS sessions_state,
          uniqIfState(user_id, toUInt8(user_id != '')) AS users_state,
          sumState(response_bytes) AS response_bytes_state,
          quantilesTDigestState(0.5, 0.95)(duration_ms) AS duration_state,
          maxState(toDateTime(captured_at)) AS last_seen_state
        FROM mcp_events
        GROUP BY day, organization_id, project_id, method, status, client_name, target
      `,
    }),
  ],
});

export const mcpOverview = defineEndpoint("mcp_overview", {
  description:
    "Requests, tool calls, sessions, errors and p95 latency for the window and the window before it",
  params: MCP_QUERY_PARAMS,
  nodes: [
    node({
      name: "overview",
      sql: `
        SELECT
          countMergeIf(requests_state, (${GEO_DAY_CURRENT_CONDITION})) AS requests,
          countMergeIf(requests_state, (${GEO_DAY_PREVIOUS_CONDITION})) AS previous_requests,
          countMergeIf(requests_state, method = 'tools/call' AND (${GEO_DAY_CURRENT_CONDITION})) AS tool_calls,
          countMergeIf(requests_state, method = 'tools/call' AND (${GEO_DAY_PREVIOUS_CONDITION})) AS previous_tool_calls,
          countMergeIf(requests_state, status != 'ok' AND (${GEO_DAY_CURRENT_CONDITION})) AS errors,
          countMergeIf(requests_state, status != 'ok' AND (${GEO_DAY_PREVIOUS_CONDITION})) AS previous_errors,
          uniqMergeIf(sessions_state, (${GEO_DAY_CURRENT_CONDITION})) AS sessions,
          uniqMergeIf(sessions_state, (${GEO_DAY_PREVIOUS_CONDITION})) AS previous_sessions,
          uniqIfMergeIf(users_state, (${GEO_DAY_CURRENT_CONDITION})) AS users,
          uniqIfMergeIf(users_state, (${GEO_DAY_PREVIOUS_CONDITION})) AS previous_users,
          quantilesTDigestMergeIf(0.5, 0.95)(duration_state, (${GEO_DAY_CURRENT_CONDITION}))[2] AS p95_ms,
          quantilesTDigestMergeIf(0.5, 0.95)(duration_state, (${GEO_DAY_PREVIOUS_CONDITION}))[2] AS previous_p95_ms
        FROM mcp_daily
        ${MCP_WHERE}
          ${GEO_DAY_COMPARISON_WINDOW_SQL}
      `,
    }),
  ],
  output: {
    requests: t.uint64(),
    previous_requests: t.uint64(),
    tool_calls: t.uint64(),
    previous_tool_calls: t.uint64(),
    errors: t.uint64(),
    previous_errors: t.uint64(),
    sessions: t.uint64(),
    previous_sessions: t.uint64(),
    users: t.uint64(),
    previous_users: t.uint64(),
    p95_ms: t.float32(),
    previous_p95_ms: t.float32(),
  },
});

export const mcpTimeseries = defineEndpoint("mcp_timeseries", {
  description: "Daily requests split by MCP method family, plus errors",
  params: MCP_QUERY_PARAMS,
  nodes: [
    node({
      name: "daily",
      sql: `
        SELECT
          day,
          countMergeIf(requests_state, method = 'tools/call') AS tools_call,
          countMergeIf(requests_state, method = 'resources/read') AS resources_read,
          countMergeIf(requests_state, method = 'prompts/get') AS prompts_get,
          countMergeIf(requests_state, method NOT IN ('tools/call', 'resources/read', 'prompts/get')) AS other,
          countMergeIf(requests_state, status != 'ok') AS errors
        FROM mcp_daily
        ${MCP_WHERE}
          ${GEO_DAY_WINDOW_SQL}
        GROUP BY day
        ORDER BY day ASC
      `,
    }),
  ],
  output: {
    day: t.date(),
    tools_call: t.uint64(),
    resources_read: t.uint64(),
    prompts_get: t.uint64(),
    other: t.uint64(),
    errors: t.uint64(),
  },
});

export const mcpTools = defineEndpoint("mcp_tools", {
  description: "Tools by calls with error count and p50/p95 latency",
  params: { ...MCP_QUERY_PARAMS, ...MCP_LIMIT_PARAM },
  nodes: [
    node({
      name: "tools",
      sql: `
        SELECT
          target AS name,
          countMerge(requests_state) AS calls,
          countMergeIf(requests_state, status != 'ok') AS errors,
          uniqIfMerge(users_state) AS users,
          sumMerge(response_bytes_state) / greatest(countMerge(requests_state), 1) AS avg_response_bytes,
          quantilesTDigestMerge(0.5, 0.95)(duration_state)[1] AS p50_ms,
          quantilesTDigestMerge(0.5, 0.95)(duration_state)[2] AS p95_ms
        FROM mcp_daily
        ${MCP_WHERE}
          AND method = 'tools/call'
          ${GEO_DAY_WINDOW_SQL}
        GROUP BY name
        ORDER BY calls DESC
        LIMIT {{Int32(limit, 50)}}
      `,
    }),
  ],
  output: {
    name: t.string(),
    calls: t.uint64(),
    errors: t.uint64(),
    users: t.uint64(),
    avg_response_bytes: t.float64(),
    p50_ms: t.float32(),
    p95_ms: t.float32(),
  },
});

export const mcpClients = defineEndpoint("mcp_clients", {
  description: "MCP clients by sessions with request and error counts",
  params: { ...MCP_QUERY_PARAMS, ...MCP_LIMIT_PARAM },
  nodes: [
    node({
      name: "clients",
      sql: `
        SELECT
          client_name,
          uniqMerge(sessions_state) AS sessions,
          countMerge(requests_state) AS requests,
          countMergeIf(requests_state, status != 'ok') AS errors,
          maxMerge(last_seen_state) AS last_seen_at
        FROM mcp_daily
        ${MCP_WHERE}
          ${GEO_DAY_WINDOW_SQL}
        GROUP BY client_name
        ORDER BY sessions DESC
        LIMIT {{Int32(limit, 50)}}
      `,
    }),
  ],
  output: {
    client_name: t.string(),
    sessions: t.uint64(),
    requests: t.uint64(),
    errors: t.uint64(),
    last_seen_at: t.dateTime(),
  },
});

export const mcpLog = defineEndpoint("mcp_log", {
  description:
    "Most recent MCP requests; status_filter is all, success or errors",
  params: {
    ...MCP_QUERY_PARAMS,
    ...MCP_LIMIT_PARAM,
    status_filter: p
      .string()
      .optional("all")
      .describe("all, success or errors"),
  },
  nodes: [
    node({
      name: "log",
      sql: `
        SELECT
          captured_at,
          session_id,
          server_name,
          server_version,
          protocol_version,
          client_name,
          client_version,
          method,
          target,
          status,
          error_code,
          error_message,
          duration_ms,
          response_bytes,
          user_id,
          intent,
          model,
          arguments,
          response,
          outcome
        FROM mcp_events
        ${MCP_WHERE}
          ${GEO_CAPTURED_WINDOW_SQL}
          AND multiIf(
            {{String(status_filter, 'all')}} = 'success', status = 'ok',
            {{String(status_filter, 'all')}} = 'errors', status != 'ok',
            1
          )
        ORDER BY captured_at DESC
        LIMIT {{Int32(limit, 50)}}
      `,
    }),
  ],
  output: {
    captured_at: t.dateTime64(3),
    session_id: t.string(),
    server_name: t.string(),
    server_version: t.string(),
    protocol_version: t.string(),
    client_name: t.string(),
    client_version: t.string(),
    method: t.string(),
    target: t.string(),
    status: t.string(),
    error_code: t.int32(),
    error_message: t.string(),
    duration_ms: t.uint32(),
    response_bytes: t.uint32(),
    user_id: t.string(),
    intent: t.string(),
    model: t.string(),
    arguments: t.string(),
    response: t.string(),
    outcome: t.string(),
  },
});

const MCP_RAW_WHERE = `${MCP_WHERE}
          ${GEO_CAPTURED_WINDOW_SQL}`;

const MCP_TOOL_PARAM = {
  tool: p.string().optional("").describe("Tool name, empty for every tool"),
};

const MCP_TOOL_FILTER_SQL = `AND ({{String(tool, '')}} = '' OR (method = 'tools/call' AND target = {{String(tool, '')}}))`;

export const mcpToolNeighbors = defineEndpoint("mcp_tool_neighbors", {
  description:
    "Tools called right before and right after a tool in the same session; after_failure counts the hops where the earlier call failed (retries and switches)",
  params: {
    ...MCP_QUERY_PARAMS,
    ...MCP_LIMIT_PARAM,
    tool: p.string().describe("Tool name"),
  },
  nodes: [
    node({
      name: "neighbors",
      sql: `
        SELECT
          tupleElement(hop, 1) AS direction,
          tupleElement(hop, 2) AS neighbor,
          count() AS calls,
          countIf(tupleElement(hop, 3)) AS after_failure
        FROM (
          SELECT
            target,
            status,
            lagInFrame(target, 1, '') OVER session_order AS previous_target,
            lagInFrame(status, 1, '') OVER session_order AS previous_status,
            leadInFrame(target, 1, '') OVER session_order AS next_target
          FROM mcp_events
          ${MCP_RAW_WHERE}
            AND method = 'tools/call'
            AND session_id != ''
            AND session_id IN (
              SELECT session_id
              FROM mcp_events
              ${MCP_RAW_WHERE}
                AND method = 'tools/call'
                AND session_id != ''
                AND target = {{String(tool)}}
            )
          WINDOW session_order AS (
            PARTITION BY session_id
            ORDER BY captured_at, sequence
            ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING
          )
        )
        ARRAY JOIN [
          ('before', previous_target, previous_status NOT IN ('ok', '')),
          ('after', next_target, status != 'ok')
        ] AS hop
        WHERE target = {{String(tool)}}
        GROUP BY direction, neighbor
        ORDER BY calls DESC
        LIMIT {{Int32(limit, 50)}}
      `,
    }),
  ],
  output: {
    direction: t.string(),
    neighbor: t.string(),
    calls: t.uint64(),
    after_failure: t.uint64(),
  },
});

export const mcpToolFailures = defineEndpoint("mcp_tool_failures", {
  description: "Failed calls of one tool grouped by error message and client",
  params: {
    ...MCP_QUERY_PARAMS,
    ...MCP_LIMIT_PARAM,
    tool: p.string().describe("Tool name"),
  },
  nodes: [
    node({
      name: "failures",
      sql: `
        SELECT
          substring(error_message, 1, 300) AS message,
          client_name,
          any(status) AS failure_status,
          any(error_code) AS failure_code,
          count() AS calls,
          max(captured_at) AS last_seen_at
        FROM mcp_events
        ${MCP_RAW_WHERE}
          AND method = 'tools/call'
          AND target = {{String(tool)}}
          AND status != 'ok'
        GROUP BY message, client_name
        ORDER BY calls DESC
        LIMIT {{Int32(limit, 50)}}
      `,
    }),
  ],
  output: {
    message: t.string(),
    client_name: t.string(),
    failure_status: t.string(),
    failure_code: t.int32(),
    calls: t.uint64(),
    last_seen_at: t.dateTime64(3),
  },
});

export const mcpIntents = defineEndpoint("mcp_intents", {
  description:
    "Most frequent agent-stated intents, with the tool they routed to and their error count",
  params: { ...MCP_QUERY_PARAMS, ...MCP_LIMIT_PARAM, ...MCP_TOOL_PARAM },
  nodes: [
    node({
      name: "intents",
      sql: `
        SELECT
          intent,
          target AS intent_tool,
          count() AS calls,
          countIf(status != 'ok') AS errors
        FROM mcp_events
        ${MCP_RAW_WHERE}
          AND intent != ''
          ${MCP_TOOL_FILTER_SQL}
        GROUP BY intent, intent_tool
        ORDER BY calls DESC
        LIMIT {{Int32(limit, 50)}}
      `,
    }),
  ],
  output: {
    intent: t.string(),
    intent_tool: t.string(),
    calls: t.uint64(),
    errors: t.uint64(),
  },
});

export const mcpUsers = defineEndpoint("mcp_users", {
  description: "Most active identified users, for every tool or one tool",
  params: { ...MCP_QUERY_PARAMS, ...MCP_LIMIT_PARAM, ...MCP_TOOL_PARAM },
  nodes: [
    node({
      name: "users",
      sql: `
        SELECT
          user_id,
          count() AS calls,
          countIf(status != 'ok') AS errors,
          uniq(session_id) AS sessions,
          max(captured_at) AS last_seen_at
        FROM mcp_events
        ${MCP_RAW_WHERE}
          AND user_id != ''
          ${MCP_TOOL_FILTER_SQL}
        GROUP BY user_id
        ORDER BY calls DESC
        LIMIT {{Int32(limit, 50)}}
      `,
    }),
  ],
  output: {
    user_id: t.string(),
    calls: t.uint64(),
    errors: t.uint64(),
    sessions: t.uint64(),
    last_seen_at: t.dateTime64(3),
  },
});

export const mcpSessions = defineEndpoint("mcp_sessions", {
  description:
    "Most recent MCP sessions with their client, user and call counts",
  params: { ...MCP_QUERY_PARAMS, ...MCP_LIMIT_PARAM },
  nodes: [
    node({
      name: "sessions",
      sql: `
        SELECT
          session_id,
          any(client_name) AS session_client,
          anyIf(user_id, user_id != '') AS session_user,
          anyIf(model, model != '') AS session_model,
          min(captured_at) AS started_at,
          max(captured_at) AS ended_at,
          count() AS requests,
          countIf(method = 'tools/call') AS tool_calls,
          countIf(status != 'ok') AS errors
        FROM mcp_events
        ${MCP_RAW_WHERE}
          AND session_id != ''
        GROUP BY session_id
        ORDER BY started_at DESC
        LIMIT {{Int32(limit, 50)}}
      `,
    }),
  ],
  output: {
    session_id: t.string(),
    session_client: t.string(),
    session_user: t.string(),
    session_model: t.string(),
    started_at: t.dateTime64(3),
    ended_at: t.dateTime64(3),
    requests: t.uint64(),
    tool_calls: t.uint64(),
    errors: t.uint64(),
  },
});

export const mcpSessionEvents = defineEndpoint("mcp_session_events", {
  description: "Every request of one MCP session in order",
  params: {
    ...MCP_QUERY_PARAMS,
    limit: p.int32().optional(500).describe("Maximum rows"),
    session_id: p.string().describe("MCP session id"),
  },
  nodes: [
    node({
      name: "session_events",
      sql: `
        SELECT
          captured_at,
          method,
          target,
          status,
          error_code,
          error_message,
          duration_ms,
          response_bytes,
          intent,
          arguments,
          response,
          outcome
        FROM mcp_events
        ${MCP_RAW_WHERE}
          AND session_id = {{String(session_id)}}
        ORDER BY captured_at ASC, sequence ASC
        LIMIT {{Int32(limit, 500)}}
      `,
    }),
  ],
  output: {
    captured_at: t.dateTime64(3),
    method: t.string(),
    target: t.string(),
    status: t.string(),
    error_code: t.int32(),
    error_message: t.string(),
    duration_ms: t.uint32(),
    response_bytes: t.uint32(),
    intent: t.string(),
    arguments: t.string(),
    response: t.string(),
    outcome: t.string(),
  },
});

export const mcpCatalog = defineEndpoint("mcp_catalog", {
  description:
    "The latest tools/list answer: every tool the server advertised, with descriptions, MCP Apps ui:// resources and the advertised tools nobody called in the window",
  params: MCP_QUERY_PARAMS,
  nodes: [
    node({
      name: "catalog",
      sql: `
        WITH (
          SELECT groupUniqArray(target)
          FROM mcp_daily
          ${MCP_WHERE}
            AND method = 'tools/call'
            ${GEO_DAY_WINDOW_SQL}
        ) AS called_tools
        SELECT
          argMax(listed_tools, captured_at) AS tools,
          argMax(listed_descriptions, captured_at) AS descriptions,
          argMax(listed_ui_resources, captured_at) AS ui_resources,
          arrayFilter((name) -> NOT has(called_tools, name), tools) AS unused_tools,
          max(captured_at) AS listed_at
        FROM mcp_events
        ${MCP_RAW_WHERE}
          AND method = 'tools/list'
          AND notEmpty(listed_tools)
      `,
    }),
  ],
  output: {
    tools: t.array(t.string()),
    descriptions: t.array(t.string()),
    ui_resources: t.array(t.string()),
    unused_tools: t.array(t.string()),
    listed_at: t.dateTime64(3),
  },
});

export const mcpModels = defineEndpoint("mcp_models", {
  description: "Models agents reported via the optional _model parameter",
  params: { ...MCP_QUERY_PARAMS, ...MCP_LIMIT_PARAM },
  nodes: [
    node({
      name: "models",
      sql: `
        SELECT
          model,
          uniq(session_id) AS sessions,
          count() AS calls,
          countIf(status != 'ok') AS errors
        FROM mcp_events
        ${MCP_RAW_WHERE}
          AND model != ''
        GROUP BY model
        ORDER BY calls DESC
        LIMIT {{Int32(limit, 50)}}
      `,
    }),
  ],
  output: {
    model: t.string(),
    sessions: t.uint64(),
    calls: t.uint64(),
    errors: t.uint64(),
  },
});

export const mcpElicitations = defineEndpoint("mcp_elicitations", {
  description:
    "Requests servers sent to clients (elicitation, sampling) per triggering tool, with the user's accept, decline and cancel answers",
  params: { ...MCP_QUERY_PARAMS, ...MCP_LIMIT_PARAM },
  nodes: [
    node({
      name: "elicitations",
      sql: `
        SELECT
          method,
          target AS tool,
          count() AS requests,
          countIf(outcome = 'accept') AS accepted,
          countIf(outcome = 'decline') AS declined,
          countIf(outcome = 'cancel') AS cancelled,
          countIf(status != 'ok') AS errors
        FROM mcp_events
        ${MCP_RAW_WHERE}
          AND method IN ('elicitation/create', 'sampling/createMessage')
        GROUP BY method, tool
        ORDER BY requests DESC
        LIMIT {{Int32(limit, 50)}}
      `,
    }),
  ],
  output: {
    method: t.string(),
    tool: t.string(),
    requests: t.uint64(),
    accepted: t.uint64(),
    declined: t.uint64(),
    cancelled: t.uint64(),
    errors: t.uint64(),
  },
});

export const mcpUiRenders = defineEndpoint("mcp_ui_renders", {
  description:
    "MCP Apps interfaces (ui:// resources) hosts loaded, by resource",
  params: { ...MCP_QUERY_PARAMS, ...MCP_LIMIT_PARAM },
  nodes: [
    node({
      name: "ui_renders",
      sql: `
        SELECT
          target AS resource,
          countMergeIf(requests_state, status = 'ok') AS renders,
          uniqMergeIf(sessions_state, status = 'ok') AS sessions,
          countMergeIf(requests_state, status != 'ok') AS errors
        FROM mcp_daily
        ${MCP_WHERE}
          AND method = 'resources/read'
          AND startsWith(target, 'ui://')
          ${GEO_DAY_WINDOW_SQL}
        GROUP BY resource
        ORDER BY renders DESC
        LIMIT {{Int32(limit, 50)}}
      `,
    }),
  ],
  output: {
    resource: t.string(),
    renders: t.uint64(),
    sessions: t.uint64(),
    errors: t.uint64(),
  },
});
