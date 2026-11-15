"use client";

import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { TruncateWithTooltip } from "@notra/ui/components/shared/truncate-with-tooltip";
import { StatusBadge } from "@notra/ui/components/status-badge";
import type { ReactNode } from "react";
import { InfiniteDataTable, type TableColumn } from "ui/table";
import { useFormatter, useNow, useTranslations } from "use-intl";

import Link from "@/components/framework/link";
import { AUTOMATION_RUN_STATUS_BADGES } from "@/constants/automation-runs";
import {
  AUTOMATION_EMPTY_TABLE_HEIGHT,
  TABLE_ROW_HEIGHT,
} from "@/constants/table";
import type { AutomationRun } from "@/types/automation/runs";
import { formatGeoRunDuration } from "@/utils/geo-scan-activity";
import { latest } from "@/utils/latest-date";
import { tableHeightFor } from "@/utils/table";

interface AutomationRunsTableProps {
  runs: AutomationRun[];
  organizationSlug: string;
  emptyState: ReactNode;
  /** Names by automation ID; omit to hide the automation column. */
  automationNames?: Map<string, string>;
  /** Loads the next page; omit when there is none. */
  onLoadMore?: () => void;
  loadingMore?: boolean;
}

export function AutomationRunsTable({
  runs,
  organizationSlug,
  emptyState,
  automationNames,
  onLoadMore,
  loadingMore = false,
}: AutomationRunsTableProps) {
  const t = useTranslations("automation.runs");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });

  const columns: TableColumn<AutomationRun>[] = [
    ...(automationNames
      ? [
          {
            key: "automation",
            header: t("columns.automation"),
            width: "14rem",
            cell: (run: AutomationRun) => (
              <Link
                className="hover:text-foreground block min-w-0 text-sm font-medium"
                href={`/${organizationSlug}/automation/${run.automationId}`}
              >
                <TruncateWithTooltip>
                  {automationNames.get(run.automationId) ??
                    t("deletedAutomation")}
                </TruncateWithTooltip>
              </Link>
            ),
          },
        ]
      : []),
    {
      key: "result",
      header: t("columns.result"),
      width: "1fr",
      minWidth: "12rem",
      cell: (run) => (
        <div className="min-w-0">
          <TruncateWithTooltip className="text-sm">
            {run.title ?? t(`results.${run.status}`)}
          </TruncateWithTooltip>
          {run.errorMessage ? (
            <TruncateWithTooltip className="text-muted-foreground text-xs">
              {run.errorMessage}
            </TruncateWithTooltip>
          ) : null}
        </div>
      ),
    },
    {
      key: "status",
      header: t("columns.status"),
      width: "8rem",
      cell: (run) => (
        <StatusBadge
          appearance={AUTOMATION_RUN_STATUS_BADGES[run.status]}
          label={t(`statuses.${run.status}`)}
        />
      ),
    },
    {
      key: "when",
      header: t("columns.when"),
      width: "8rem",
      align: "right",
      cell: (run) => (
        <div className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
          <time
            dateTime={run.createdAt}
            title={format.dateTime(new Date(run.createdAt), {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          >
            {format.relativeTime(
              new Date(run.createdAt),
              latest(now, run.createdAt)
            )}
          </time>
          {run.manual ? (
            <div className="text-muted-foreground/70">{t("manual")}</div>
          ) : null}
        </div>
      ),
    },
    {
      key: "duration",
      header: t("columns.duration"),
      width: "6rem",
      align: "right",
      cell: (run) =>
        run.finishedAt ? (
          <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
            {formatGeoRunDuration(run.createdAt, run.finishedAt, now.getTime())}
          </span>
        ) : null,
    },
    {
      key: "open",
      header: "",
      width: "7.5rem",
      align: "right",
      cell: (run) =>
        run.postId ? (
          <Link
            className="text-muted-foreground hover:text-foreground duration-fast inline-flex items-center gap-1 text-xs transition-colors"
            href={`/${organizationSlug}/content/${run.postId}`}
          >
            {t("openDraft")}
            <HugeiconsIcon className="size-3.5" icon={ArrowUpRight01Icon} />
          </Link>
        ) : null,
    },
  ];

  return (
    <InfiniteDataTable
      columns={columns}
      data={runs}
      emptyState={emptyState}
      getRowId={(run) => run.id}
      height={
        runs.length === 0
          ? AUTOMATION_EMPTY_TABLE_HEIGHT
          : tableHeightFor(runs.length, TABLE_ROW_HEIGHT)
      }
      loadingMore={loadingMore}
      onEndReached={loadingMore ? undefined : onLoadMore}
      rowHeight={TABLE_ROW_HEIGHT}
    />
  );
}
