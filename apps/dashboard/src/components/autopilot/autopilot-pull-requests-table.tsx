"use client";

import {
  GitPullRequestIcon,
  Idea01Icon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { TruncateWithTooltip } from "@notra/ui/components/shared/truncate-with-tooltip";
import { StatusBadge } from "@notra/ui/components/status-badge";
import { DataTable, type TableColumn } from "ui/table";
import { useFormatter } from "use-intl";

import { AutopilotFindingStatus } from "@/components/autopilot/autopilot-finding-status";
import { AutopilotMergeMenu } from "@/components/autopilot/autopilot-merge-menu";
import { AutopilotTableEmpty } from "@/components/autopilot/autopilot-table-empty";
import { Button } from "@/components/button";
import { AUTOPILOT_FINDING_STATUS_BADGES } from "@/constants/autopilot";
import {
  AUTOPILOT_EMPTY_TABLE_HEIGHT,
  AUTOPILOT_FINDING_ICONS,
  AUTOPILOT_KIND_META,
} from "@/constants/autopilot-ui";
import { TABLE_ROW_HEIGHT } from "@/constants/table";
import { cn } from "@/lib/utils";
import type {
  AutopilotFindingView,
  AutopilotPullRequestsTableProps,
} from "@/types/autopilot";
import { findingDisplayTitle } from "@/utils/autopilot-findings";
import { tableHeightFor } from "@/utils/table";

/** Ideas written later open their pull request days after the finding. */
const openedAt = (finding: AutopilotFindingView) =>
  new Date(finding.openedAt ?? finding.createdAt);

/**
 * Every pull request Autopilot opened or is writing, or (`view="ideas"`) the
 * ideas waiting for one, newest first. A row opens the page that explains it.
 */
export function AutopilotPullRequestsTable({
  findings,
  view = "pull-requests",
  readOnly,
  showAutomation = true,
  writingId,
  onOpen,
  mergingId,
  onMerge,
  onWrite,
}: AutopilotPullRequestsTableProps) {
  const format = useFormatter();
  const automationColumn: TableColumn<AutopilotFindingView> = {
    key: "kind",
    header: "Automation",
    width: "9rem",
    collapsePriority: 4,
    cell: (finding) => (
      <span className="text-muted-foreground truncate">
        {AUTOPILOT_KIND_META[finding.kind].label}
      </span>
    ),
  };
  const columns: TableColumn<AutopilotFindingView>[] = [
    {
      key: "title",
      header: "Title",
      width: "1fr",
      minWidth: "14rem",
      cell: (finding) => {
        const { icon, className } = AUTOPILOT_FINDING_ICONS[finding.status];
        return (
          <span className="flex min-w-0 items-center gap-2.5">
            <HugeiconsIcon
              aria-hidden="true"
              className={cn("shrink-0", className)}
              icon={icon}
              size={16}
              strokeWidth={1.75}
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <TruncateWithTooltip className="text-sm font-medium">
                {findingDisplayTitle(finding)}
              </TruncateWithTooltip>
              {finding.status === "failed" && finding.errorMessage ? (
                <TruncateWithTooltip className="text-destructive text-xs">
                  {finding.errorMessage}
                </TruncateWithTooltip>
              ) : null}
            </span>
          </span>
        );
      },
    },
    {
      key: "openedAt",
      header: view === "ideas" ? "Found" : "Date",
      width: "7rem",
      sortable: true,
      collapsePriority: 1,
      cell: (finding) => (
        <span className="text-muted-foreground whitespace-nowrap tabular-nums">
          {format.dateTime(openedAt(finding), {
            month: "short",
            day: "numeric",
          })}
        </span>
      ),
      sortValue: (finding) => openedAt(finding).getTime(),
    },
    view === "ideas"
      ? {
          key: "ideaStatus",
          header: "Status",
          width: "9.5rem",
          collapsePriority: 2,
          cell: (finding) => {
            if (finding.status !== "suggested") {
              return (
                <StatusBadge
                  appearance={AUTOPILOT_FINDING_STATUS_BADGES.open.appearance}
                  label={AUTOPILOT_FINDING_STATUS_BADGES.open.label}
                />
              );
            }
            return (
              <StatusBadge
                appearance={
                  AUTOPILOT_FINDING_STATUS_BADGES.suggested.appearance
                }
                label="Waiting for you"
              />
            );
          },
        }
      : {
          key: "status",
          header: "Status",
          width: "8rem",
          cell: (finding) => <AutopilotFindingStatus finding={finding} />,
        },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      width: "8.5rem",
      align: "right",
      cell: (finding) => {
        const actionable =
          !readOnly &&
          writingId !== finding.id &&
          (finding.status === "proposed" || finding.status === "suggested");
        if (!actionable) {
          return null;
        }
        // Closing lives on the row's page, where there is room for a why.
        return (
          <span className="flex items-center justify-end">
            {finding.status === "proposed" ? (
              <AutopilotMergeMenu
                loading={mergingId === finding.id}
                onMerge={(method) => onMerge(finding, method)}
              />
            ) : onWrite ? (
              <Button
                onClick={() => onWrite(finding)}
                size="xs"
                variant="outline"
              >
                <HugeiconsIcon icon={PencilEdit02Icon} size={14} />
                Open PR
              </Button>
            ) : null}
          </span>
        );
      },
    },
  ];
  if (showAutomation) {
    columns.splice(1, 0, automationColumn);
  }

  return (
    <DataTable
      columns={columns}
      data={findings}
      defaultSort={{ key: "openedAt", direction: "desc" }}
      emptyState={
        view === "ideas" ? (
          <AutopilotTableEmpty
            description="Posts Autopilot won't open on its own land here. They wait until you write one."
            icon={Idea01Icon}
            title="No ideas waiting"
          />
        ) : (
          <AutopilotTableEmpty
            description="Autopilot opens one when it finds something worth writing about or fixing on your site."
            icon={GitPullRequestIcon}
            title="No pull requests yet"
          />
        )
      }
      getRowId={(finding) => finding.id}
      height={
        findings.length > 0
          ? tableHeightFor(findings.length)
          : AUTOPILOT_EMPTY_TABLE_HEIGHT
      }
      onRowClick={onOpen}
      rowHeight={TABLE_ROW_HEIGHT}
    />
  );
}
