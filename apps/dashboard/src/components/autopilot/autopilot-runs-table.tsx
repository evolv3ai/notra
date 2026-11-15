"use client";

import { Clock01Icon, Idea01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Shimmer } from "@notra/ui/components/ai-elements/shimmer";
import { TruncateWithTooltip } from "@notra/ui/components/shared/truncate-with-tooltip";
import { StatusBadge } from "@notra/ui/components/status-badge";
import { DataTable, type TableColumn } from "ui/table";
import { useFormatter } from "use-intl";

import { AutopilotTableEmpty } from "@/components/autopilot/autopilot-table-empty";
import {
  AUTOPILOT_RUN_STATUS_BADGES,
  AUTOPILOT_RUN_TRIGGER_LABELS,
} from "@/constants/autopilot";
import {
  AUTOPILOT_EMPTY_TABLE_HEIGHT,
  AUTOPILOT_TRIGGER_ICONS,
} from "@/constants/autopilot-ui";
import { CONTENT_PULL_REQUEST_STATES } from "@/constants/content-overview";
import { TABLE_ROW_HEIGHT } from "@/constants/table";
import { useNow } from "@/lib/hooks/use-now";
import { cn } from "@/lib/utils";
import type {
  AutopilotRunResult,
  AutopilotRunsTableProps,
  AutopilotRunView,
} from "@/types/autopilot";
import { describeRunResult, formatDuration } from "@/utils/autopilot-events";
import { latest } from "@/utils/latest-date";
import { tableHeightFor } from "@/utils/table";

const MENTION = /^(@\S+)(.*)$/;

const RESULT_ICONS = {
  "pull-request": CONTENT_PULL_REQUEST_STATES.open,
  ideas: { icon: Idea01Icon, className: "text-muted-foreground" },
} as const;

function RunResult({ result }: { result: AutopilotRunResult }) {
  if (result.tone === "running") {
    return (
      <Shimmer as="span" className="text-sm">
        {result.text}
      </Shimmer>
    );
  }
  if (result.tone === "quiet") {
    return (
      <TruncateWithTooltip className="text-muted-foreground text-sm">
        {result.text}
      </TruncateWithTooltip>
    );
  }
  if (result.tone === "failed") {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <StatusBadge
          appearance={AUTOPILOT_RUN_STATUS_BADGES.failed.appearance}
          label={AUTOPILOT_RUN_STATUS_BADGES.failed.label}
        />
        <TruncateWithTooltip className="text-destructive text-sm font-medium">
          {result.text}
        </TruncateWithTooltip>
      </span>
    );
  }
  if (result.tone === "error") {
    return (
      <TruncateWithTooltip className="text-destructive text-sm font-medium">
        {result.text}
      </TruncateWithTooltip>
    );
  }
  const { icon, className } = RESULT_ICONS[result.tone];
  return (
    <span className="flex min-w-0 items-center gap-2">
      <HugeiconsIcon
        aria-hidden="true"
        className={cn("shrink-0", className)}
        icon={icon}
        size={15}
      />
      <TruncateWithTooltip className="text-sm">
        {result.text}
      </TruncateWithTooltip>
    </span>
  );
}

/** A leading @handle stands out: who asked is the first thing to read. */
function RunHeadline({ text }: { text: string }) {
  const mention = MENTION.exec(text);
  return (
    <TruncateWithTooltip className="text-sm font-medium" tooltip={text}>
      {mention ? (
        <>
          <span className="bg-primary/10 text-primary rounded-md px-1 py-px font-semibold">
            {mention[1]}
          </span>
          {mention[2]}
        </>
      ) : (
        text
      )}
    </TruncateWithTooltip>
  );
}

/** Recent Autopilot runs: what each was about and what it came to. */
export function AutopilotRunsTable({
  runs,
  onSelect,
}: AutopilotRunsTableProps) {
  const format = useFormatter();
  const now = new Date(useNow(runs.length > 0));
  const columns: TableColumn<AutopilotRunView>[] = [
    {
      key: "run",
      header: "Run",
      width: "1fr",
      minWidth: "12rem",
      cell: (run) => (
        <span className="flex min-w-0 items-center gap-3">
          <HugeiconsIcon
            aria-hidden="true"
            className="text-foreground/70 shrink-0"
            icon={AUTOPILOT_TRIGGER_ICONS[run.trigger]}
            size={20}
          />
          <span className="flex min-w-0 flex-col gap-0.5">
            <RunHeadline
              text={run.headline ?? AUTOPILOT_RUN_TRIGGER_LABELS[run.trigger]}
            />
            {run.headline ? (
              <span className="text-muted-foreground truncate text-xs">
                {AUTOPILOT_RUN_TRIGGER_LABELS[run.trigger]}
              </span>
            ) : null}
          </span>
        </span>
      ),
    },
    {
      key: "result",
      header: "Result",
      width: "1fr",
      minWidth: "10rem",
      cell: (run) => <RunResult result={describeRunResult(run)} />,
    },
    {
      key: "startedAt",
      header: "Started",
      width: "9.5rem",
      collapsePriority: 1,
      sortable: true,
      cell: (run) => (
        <time
          className="text-muted-foreground text-sm whitespace-nowrap tabular-nums"
          dateTime={new Date(run.startedAt).toISOString()}
          title={format.dateTime(new Date(run.startedAt), {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        >
          {format.relativeTime(
            new Date(run.startedAt),
            latest(now, run.startedAt)
          )}
        </time>
      ),
      sortValue: (run) => new Date(run.startedAt).getTime(),
    },
    {
      key: "duration",
      header: "Duration",
      width: "7rem",
      collapsePriority: 2,
      cell: (run) => (
        <span className="text-muted-foreground text-sm tabular-nums">
          {run.finishedAt
            ? formatDuration(
                new Date(run.finishedAt).getTime() -
                  new Date(run.startedAt).getTime()
              )
            : "–"}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={runs}
      defaultSort={{ key: "startedAt", direction: "desc" }}
      emptyState={
        <AutopilotTableEmpty
          description="Autopilot runs every morning before your brief. Run now starts one right away."
          icon={Clock01Icon}
          title="No runs yet"
        />
      }
      getRowId={(run) => run.id}
      height={
        runs.length > 0
          ? tableHeightFor(runs.length)
          : AUTOPILOT_EMPTY_TABLE_HEIGHT
      }
      onRowClick={onSelect}
      rowHeight={TABLE_ROW_HEIGHT}
    />
  );
}
