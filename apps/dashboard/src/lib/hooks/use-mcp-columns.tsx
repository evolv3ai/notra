"use client";

import { Badge } from "@notra/ui/components/ui/badge";
import type { TableColumn } from "@notra/ui/components/ui/data-table";
import type { ReactNode } from "react";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import { AgentFeedbackAgentIcon } from "@/components/agent-feedback/feedback-agent-icon";
import { McpRequestStatusBadge } from "@/components/mcp/mcp-request-sheet";
import { MCP_SERVER_REQUEST_KEYS } from "@/constants/mcp-analytics";
import type {
  McpClientStats,
  McpElicitationStats,
  McpIntentStats,
  McpModelStats,
  McpRequestLogEntry,
  McpSessionSummary,
  McpToolStats,
  McpUiRenderStats,
  McpUserStats,
} from "@/types/mcp-analytics";
import { formatBytes, formatMilliseconds } from "@/utils/format";
import {
  acceptRate,
  errorRate,
  sessionDurationSeconds,
} from "@/utils/mcp-analytics";

function mono(value: string) {
  return <span className="truncate font-mono text-sm">{value}</span>;
}

export function useMcpColumns() {
  const t = useTranslations("geo.pages.mcp");
  const format = useFormatter();
  const locale = useLocale();

  const count = (value: number) => (
    <span className="tabular-nums">{format.number(value)}</span>
  );
  const rate = (value: number) => (
    <span className="tabular-nums">
      {format.number(value / 100, {
        style: "percent",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}
    </span>
  );
  const named = (value: string, fallback = t("fallback.unknown")) =>
    mono(value || fallback);
  const branded = (value: string) => (
    <span className="flex min-w-0 items-center gap-2">
      <AgentFeedbackAgentIcon client={value} />
      {named(value)}
    </span>
  );
  const answered = (row: McpElicitationStats, value: ReactNode) =>
    row.method === "elicitation/create" ? (
      value
    ) : (
      <span className="text-muted-foreground">-</span>
    );
  const serverRequestLabel = (method: string) => {
    const key = MCP_SERVER_REQUEST_KEYS[method];
    return key ? t(`serverRequests.${key}`) : method;
  };

  const tools: TableColumn<McpToolStats>[] = [
    {
      key: "name",
      header: t("columns.tool"),
      width: "2fr",
      sortable: true,
      cell: (row) => (
        <span className="flex min-w-0 items-center gap-2">
          {named(row.name)}
          {row.uiResource ? (
            <Badge size="sm" variant="info">
              {t("uiBadge")}
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      key: "calls",
      header: t("columns.calls"),
      align: "right",
      sortable: true,
      cell: (row) => count(row.calls),
    },
    {
      key: "users",
      header: t("columns.users"),
      align: "right",
      sortable: true,
      collapsePriority: 3,
      cell: (row) => count(row.users),
    },
    {
      key: "errorRate",
      header: t("columns.errors"),
      align: "right",
      sortable: true,
      sortValue: (row) => errorRate(row.errors, row.calls),
      cell: (row) => rate(errorRate(row.errors, row.calls)),
    },
    {
      key: "p95Ms",
      header: t("columns.p95"),
      align: "right",
      sortable: true,
      collapsePriority: 1,
      cell: (row) => (
        <span className="tabular-nums">
          {formatMilliseconds(row.p95Ms, locale)}
        </span>
      ),
    },
    {
      key: "avgResponseBytes",
      header: t("columns.avgResponse"),
      align: "right",
      sortable: true,
      collapsePriority: 2,
      cell: (row) => (
        <span className="tabular-nums">
          {formatBytes(row.avgResponseBytes, locale)}
        </span>
      ),
    },
  ];

  const clients: TableColumn<McpClientStats>[] = [
    {
      key: "name",
      header: t("columns.client"),
      width: "2fr",
      sortable: true,
      cell: (row) => branded(row.name),
    },
    {
      key: "sessions",
      header: t("columns.sessions"),
      align: "right",
      sortable: true,
      cell: (row) => count(row.sessions),
    },
    {
      key: "requests",
      header: t("columns.requests"),
      align: "right",
      sortable: true,
      collapsePriority: 1,
      cell: (row) => count(row.requests),
    },
    {
      key: "errorRate",
      header: t("columns.errors"),
      align: "right",
      sortable: true,
      sortValue: (row) => errorRate(row.errors, row.requests),
      cell: (row) => rate(errorRate(row.errors, row.requests)),
    },
  ];

  const models: TableColumn<McpModelStats>[] = [
    {
      key: "name",
      header: t("columns.model"),
      width: "2fr",
      sortable: true,
      cell: (row) => branded(row.name),
    },
    {
      key: "sessions",
      header: t("columns.sessions"),
      align: "right",
      sortable: true,
      cell: (row) => count(row.sessions),
    },
    {
      key: "errorRate",
      header: t("columns.errors"),
      align: "right",
      sortable: true,
      sortValue: (row) => errorRate(row.errors, row.calls),
      cell: (row) => rate(errorRate(row.errors, row.calls)),
    },
  ];

  const elicitations: TableColumn<McpElicitationStats>[] = [
    {
      key: "tool",
      header: t("columns.tool"),
      width: "2fr",
      sortable: true,
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          {named(row.tool, t("fallback.outsideToolCall"))}
          <span className="text-muted-foreground text-xs">
            {serverRequestLabel(row.method)}
          </span>
        </div>
      ),
    },
    {
      key: "requests",
      header: t("columns.asked"),
      align: "right",
      sortable: true,
      cell: (row) => count(row.requests),
    },
    {
      key: "acceptRate",
      header: t("columns.accepted"),
      align: "right",
      sortable: true,
      sortValue: (row) => acceptRate(row.accepted, row.requests),
      cell: (row) =>
        answered(row, rate(acceptRate(row.accepted, row.requests))),
    },
    {
      key: "declined",
      header: t("columns.declined"),
      align: "right",
      sortable: true,
      collapsePriority: 1,
      cell: (row) => answered(row, count(row.declined)),
    },
    {
      key: "cancelled",
      header: t("columns.cancelled"),
      align: "right",
      sortable: true,
      collapsePriority: 1,
      cell: (row) => answered(row, count(row.cancelled)),
    },
  ];

  const uiRenders: TableColumn<McpUiRenderStats>[] = [
    {
      key: "resource",
      header: t("columns.interface"),
      width: "2fr",
      sortable: true,
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          {named(row.resource)}
          {row.tools.length > 0 ? (
            <span className="text-muted-foreground truncate font-mono text-xs">
              {row.tools.join(", ")}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "renders",
      header: t("columns.renders"),
      align: "right",
      sortable: true,
      cell: (row) => count(row.renders),
    },
    {
      key: "sessions",
      header: t("columns.sessions"),
      align: "right",
      sortable: true,
      collapsePriority: 1,
      cell: (row) => count(row.sessions),
    },
  ];

  const intents: TableColumn<McpIntentStats>[] = [
    {
      key: "intent",
      header: t("columns.intent"),
      width: "3fr",
      cell: (row) => <span className="truncate text-sm">{row.intent}</span>,
    },
    {
      key: "tool",
      header: t("columns.routedTo"),
      width: "2fr",
      collapsePriority: 1,
      cell: (row) => named(row.tool, t("fallback.otherMethod")),
    },
    {
      key: "calls",
      header: t("columns.calls"),
      align: "right",
      sortable: true,
      cell: (row) => count(row.calls),
    },
    {
      key: "errorRate",
      header: t("columns.errors"),
      align: "right",
      sortable: true,
      sortValue: (row) => errorRate(row.errors, row.calls),
      cell: (row) => rate(errorRate(row.errors, row.calls)),
    },
  ];

  const users: TableColumn<McpUserStats>[] = [
    {
      key: "id",
      header: t("columns.user"),
      width: "2fr",
      cell: (row) => named(row.id),
    },
    {
      key: "sessions",
      header: t("columns.sessions"),
      align: "right",
      sortable: true,
      cell: (row) => count(row.sessions),
    },
    {
      key: "calls",
      header: t("columns.calls"),
      align: "right",
      sortable: true,
      cell: (row) => count(row.calls),
    },
    {
      key: "errorRate",
      header: t("columns.errors"),
      align: "right",
      sortable: true,
      collapsePriority: 1,
      sortValue: (row) => errorRate(row.errors, row.calls),
      cell: (row) => rate(errorRate(row.errors, row.calls)),
    },
  ];

  const sessions: TableColumn<McpSessionSummary>[] = [
    {
      key: "startedAt",
      header: t("columns.started"),
      width: "160px",
      cell: (row) => (
        <span className="text-muted-foreground tabular-nums">
          {format.dateTime(new Date(row.startedAt), {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
    },
    {
      key: "clientName",
      header: t("columns.client"),
      cell: (row) => branded(row.clientName),
    },
    {
      key: "userId",
      header: t("columns.user"),
      collapsePriority: 2,
      cell: (row) => named(row.userId, t("fallback.anonymous")),
    },
    {
      key: "toolCalls",
      header: t("columns.toolCalls"),
      align: "right",
      cell: (row) => count(row.toolCalls),
    },
    {
      key: "errors",
      header: t("columns.errors"),
      align: "right",
      cell: (row) =>
        row.errors > 0 ? (
          <Badge variant="warning">{format.number(row.errors)}</Badge>
        ) : (
          <span className="text-muted-foreground">0</span>
        ),
    },
    {
      key: "duration",
      header: t("columns.duration"),
      align: "right",
      collapsePriority: 1,
      cell: (row) => (
        <span className="tabular-nums">
          {t("seconds", {
            count: sessionDurationSeconds(row.startedAt, row.endedAt),
          })}
        </span>
      ),
    },
  ];

  const requests: TableColumn<McpRequestLogEntry>[] = [
    {
      key: "capturedAt",
      header: t("columns.time"),
      width: "140px",
      cell: (row) => (
        <span className="text-muted-foreground tabular-nums">
          {format.dateTime(new Date(row.capturedAt), { timeStyle: "medium" })}
        </span>
      ),
    },
    {
      key: "method",
      header: t("columns.method"),
      width: "2fr",
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-2 font-mono text-sm">
          <span className="shrink-0">{row.method}</span>
          {row.target ? (
            <span className="text-muted-foreground truncate">{row.target}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "clientName",
      header: t("columns.client"),
      collapsePriority: 2,
      cell: (row) => branded(row.clientName),
    },
    {
      key: "status",
      header: t("columns.status"),
      cell: (row) => <McpRequestStatusBadge entry={row} />,
    },
    {
      key: "durationMs",
      header: t("columns.duration"),
      align: "right",
      collapsePriority: 1,
      cell: (row) => (
        <span className="tabular-nums">
          {formatMilliseconds(row.durationMs, locale)}
        </span>
      ),
    },
  ];

  return {
    tools,
    clients,
    models,
    elicitations,
    uiRenders,
    intents,
    users,
    sessions,
    requests,
  };
}
