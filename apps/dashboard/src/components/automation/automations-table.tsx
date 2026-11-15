"use client";

import {
  AiBrowserIcon,
  Clock01Icon,
  GithubIcon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { CUSTOM_SCHEDULE_DEFAULT_INTERVAL_DAYS } from "@notra/ai/constants/schedule-interval";
import { GEO_ALERT_DEFAULT_THRESHOLDS } from "@notra/schemas/dashboard/automation/geo-alerts";
import { TruncateWithTooltip } from "@notra/ui/components/shared/truncate-with-tooltip";
import { Badge } from "@notra/ui/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { Spinner } from "@notra/ui/components/ui/spinner";
import { Switch } from "@notra/ui/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { cn } from "@notra/ui/lib/utils";
import { DataTable, type TableColumn } from "ui/table";
import { useFormatter, useNow, useTranslations } from "use-intl";

import { AutomationActionIcon } from "@/components/automation/action-icon";
import { AutomationMenuItems } from "@/components/automation/automation-menu-items";
import { Button } from "@/components/button";
import {
  AUTOMATION_EMPTY_TABLE_HEIGHT,
  TABLE_ROW_HEIGHT,
} from "@/constants/table";
import { useAutomationRowName } from "@/lib/hooks/use-automation-row-name";
import { useOutputTypeLabel } from "@/lib/hooks/use-output-type-label";
import { useScheduleFrequencyLabel } from "@/lib/hooks/use-schedule-frequency-label";
import type {
  AutomationRow,
  AutomationsTableProps,
} from "@/types/automation/automations";
import { rowEnabled } from "@/utils/automation-rows";
import { latest } from "@/utils/latest-date";
import { OutputTypeIcon } from "@/utils/output-types";
import { tableHeightFor } from "@/utils/table";

const KIND_ICONS: Record<AutomationRow["kind"], IconSvgElement> = {
  alert: AiBrowserIcon,
  schedule: Clock01Icon,
  event: GithubIcon,
};

export function AutomationsTable({
  rows,
  busyId,
  emptyState,
  onEdit,
  onToggle,
  onDelete,
  onRunNow,
  onSendTest,
  onViewRuns,
  lastRuns,
}: AutomationsTableProps) {
  const t = useTranslations("automation.page");
  const tAlerts = useTranslations("automation.alerts");
  const tEvents = useTranslations("automation.events.page");
  const tCommon = useTranslations("common");
  const tFrequency = useTranslations("automation.schedules.frequencyShort");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const formatFrequency = useScheduleFrequencyLabel();
  const outputTypeLabel = useOutputTypeLabel();
  const nameOf = useAutomationRowName();

  // Paused rows stay readable but step back; the switch and menu keep full
  // contrast so they still read as the way to turn the row back on.
  const pausedClass = (row: AutomationRow) =>
    rowEnabled(row) ? undefined : "opacity-50";

  const triggerSummary = (
    row: AutomationRow
  ): { icon: IconSvgElement; label: string; detail?: string } => {
    if (row.kind === "schedule") {
      const { cron } = row.trigger.sourceConfig;
      return {
        icon: Clock01Icon,
        label: cron
          ? tFrequency(cron.frequency, {
              days: cron.intervalDays ?? CUSTOM_SCHEDULE_DEFAULT_INTERVAL_DAYS,
            })
          : tFrequency("notSet"),
        detail: cron ? formatFrequency(cron) : undefined,
      };
    }
    if (row.kind === "event") {
      const events = row.trigger.sourceConfig.eventTypes ?? [];
      return {
        icon: GithubIcon,
        label: t("onGithub", {
          events: events
            .map((event) =>
              event === "release"
                ? tCommon("labels.release")
                : tEvents("eventNames.push")
            )
            .join(", "),
        }),
      };
    }
    const { signal, threshold } = row.alert.sourceConfig;
    const value = threshold ?? GEO_ALERT_DEFAULT_THRESHOLDS[signal];
    return {
      icon: AiBrowserIcon,
      label:
        value === undefined
          ? tAlerts(`signals.${signal}.short`)
          : tAlerts(`signals.${signal}.shortWithValue`, { value }),
    };
  };

  const columns: TableColumn<AutomationRow>[] = [
    {
      key: "name",
      header: t("columns.automation"),
      width: "1fr",
      minWidth: "12rem",
      cell: (row) => (
        <button
          className={cn(
            "flex min-w-0 cursor-pointer items-center gap-2.5 text-left outline-none focus-visible:underline",
            pausedClass(row)
          )}
          onClick={() => onEdit(row)}
          type="button"
        >
          <HugeiconsIcon
            className="text-muted-foreground size-4 shrink-0"
            icon={KIND_ICONS[row.kind]}
          />
          <TruncateWithTooltip className="text-sm font-medium">
            {nameOf(row)}
          </TruncateWithTooltip>
        </button>
      ),
    },
    {
      key: "trigger",
      header: t("columns.trigger"),
      width: "14rem",
      cell: (row) => {
        const { icon, label, detail } = triggerSummary(row);
        const badge = (
          <Badge
            className="max-w-full"
            shape="rounded"
            size="md"
            variant="secondary"
          >
            <HugeiconsIcon icon={icon} />
            <span className="truncate">{label}</span>
          </Badge>
        );
        return (
          <span className={cn("flex min-w-0", pausedClass(row))}>
            {detail ? (
              <Tooltip>
                <TooltipTrigger render={badge} />
                <TooltipContent>{detail}</TooltipContent>
              </Tooltip>
            ) : (
              badge
            )}
          </span>
        );
      },
    },
    {
      key: "lastRun",
      header: t("columns.lastRun"),
      width: "9.5rem",
      cell: (row) => {
        const lastRun = lastRuns.get(row.id);
        return lastRun ? (
          <span
            className={cn(
              "text-muted-foreground text-sm whitespace-nowrap tabular-nums",
              pausedClass(row)
            )}
          >
            {format.relativeTime(new Date(lastRun), latest(now, lastRun))}
          </span>
        ) : (
          <span className="text-muted-foreground/60 text-sm">—</span>
        );
      },
    },
    {
      key: "action",
      header: t("columns.action"),
      width: "11rem",
      cell: (row) => {
        if (row.kind !== "alert") {
          return (
            <span className={cn("flex min-w-0", pausedClass(row))}>
              <Badge shape="rounded" size="md" variant="secondary">
                <OutputTypeIcon outputType={row.trigger.outputType} />
                {outputTypeLabel(row.trigger.outputType)}
              </Badge>
            </span>
          );
        }
        const actions = (["slack", "email", "webhook"] as const).filter(
          (key) => row.alert.actions[key]
        );
        // Several destinations don't fit as labelled badges, so they go
        // icon-only with the name kept for hover and screen readers.
        const compact = actions.length > 1;
        return (
          <span className={cn("flex items-center gap-1", pausedClass(row))}>
            {actions.map((key) => {
              const label = tAlerts(`actionLabels.${key}`);
              return (
                <Badge
                  key={key}
                  shape="rounded"
                  size="md"
                  title={compact ? label : undefined}
                  variant="secondary"
                >
                  <AutomationActionIcon kind={key} />
                  {compact ? <span className="sr-only">{label}</span> : label}
                </Badge>
              );
            })}
          </span>
        );
      },
    },
    {
      key: "enabled",
      header: t("columns.enabled"),
      width: "5.5rem",
      cell: (row) => (
        <Switch
          aria-label={t("toggle", { name: nameOf(row) })}
          checked={rowEnabled(row)}
          disabled={busyId === row.id}
          onCheckedChange={(enabled) => onToggle(row, enabled)}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "3rem",
      minWidth: "3rem",
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label={tCommon("labels.actionsForName", {
                  name: nameOf(row),
                })}
                disabled={busyId === row.id}
                size="icon"
                variant="ghost"
              >
                {busyId === row.id ? (
                  <Spinner />
                ) : (
                  <HugeiconsIcon
                    className="text-muted-foreground size-4"
                    icon={MoreVerticalIcon}
                  />
                )}
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <AutomationMenuItems
              row={row}
              busy={busyId === row.id}
              variant="dropdown"
              onEdit={onEdit}
              onDelete={onDelete}
              onRunNow={onRunNow}
              onSendTest={onSendTest}
              onViewRuns={onViewRuns}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyState={emptyState}
      getRowId={(row) => row.id}
      onRowClick={onEdit}
      renderRowContextMenu={(row) => (
        <AutomationMenuItems
          row={row}
          busy={busyId === row.id}
          variant="context"
          onEdit={onEdit}
          onDelete={onDelete}
          onRunNow={onRunNow}
          onSendTest={onSendTest}
          onViewRuns={onViewRuns}
        />
      )}
      // The name button already opens the row from the keyboard.
      rowKeyboardActivation={false}
      height={
        rows.length === 0
          ? AUTOMATION_EMPTY_TABLE_HEIGHT
          : tableHeightFor(rows.length, TABLE_ROW_HEIGHT)
      }
      rowHeight={TABLE_ROW_HEIGHT}
    />
  );
}
