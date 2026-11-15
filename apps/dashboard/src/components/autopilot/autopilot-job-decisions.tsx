"use client";

import { WorkflowSquare03Icon } from "@hugeicons/core-free-icons";
import { TruncateWithTooltip } from "@notra/ui/components/shared/truncate-with-tooltip";
import { StatusBadge } from "@notra/ui/components/status-badge";
import { useQuery } from "@tanstack/react-query";
import { DataTable, type TableColumn } from "ui/table";
import { useFormatter } from "use-intl";

import { AutopilotTableEmpty } from "@/components/autopilot/autopilot-table-empty";
import {
  AUTOPILOT_FROM_PARAM,
  AUTOPILOT_NAV_LINK,
} from "@/constants/autopilot";
import {
  AUTOPILOT_AUTOMATION_SLUGS,
  AUTOPILOT_EMPTY_TABLE_HEIGHT,
  AUTOPILOT_JOB_DECISION_BADGES,
} from "@/constants/autopilot-ui";
import { TABLE_ROW_HEIGHT } from "@/constants/table";
import { useRouter } from "@/lib/navigation";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  AutopilotJobDecisionView,
  AutopilotJobDecisionsProps,
} from "@/types/autopilot";
import { tableHeightFor } from "@/utils/table";

/** What the automation came to in each recent run; a row opens that run. */
export function AutopilotJobDecisions({
  kind,
  organizationId,
  organizationSlug,
}: AutopilotJobDecisionsProps) {
  const format = useFormatter();
  const router = useRouter();
  const query = useQuery(
    dashboardOrpc.autopilot.jobDecisions.queryOptions({
      input: { organizationId, kind },
    })
  );
  const decisions = query.data ?? [];
  const shortDate = (value: Date) =>
    format.dateTime(new Date(value), {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  const columns: TableColumn<AutopilotJobDecisionView>[] = [
    {
      key: "createdAt",
      header: "Run",
      width: "8.5rem",
      cell: (decision) => (
        <span className="text-muted-foreground whitespace-nowrap tabular-nums">
          {shortDate(decision.createdAt)}
        </span>
      ),
    },
    {
      key: "level",
      header: "Outcome",
      width: "7rem",
      cell: (decision) => {
        const badge = AUTOPILOT_JOB_DECISION_BADGES[decision.level];
        return (
          <StatusBadge appearance={badge.appearance} label={badge.label} />
        );
      },
    },
    {
      key: "message",
      header: "Why",
      width: "1fr",
      minWidth: "14rem",
      cell: (decision) => (
        <TruncateWithTooltip className="text-sm">
          {decision.message}
        </TruncateWithTooltip>
      ),
    },
    {
      key: "runs",
      header: "Repeated",
      width: "10.5rem",
      collapsePriority: 1,
      cell: (decision) => (
        <span className="text-muted-foreground whitespace-nowrap tabular-nums">
          {decision.runs > 1
            ? `${decision.runs} runs since ${format.dateTime(new Date(decision.since), { month: "short", day: "numeric" })}`
            : null}
        </span>
      ),
    },
  ];

  return (
    <section aria-labelledby="automation-decisions" className="space-y-3">
      <h2 className="px-1 text-sm font-medium" id="automation-decisions">
        Recent decisions
      </h2>
      <DataTable
        columns={columns}
        data={decisions}
        emptyState={
          <AutopilotTableEmpty
            description="Each run's outcome for this automation shows up here."
            icon={WorkflowSquare03Icon}
            title="No runs yet"
          />
        }
        getRowId={(decision) => decision.id}
        height={
          decisions.length > 0
            ? tableHeightFor(decisions.length)
            : AUTOPILOT_EMPTY_TABLE_HEIGHT
        }
        loading={query.isPending}
        onRowClick={(decision) =>
          router.push(
            `/${organizationSlug}${AUTOPILOT_NAV_LINK}/runs/${decision.runId}?${AUTOPILOT_FROM_PARAM}=${AUTOPILOT_AUTOMATION_SLUGS[kind]}`
          )
        }
        rowHeight={TABLE_ROW_HEIGHT}
      />
    </section>
  );
}
