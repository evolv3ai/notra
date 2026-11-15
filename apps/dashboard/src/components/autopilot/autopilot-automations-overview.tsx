"use client";

import {
  Add01Icon,
  PlayIcon,
  WorkflowSquare03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AUTOPILOT_AUTOMATION_KINDS } from "@notra/db/constants/autopilot";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { DataTable, type TableColumn } from "ui/table";

import { AutopilotStatStrip } from "@/components/autopilot/autopilot-stat-strip";
import { AutopilotTableEmpty } from "@/components/autopilot/autopilot-table-empty";
import { Button } from "@/components/button";
import { AUTOPILOT_POLL_INTERVAL_MS } from "@/constants/autopilot";
import {
  AUTOPILOT_AUTOMATIONS,
  AUTOPILOT_EMPTY_TABLE_HEIGHT,
  AUTOPILOT_KIND_META,
} from "@/constants/autopilot-ui";
import { TABLE_ROW_HEIGHT } from "@/constants/table";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  AutopilotAutomationRow,
  AutopilotAutomationsOverviewProps,
} from "@/types/autopilot-metrics";
import { tableHeightFor } from "@/utils/table";

const formatNumber = (value: number | null | undefined) =>
  value == null ? "—" : String(value);

/** The automations that are on, with what they produced in the period. */
export function AutopilotAutomationsOverview({
  organizationId,
  days,
  jobs,
  isRunning,
  canManage,
  addingKind,
  onOpenAutomation,
  onAddAutomation,
  onRunAutomation,
  runningKind,
  runDisabled,
}: AutopilotAutomationsOverviewProps) {
  const query = useQuery({
    ...dashboardOrpc.autopilot.metrics.queryOptions({
      input: { organizationId, days },
    }),
    refetchInterval: isRunning ? AUTOPILOT_POLL_INTERVAL_MS : false,
  });
  const metrics = query.data;
  const enabled = AUTOPILOT_AUTOMATION_KINDS.filter((kind) => jobs[kind]);
  const available = AUTOPILOT_AUTOMATION_KINDS.filter((kind) => !jobs[kind]);
  const rows: AutopilotAutomationRow[] = enabled.map((kind) => {
    const metric = metrics?.automations.find((row) => row.kind === kind);
    return {
      kind,
      pullRequests: metric?.pullRequests ?? null,
      merged: metric?.merged ?? null,
      creditsPerRun: metric?.creditsPerRun ?? null,
    };
  });
  const stats = [
    { label: "PRs generated", value: metrics?.pullRequests },
    { label: "PRs merged", value: metrics?.merged },
    { label: "Avg credits per run", value: metrics?.averageCreditsPerRun },
    { label: "Total credits", value: metrics?.totalCredits },
  ];

  const columns: TableColumn<AutopilotAutomationRow>[] = [
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
      key: "pullRequests",
      header: "PRs",
      width: "5rem",
      cell: (row) => (
        <span className="tabular-nums">{formatNumber(row.pullRequests)}</span>
      ),
    },
    {
      key: "merged",
      header: "Merged",
      width: "6rem",
      cell: (row) => (
        <span className="tabular-nums">{formatNumber(row.merged)}</span>
      ),
    },
    {
      key: "creditsPerRun",
      header: "Credits/run",
      width: "7rem",
      collapsePriority: 1,
      cell: (row) => (
        <span className="tabular-nums">{formatNumber(row.creditsPerRun)}</span>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            width: "6rem",
            align: "right",
            cell: (row) => (
              <Button
                aria-label={`Run ${AUTOPILOT_AUTOMATIONS[row.kind].name}`}
                disabled={runDisabled}
                loading={runningKind === row.kind}
                onClick={() => onRunAutomation(row.kind)}
                size="xs"
                variant="outline"
              >
                <HugeiconsIcon icon={PlayIcon} size={14} />
                Run
              </Button>
            ),
          } satisfies TableColumn<AutopilotAutomationRow>,
        ]
      : []),
  ];

  const addMenu =
    canManage && available.length > 0 ? (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              loading={addingKind !== null}
              size="sm"
              variant={enabled.length === 0 ? "outline" : "ghost"}
            />
          }
        >
          <HugeiconsIcon icon={Add01Icon} size={14} />
          Add automation
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80">
          {available.map((kind) => (
            <DropdownMenuItem
              className="flex-col items-start gap-0.5"
              key={kind}
              onClick={() => onAddAutomation(kind)}
            >
              <span className="font-medium">
                {AUTOPILOT_AUTOMATIONS[kind].name}
              </span>
              <span className="text-muted-foreground text-xs text-pretty">
                {AUTOPILOT_AUTOMATIONS[kind].description}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  return (
    <div className="space-y-4">
      <AutopilotStatStrip busy={query.isPending} stats={stats} />
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
      ) : null}
      <DataTable
        columns={columns}
        data={rows}
        emptyState={
          <AutopilotTableEmpty
            action={addMenu}
            description="Add one and Autopilot starts on it with the next run."
            icon={WorkflowSquare03Icon}
            title="No automations on"
          />
        }
        getRowId={(row) => row.kind}
        height={
          rows.length > 0
            ? tableHeightFor(rows.length)
            : AUTOPILOT_EMPTY_TABLE_HEIGHT
        }
        onRowClick={(row) => onOpenAutomation(row.kind)}
        rowHeight={TABLE_ROW_HEIGHT}
      />
    </div>
  );
}
