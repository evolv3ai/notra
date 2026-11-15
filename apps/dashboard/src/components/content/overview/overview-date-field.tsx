"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "use-intl";

import { DateField } from "@/components/date-field";
import type { OverviewDateFieldProps } from "@/types/content/overview";
import {
  displayDateToLocalDate,
  localDateToDisplayDate,
} from "@/utils/content-metadata";

export function OverviewDateField({
  id,
  value,
  fallback,
  onChange,
}: OverviewDateFieldProps) {
  const t = useTranslations("content.overview.date");
  const locale = useLocale();
  const day = value ?? fallback;
  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }),
    [locale]
  );

  return (
    <DateField
      clearLabel={t("reset")}
      display={formatter.format(new Date(`${day}T00:00:00.000Z`))}
      id={id}
      onClear={value ? () => onChange(null) : undefined}
      onSelect={(date) => onChange(localDateToDisplayDate(date))}
      placeholder={t("auto")}
      selected={displayDateToLocalDate(day)}
      trailing={value ? null : t("auto")}
    />
  );
}
