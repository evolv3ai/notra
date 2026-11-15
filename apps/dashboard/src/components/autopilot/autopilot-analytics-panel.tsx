"use client";

import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { formatDayLabel, todayIsoDate } from "@notra/geo-core/utils/day-label";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import type { CSSProperties } from "react";
import { InstrumentEmpty, InstrumentModule } from "ui/card";
import { DataTable, type TableColumn } from "ui/table";
import { useLocale } from "use-intl";

import { AutopilotRunsTable } from "@/components/autopilot/autopilot-runs-table";
import { AutopilotStatStrip } from "@/components/autopilot/autopilot-stat-strip";
import { AutopilotTrend } from "@/components/autopilot/autopilot-trend";
import { Button } from "@/components/button";
import { EChartsAreaChart } from "@/components/evilcharts/charts/echarts-area-chart";
import { AUTOPILOT_RUN_TRIGGER_LABELS } from "@/constants/autopilot";
import {
  AUTOPILOT_ACTIVITY_LEGEND,
  AUTOPILOT_ANALYTICS_STAT_LABELS,
  AUTOPILOT_AUTOMATIONS,
  AUTOPILOT_KIND_META,
  AUTOPILOT_OUTCOMES,
  AUTOPILOT_TRIGGER_COLORS,
} from "@/constants/autopilot-ui";
import { CHART_PRIMARY_COLOR, CHART_SECONDARY_COLOR } from "@/constants/charts";
import { TABLE_ROW_HEIGHT } from "@/constants/table";
import { dashboardOrpc } from "@/lib/orpc/query";
import { cn } from "@/lib/utils";
import type {
  AutopilotAnalytics,
  AutopilotAnalyticsAutomation,
  AutopilotAnalyticsPanelProps,
  AutopilotAnalyticsSummary,
  AutopilotOutcomeKey,
} from "@/types/autopilot-metrics";
import type { ChartConfig } from "@/types/charts";
import { formatFullDayLabel } from "@/utils/analytics-charts";
import {
  formatHoursToMerge,
  formatRunDuration,
  formatShare,
  runningTotals,
  shareOf,
} from "@/utils/autopilot-analytics";
import { seriesColors } from "@/utils/chart-colors";
import { formatChartInteger } from "@/utils/geo-charts";
import { tableHeightFor } from "@/utils/table";

const OPENED_KEY = "opened";
const MERGED_KEY = "merged";

const CHART_CONFIG: ChartConfig = {
  [OPENED_KEY]: {
    label: "Opened",
    colors: seriesColors(CHART_PRIMARY_COLOR),
  },
  [MERGED_KEY]: {
    label: "Merged",
    colors: seriesColors(CHART_SECONDARY_COLOR),
  },
};

/** General numbers about what Autopilot produced and how it was received. */
export function AutopilotAnalyticsPanel({
  organizationId,
  days,
  runs,
  onSelectRun,
}: AutopilotAnalyticsPanelProps) {
  const locale = useLocale();
  const query = useQuery(
    dashboardOrpc.autopilot.analytics.queryOptions({
      input: { organizationId, days },
    })
  );
  const data = query.data;
  const stats = buildStats(data?.summary, data?.previous);

  return (
    <div className="space-y-4">
      {query.isError ? (
        <div className="flex flex-wrap items-center gap-3 text-sm" role="alert">
          <p>Could not load the numbers.</p>
          <Button
            disabled={query.isFetching}
            onClick={() => query.refetch()}
            size="sm"
            variant="outline"
          >
            Try again
          </Button>
        </div>
      ) : (
        <AutopilotStatStrip busy={query.isPending} stats={stats} />
      )}
      {query.isError ? null : data ? (
        <>
          <PullRequestActivity locale={locale} series={data.series} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <IdeasModule outcomes={data.outcomes} summary={data.summary} />
            <RunsModule summary={data.summary} triggers={data.triggers} />
          </div>
          <AutomationsTable rows={data.automations} />
        </>
      ) : (
        <>
          <Skeleton className="h-80 w-full rounded-2xl" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        </>
      )}
      <section aria-labelledby="autopilot-recent-runs" className="space-y-3">
        <h2 className="text-sm font-medium" id="autopilot-recent-runs">
          Recent runs
        </h2>
        <AutopilotRunsTable onSelect={onSelectRun} runs={runs} />
      </section>
    </div>
  );
}

function buildStats(
  summary: AutopilotAnalyticsSummary | undefined,
  previous: AutopilotAnalyticsSummary | undefined
) {
  if (!summary) {
    return AUTOPILOT_ANALYTICS_STAT_LABELS.map((label) => ({
      label,
      value: null,
    }));
  }
  const { mergeRate } = summary;
  const previousRate = previous?.mergeRate ?? null;
  return [
    {
      label: "PRs opened",
      value: summary.pullRequests,
      trend: (
        <AutopilotTrend
          current={summary.pullRequests}
          previous={previous?.pullRequests}
        />
      ),
    },
    {
      label: "PRs merged",
      value: summary.merged,
      trend: (
        <AutopilotTrend current={summary.merged} previous={previous?.merged} />
      ),
    },
    {
      label: "Merge rate",
      value: formatShare(mergeRate),
      trend:
        mergeRate !== null && previousRate !== null ? (
          <AutopilotTrend
            current={Math.round(mergeRate * 100)}
            previous={Math.round(previousRate * 100)}
          />
        ) : null,
    },
    {
      label: "Median time to merge",
      value: formatHoursToMerge(summary.medianHoursToMerge),
    },
  ];
}

function IdeasModule({
  summary,
  outcomes,
}: {
  summary: AutopilotAnalyticsSummary;
  outcomes: Record<AutopilotOutcomeKey, number>;
}) {
  return (
    <BreakdownModule
      empty="No ideas in this period."
      eyebrow="Ideas"
      facts={[
        {
          label: "Became a PR",
          value:
            formatShare(shareOf(summary.ideasWithPullRequest, summary.ideas)) ??
            "—",
        },
        {
          label: "Merged",
          value: formatShare(shareOf(outcomes.merged, summary.ideas)) ?? "—",
        },
      ]}
      hint="Everything Autopilot found in this period and where it ended up."
      segments={AUTOPILOT_OUTCOMES.map((outcome) => ({
        ...outcome,
        value: outcomes[outcome.key],
      }))}
      total={summary.ideas}
      unit={summary.ideas === 1 ? "idea" : "ideas"}
    />
  );
}

function RunsModule({
  summary,
  triggers,
}: {
  summary: AutopilotAnalyticsSummary;
  triggers: AutopilotAnalytics["triggers"];
}) {
  return (
    <BreakdownModule
      empty="No runs in this period."
      eyebrow="Runs"
      facts={[
        {
          label: "Succeeded",
          value: formatShare(summary.runSuccessRate) ?? "—",
        },
        {
          label: "Avg duration",
          value: formatRunDuration(summary.averageRunSeconds) ?? "—",
        },
        { label: "Credits", value: String(summary.credits) },
      ]}
      segments={triggers.map((row) => ({
        key: row.trigger,
        label: AUTOPILOT_RUN_TRIGGER_LABELS[row.trigger],
        value: row.runs,
        className: AUTOPILOT_TRIGGER_COLORS[row.trigger],
      }))}
      total={summary.runs}
      unit={summary.runs === 1 ? "run" : "runs"}
    />
  );
}

function PullRequestActivity({
  series,
  locale,
}: {
  series: { day: string; opened: number; merged: number }[];
  locale: string;
}) {
  // Running totals: two rising lines read better than days of 0 to 3 PRs.
  const rows = runningTotals(series).map((point) => ({
    day: formatDayLabel(point.day, locale),
    rawDay: point.day,
    [OPENED_KEY]: point.opened,
    [MERGED_KEY]: point.merged,
  }));
  const markIncompleteTail = series.at(-1)?.day === todayIsoDate();
  const last = rows.at(-1);
  const isEmpty = !last || (last[OPENED_KEY] === 0 && last[MERGED_KEY] === 0);

  return (
    <InstrumentModule
      action={
        <ul className="flex items-center gap-4 text-xs">
          {AUTOPILOT_ACTIVITY_LEGEND.map((entry) => (
            <li className="flex items-center gap-1.5" key={entry.key}>
              <span
                aria-hidden="true"
                className={cn("size-2 rounded-full", entry.className)}
              />
              <span className="text-muted-foreground">{entry.label}</span>
            </li>
          ))}
        </ul>
      }
      bodyClassName="flex min-h-0 flex-1 flex-col px-4 pt-1 pb-4"
      eyebrow="Pull requests"
      hint="Running total of pull requests Autopilot opened and you merged in this period."
      variant="table"
    >
      {isEmpty ? (
        <InstrumentEmpty
          className="h-64 min-h-0"
          message="No pull requests in this period."
          seed="autopilot-pull-requests"
        />
      ) : (
        <EChartsAreaChart
          animation={false}
          className="h-64 w-full cursor-crosshair"
          config={CHART_CONFIG}
          curveType="monotone"
          data={rows}
          xDataKey="day"
        >
          <EChartsAreaChart.Grid variant="solid" />
          <EChartsAreaChart.XAxis dataKey="day" />
          <EChartsAreaChart.YAxis />
          <EChartsAreaChart.Area
            dataKey={OPENED_KEY}
            enableBufferLine={markIncompleteTail}
            strokeVariant="solid"
            strokeWidth={2}
            variant="gradient"
          >
            <EChartsAreaChart.ActiveDot variant="border" />
          </EChartsAreaChart.Area>
          <EChartsAreaChart.Area
            dataKey={MERGED_KEY}
            enableBufferLine={markIncompleteTail}
            strokeVariant="solid"
            strokeWidth={2}
            variant="gradient"
          >
            <EChartsAreaChart.ActiveDot variant="border" />
          </EChartsAreaChart.Area>
          <EChartsAreaChart.Tooltip
            confine={false}
            labelFormatter={(day: string) => formatFullDayLabel(day, locale)}
            labelKey="rawDay"
            layout="rows"
            position="fixed"
            roundness="xl"
            scrub
            valueFormatter={(value: number) =>
              formatChartInteger(value, locale)
            }
          />
        </EChartsAreaChart>
      )}
    </InstrumentModule>
  );
}

/** A total, a few facts, and how the total splits up; Ideas and Runs share it. */
function BreakdownModule({
  eyebrow,
  hint,
  total,
  unit,
  facts,
  segments,
  empty,
}: {
  eyebrow: string;
  hint?: string;
  total: number;
  unit: string;
  facts: { label: string; value: string }[];
  segments: {
    key: string;
    label: string;
    value: number;
    className: string;
    /** Shown instead of the colour dot. */
    icon?: IconSvgElement;
    iconClassName?: string;
  }[];
  empty: string;
}) {
  return (
    <InstrumentModule
      bodyClassName="flex flex-1 flex-col gap-4 px-5 pt-4 pb-3"
      className="h-full"
      eyebrow={eyebrow}
      hint={hint}
      variant="table"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <p className="flex items-baseline gap-1.5 text-3xl leading-none font-semibold tracking-tight tabular-nums">
          {total}
          <span className="text-muted-foreground text-sm font-normal tracking-normal">
            {unit}
          </span>
        </p>
        <dl className="flex gap-6">
          {facts.map((fact) => (
            <div className="flex flex-col items-end gap-0.5" key={fact.label}>
              <dt className="text-muted-foreground text-xs">{fact.label}</dt>
              <dd className="text-sm font-medium tabular-nums">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div
        aria-hidden="true"
        className="bg-muted flex h-2 w-full gap-0.5 overflow-hidden rounded-full"
      >
        {total > 0
          ? segments
              .filter((segment) => segment.value > 0)
              .map((segment) => (
                <span
                  className={cn("h-full w-(--share)", segment.className)}
                  key={segment.key}
                  style={
                    {
                      "--share": `${(segment.value / total) * 100}%`,
                    } as CSSProperties
                  }
                />
              ))
          : null}
      </div>
      {total > 0 ? (
        <ul className="divide-border/60 -mx-1 flex flex-col divide-y text-sm">
          {segments.map((segment) => (
            <li
              className="grid grid-cols-[1fr_auto_3rem] items-center gap-3 px-1 py-2"
              key={segment.key}
            >
              <span className="flex min-w-0 items-center gap-2">
                {segment.icon ? (
                  <HugeiconsIcon
                    aria-hidden="true"
                    className={cn("shrink-0", segment.iconClassName)}
                    icon={segment.icon}
                    size={16}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      segment.className
                    )}
                  />
                )}
                <span className="truncate">{segment.label}</span>
              </span>
              <span className="font-medium tabular-nums">{segment.value}</span>
              <span className="text-muted-foreground text-right tabular-nums">
                {formatShare(segment.value / total)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground py-6 text-center text-sm">
          {empty}
        </p>
      )}
    </InstrumentModule>
  );
}

function AutomationsTable({ rows }: { rows: AutopilotAnalyticsAutomation[] }) {
  const columns: TableColumn<AutopilotAnalyticsAutomation>[] = [
    {
      key: "automation",
      header: "Automation",
      width: "1fr",
      minWidth: "14rem",
      cell: (row) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <HugeiconsIcon
            aria-hidden="true"
            className="text-muted-foreground shrink-0"
            icon={AUTOPILOT_KIND_META[row.kind].icon}
            size={16}
          />
          <span className="truncate font-medium">
            {AUTOPILOT_AUTOMATIONS[row.kind].name}
          </span>
        </span>
      ),
    },
    {
      key: "ideas",
      header: "Ideas",
      width: "5rem",
      cell: (row) => <span className="tabular-nums">{row.ideas}</span>,
    },
    {
      key: "pullRequests",
      header: "PRs",
      width: "5rem",
      cell: (row) => <span className="tabular-nums">{row.pullRequests}</span>,
    },
    {
      key: "merged",
      header: "Merged",
      width: "6rem",
      cell: (row) => <span className="tabular-nums">{row.merged}</span>,
    },
    {
      key: "mergeRate",
      header: "Merge rate",
      width: "7rem",
      collapsePriority: 1,
      cell: (row) => (
        <span className="tabular-nums">
          {formatShare(row.mergeRate) ?? "—"}
        </span>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(row) => row.kind}
      height={tableHeightFor(rows.length)}
      rowHeight={TABLE_ROW_HEIGHT}
    />
  );
}
