"use client";

import { Label } from "@notra/ui/components/ui/label";
import { useLocale, useTranslations } from "use-intl";

import { DateField } from "@/components/date-field";
import type { GeoShelfDueDateFieldProps } from "@/types/geo-shelf";
import { formatShelfDueDate, shelfDueDateToIso } from "@/utils/geo-shelf";

const DUE_DATE_POPOVER = {
  collisionAvoidance: { fallbackAxisSide: "none" },
  positionMethod: "fixed",
  side: "top",
} as const;

export function ShelfDueDateField({
  id,
  dueAt,
  disabled,
  onChange,
}: GeoShelfDueDateFieldProps) {
  const t = useTranslations("geo.shelf.shelfDueDateField");
  const locale = useLocale();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{t("due")}</Label>
      <DateField
        clearLabel={t("clearDueDate")}
        contentProps={DUE_DATE_POPOVER}
        disabled={disabled}
        display={dueAt ? formatShelfDueDate(dueAt, locale) : null}
        id={id}
        onClear={() => onChange(null)}
        onSelect={(date) => onChange(shelfDueDateToIso(date))}
        placeholder={t("pickDate")}
        selected={dueAt ? new Date(dueAt) : undefined}
      />
    </div>
  );
}
