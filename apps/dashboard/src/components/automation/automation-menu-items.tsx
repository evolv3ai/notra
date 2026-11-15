"use client";

import {
  Delete02Icon,
  Edit02Icon,
  PlayCircleIcon,
  SentIcon,
  Task01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ContextMenuItem,
  ContextMenuSeparator,
} from "@notra/ui/components/ui/context-menu";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@notra/ui/components/ui/dropdown-menu";
import { useTranslations } from "use-intl";

import type { AutomationMenuItemsProps } from "@/types/automation/automations";
import { rowEnabled } from "@/utils/automation-rows";

export function AutomationMenuItems({
  row,
  busy,
  variant,
  onEdit,
  onDelete,
  onRunNow,
  onSendTest,
  onViewRuns,
}: AutomationMenuItemsProps) {
  const t = useTranslations("automation.page");
  const tAlerts = useTranslations("automation.alerts");
  const tCommon = useTranslations("common");
  const Item = variant === "context" ? ContextMenuItem : DropdownMenuItem;
  const Separator =
    variant === "context" ? ContextMenuSeparator : DropdownMenuSeparator;

  return (
    <>
      <Item disabled={busy} onClick={() => onEdit(row)}>
        <HugeiconsIcon className="size-4" icon={Edit02Icon} />
        {tCommon("actions.edit")}
      </Item>
      <Item disabled={busy} onClick={() => onViewRuns(row)}>
        <HugeiconsIcon className="size-4" icon={Task01Icon} />
        {t("viewRuns")}
      </Item>
      {row.kind === "alert" ? (
        <Item disabled={busy} onClick={() => onSendTest(row)}>
          <HugeiconsIcon className="size-4" icon={SentIcon} />
          {tAlerts("dialog.sendTest")}
        </Item>
      ) : (
        <Item disabled={busy || !rowEnabled(row)} onClick={() => onRunNow(row)}>
          <HugeiconsIcon className="size-4" icon={PlayCircleIcon} />
          {tCommon("labels.runNow")}
        </Item>
      )}
      <Separator />
      <Item disabled={busy} onClick={() => onDelete(row)} variant="destructive">
        <HugeiconsIcon className="size-4" icon={Delete02Icon} />
        {tCommon("actions.delete")}
      </Item>
    </>
  );
}
