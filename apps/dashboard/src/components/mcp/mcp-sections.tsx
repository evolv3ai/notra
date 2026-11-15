"use client";

import { formatDayLabel } from "@notra/geo-core/utils/day-label";
import { InstrumentSection } from "@notra/ui/components/instrument/instrument-module";
import { TrendBadge } from "@notra/ui/components/trend-badge";
import { Button } from "@notra/ui/components/ui/button";
import { DataTable } from "@notra/ui/components/ui/data-table";
import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";
import { useState } from "react";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import { EChartsAreaChart } from "@/components/evilcharts/charts/echarts-area-chart";
import { CodeSnippet } from "@/components/geo/code-snippet";
import {
  TRAFFIC_HERO_CHART_OPTIONS,
  TRAFFIC_HERO_CHART_SURFACE_CLASS,
  TRAFFIC_HERO_FRAME_CLASS,
  TRAFFIC_HERO_METRIC_CELL_CLASS,
  TRAFFIC_HERO_METRIC_VALUE_CLASS,
  TRAFFIC_HERO_METRICS_GRID_CLASS,
  TRAFFIC_HERO_METRICS_SURFACE_CLASS,
} from "@/constants/geo-traffic-hero";
import {
  MCP_DAILY_SERIES,
  MCP_LOG_FILTERS,
  MCP_SERIES_COLORS,
  MCP_SERIES_DOT_CLASS,
  MCP_SETUP_SNIPPET,
} from "@/constants/mcp-analytics";
import { TABLE_ROW_HEIGHT } from "@/constants/table";
import { useMcpColumns } from "@/lib/hooks/use-mcp-columns";
import type { ChartConfig } from "@/types/charts";
import type {
  McpAnalyticsHeroProps,
  McpAudienceSectionsProps,
  McpLoadFailedProps,
  McpLogFilter,
  McpMetric,
  McpOptInHintProps,
  McpRequestLogProps,
  McpToolSectionsProps,
} from "@/types/mcp-analytics";
import { formatFullDayLabel } from "@/utils/analytics-charts";
import { seriesColors } from "@/utils/chart-colors";
import { formatMilliseconds } from "@/utils/format";
import { formatChartInteger } from "@/utils/geo-charts";
import { errorRate, percentChange } from "@/utils/mcp-analytics";
import { paginatedTableHeightFor } from "@/utils/table";

function trendTone(metric: McpMetric) {
  const rounded = Math.round(metric.delta);
  if (rounded === 0) {
    return "flat";
  }
  return rounded > 0 !== Boolean(metric.lowerIsBetter) ? "up" : "down";
}

function OptInHint({ text }: McpOptInHintProps) {
  return <p className="text-muted-foreground text-sm">{text}</p>;
}

export function McpSetupPrompt() {
  const t = useTranslations("geo.pages.mcp.setup");
  return (
    <InstrumentSection eyebrow={t("title")} hint={t("hint")}>
      <CodeSnippet code={MCP_SETUP_SNIPPET} filename="server.ts" />
    </InstrumentSection>
  );
}

export function McpLoadFailed({ onRetry }: McpLoadFailedProps) {
  const t = useTranslations("geo.pages.mcp.loadFailed");
  const tActions = useTranslations("common.actions");
  return (
    <InstrumentSection eyebrow={t("title")} hint={t("hint")}>
      <Button onClick={() => onRetry()} size="sm" variant="outline">
        {tActions("tryAgain")}
      </Button>
    </InstrumentSection>
  );
}

function useMcpMetrics({
  data: { totals },
}: McpAnalyticsHeroProps): McpMetric[] {
  const t = useTranslations("geo.pages.mcp.metrics");
  const format = useFormatter();
  const locale = useLocale();
  const rate = errorRate(totals.errors, totals.requests);
  return [
    {
      label: t("toolCalls"),
      value: format.number(totals.toolCalls),
      delta: percentChange(totals.toolCalls, totals.previousToolCalls),
    },
    {
      label: t("sessions"),
      value: format.number(totals.sessions),
      delta: percentChange(totals.sessions, totals.previousSessions),
    },
    {
      label: t("errorRate"),
      value: format.number(rate / 100, {
        style: "percent",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
      delta: percentChange(
        rate,
        errorRate(totals.previousErrors, totals.previousRequests)
      ),
      lowerIsBetter: true,
    },
    {
      label: t("p95Latency"),
      value: formatMilliseconds(totals.p95Ms, locale),
      delta: percentChange(totals.p95Ms, totals.previousP95Ms),
      lowerIsBetter: true,
    },
  ];
}

export function McpAnalyticsHero({ data }: McpAnalyticsHeroProps) {
  const t = useTranslations("geo.pages.mcp.chart");
  const locale = useLocale();
  const metrics = useMcpMetrics({ data });
  const seriesLabel = (series: (typeof MCP_DAILY_SERIES)[number]) =>
    series.label || t("otherMethods");
  const chartConfig: ChartConfig = Object.fromEntries(
    MCP_DAILY_SERIES.map((series) => [
      series.key,
      {
        label: seriesLabel(series),
        colors: seriesColors(MCP_SERIES_COLORS[series.key]),
      },
    ])
  );

  return (
    <div className={TRAFFIC_HERO_FRAME_CLASS}>
      <div
        className={`${TRAFFIC_HERO_METRICS_GRID_CLASS} ${TRAFFIC_HERO_METRICS_SURFACE_CLASS}`}
      >
        {metrics.map((metric) => (
          <div className={TRAFFIC_HERO_METRIC_CELL_CLASS} key={metric.label}>
            <p className="text-foreground/75 text-sm leading-5 font-semibold tracking-tight">
              {metric.label}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className={TRAFFIC_HERO_METRIC_VALUE_CLASS}>
                {metric.value}
              </span>
              <TrendBadge
                showIcon={!metric.lowerIsBetter}
                tone={trendTone(metric)}
              >
                {metric.delta > 0 ? "+" : ""}
                {Math.round(metric.delta)}%
              </TrendBadge>
            </div>
          </div>
        ))}
      </div>
      <div className={TRAFFIC_HERO_CHART_SURFACE_CLASS}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium">{t("title")}</h2>
          <ul className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            {MCP_DAILY_SERIES.map((series) => (
              <li className="flex items-center gap-1.5" key={series.key}>
                <span
                  aria-hidden="true"
                  className={`size-2 rounded-xs ${MCP_SERIES_DOT_CLASS[series.key]}`}
                />
                <span className={series.label ? "font-mono" : undefined}>
                  {seriesLabel(series)}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <EChartsAreaChart
          animationType="left-to-right"
          chartOptions={TRAFFIC_HERO_CHART_OPTIONS}
          className="h-52 w-full @md/hero:h-72"
          config={chartConfig}
          curveType="monotone"
          data={data.daily.map((row) => ({
            ...row,
            rawDay: row.day,
            day: formatDayLabel(row.day, locale),
          }))}
          xDataKey="day"
        >
          <EChartsAreaChart.Grid variant="solid" />
          <EChartsAreaChart.XAxis dataKey="day" />
          <EChartsAreaChart.YAxis />
          {MCP_DAILY_SERIES.map((series) => (
            <EChartsAreaChart.Area
              dataKey={series.key}
              key={series.key}
              strokeVariant="solid"
              strokeWidth={2}
              variant="gradient"
            />
          ))}
          <EChartsAreaChart.Tooltip
            labelKey="rawDay"
            labelFormatter={(day: string) => formatFullDayLabel(day, locale)}
            roundness="xl"
            valueFormatter={(value: number) =>
              formatChartInteger(value, locale)
            }
          />
        </EChartsAreaChart>
      </div>
    </div>
  );
}

export function McpToolSections({ data, onOpenTool }: McpToolSectionsProps) {
  const t = useTranslations("geo.pages.mcp");
  const columns = useMcpColumns();
  const unusedTools = data.catalog?.unusedTools ?? [];
  return (
    <>
      <InstrumentSection
        eyebrow={t("tools.title")}
        hint={t("tools.hint")}
        readout={
          unusedTools.length > 0
            ? t("tools.readoutWithUnused", {
                called: data.tools.length,
                unused: unusedTools.length,
              })
            : t("tools.readout", { called: data.tools.length })
        }
      >
        <DataTable
          columns={columns.tools}
          data={data.tools}
          defaultSort={{ key: "calls", direction: "desc" }}
          getRowId={(row) => row.name}
          height={paginatedTableHeightFor(data.tools.length)}
          onRowClick={(row) => onOpenTool(row.name)}
          rowHeight={TABLE_ROW_HEIGHT}
        />
      </InstrumentSection>
      {unusedTools.length > 0 ? (
        <InstrumentSection
          eyebrow={t("unused.title")}
          hint={t("unused.hint")}
          readout={t("unused.readout", { count: unusedTools.length })}
        >
          <ul className="divide-border divide-y text-sm">
            {unusedTools.map((tool) => (
              <li
                className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4"
                key={tool.name}
              >
                <span className="shrink-0 font-mono sm:w-56">{tool.name}</span>
                <span className="text-muted-foreground min-w-0">
                  {tool.description || t("unused.noDescription")}
                </span>
              </li>
            ))}
          </ul>
        </InstrumentSection>
      ) : null}
    </>
  );
}

export function McpServerRequestSections({
  data,
  onOpenTool,
}: McpToolSectionsProps) {
  const t = useTranslations("geo.pages.mcp");
  const columns = useMcpColumns();
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <InstrumentSection
        eyebrow={t("elicitations.title")}
        hint={t("elicitations.hint")}
        readout={t("elicitations.readout", {
          count: data.elicitations.reduce((sum, row) => sum + row.requests, 0),
        })}
      >
        {data.elicitations.length > 0 ? (
          <DataTable
            columns={columns.elicitations}
            data={data.elicitations}
            defaultSort={{ key: "requests", direction: "desc" }}
            getRowId={(row) => `${row.method}-${row.tool}`}
            height={paginatedTableHeightFor(data.elicitations.length)}
            onRowClick={(row) => (row.tool ? onOpenTool(row.tool) : null)}
            rowHeight={TABLE_ROW_HEIGHT}
          />
        ) : (
          <OptInHint text={t("elicitations.empty")} />
        )}
      </InstrumentSection>
      <InstrumentSection
        eyebrow={t("uiRenders.title")}
        hint={t("uiRenders.hint")}
        readout={t("uiRenders.readout", {
          count: data.uiRenders.reduce((sum, row) => sum + row.renders, 0),
        })}
      >
        {data.uiRenders.length > 0 ? (
          <DataTable
            columns={columns.uiRenders}
            data={data.uiRenders}
            defaultSort={{ key: "renders", direction: "desc" }}
            getRowId={(row) => row.resource}
            height={paginatedTableHeightFor(data.uiRenders.length)}
            rowHeight={TABLE_ROW_HEIGHT}
          />
        ) : (
          <OptInHint text={t("uiRenders.empty")} />
        )}
      </InstrumentSection>
    </div>
  );
}

export function McpAudienceSections({
  data,
  onOpenTool,
  onOpenSession,
}: McpAudienceSectionsProps) {
  const t = useTranslations("geo.pages.mcp");
  const columns = useMcpColumns();
  return (
    <>
      <div className="grid gap-6 xl:grid-cols-2">
        <InstrumentSection
          eyebrow={t("clients.title")}
          hint={t("clients.hint")}
          readout={t("clients.readout", { count: data.clients.length })}
        >
          <DataTable
            columns={columns.clients}
            data={data.clients}
            defaultSort={{ key: "sessions", direction: "desc" }}
            getRowId={(row) => row.name}
            height={paginatedTableHeightFor(data.clients.length)}
            rowHeight={TABLE_ROW_HEIGHT}
          />
        </InstrumentSection>
        <InstrumentSection
          eyebrow={t("models.title")}
          hint={t("models.hint")}
          readout={t("models.readout", { count: data.models.length })}
        >
          {data.models.length > 0 ? (
            <DataTable
              columns={columns.models}
              data={data.models}
              defaultSort={{ key: "sessions", direction: "desc" }}
              getRowId={(row) => row.name}
              height={paginatedTableHeightFor(data.models.length)}
              rowHeight={TABLE_ROW_HEIGHT}
            />
          ) : (
            <OptInHint text={t("models.empty")} />
          )}
        </InstrumentSection>
      </div>

      <InstrumentSection
        eyebrow={t("sessions.title")}
        hint={t("sessions.hint")}
        readout={t("sessions.readout", { count: data.totals.sessions })}
      >
        <DataTable
          columns={columns.sessions}
          data={data.sessions}
          getRowId={(row) => row.id}
          height={paginatedTableHeightFor(data.sessions.length)}
          onRowClick={onOpenSession}
          rowHeight={TABLE_ROW_HEIGHT}
        />
      </InstrumentSection>

      <div className="grid gap-6 xl:grid-cols-2">
        <InstrumentSection
          eyebrow={t("intents.title")}
          hint={t("intents.hint")}
        >
          {data.intents.length > 0 ? (
            <DataTable
              columns={columns.intents}
              data={data.intents}
              defaultSort={{ key: "calls", direction: "desc" }}
              getRowId={(row) => `${row.intent}-${row.tool}`}
              height={paginatedTableHeightFor(data.intents.length)}
              onRowClick={(row) => (row.tool ? onOpenTool(row.tool) : null)}
              rowHeight={TABLE_ROW_HEIGHT}
            />
          ) : (
            <OptInHint text={t("intents.empty")} />
          )}
        </InstrumentSection>
        <InstrumentSection
          eyebrow={t("users.title")}
          readout={t("users.readout", { count: data.totals.users })}
        >
          {data.users.length > 0 ? (
            <DataTable
              columns={columns.users}
              data={data.users}
              defaultSort={{ key: "calls", direction: "desc" }}
              getRowId={(row) => row.id}
              height={paginatedTableHeightFor(data.users.length)}
              rowHeight={TABLE_ROW_HEIGHT}
            />
          ) : (
            <OptInHint text={t("users.empty")} />
          )}
        </InstrumentSection>
      </div>
    </>
  );
}

export function McpRequestLog({ data, onOpenRequest }: McpRequestLogProps) {
  const t = useTranslations("geo.pages.mcp.requests");
  const columns = useMcpColumns();
  const [filter, setFilter] = useState<McpLogFilter>("all");
  const requests =
    filter === "errors"
      ? data.errorRequests
      : data.requests.filter(
          (entry) => filter === "all" || entry.status === "ok"
        );
  return (
    <InstrumentSection
      action={
        <Tabs
          onValueChange={(value) => {
            const next = MCP_LOG_FILTERS.find((item) => item === value);
            if (next) {
              setFilter(next);
            }
          }}
          value={filter}
        >
          <TabsList aria-label={t("filterLabel")}>
            <TabsTrigger value="all">{t("all")}</TabsTrigger>
            <TabsTrigger value="success">{t("success")}</TabsTrigger>
            <TabsTrigger value="errors">{t("errors")}</TabsTrigger>
          </TabsList>
        </Tabs>
      }
      eyebrow={t("title")}
      hint={t("hint")}
    >
      <DataTable
        columns={columns.requests}
        data={requests}
        getRowId={(row) => row.id}
        height={paginatedTableHeightFor(requests.length)}
        onRowClick={onOpenRequest}
        rowHeight={TABLE_ROW_HEIGHT}
      />
    </InstrumentSection>
  );
}
