"use client";

import { Label } from "@notra/ui/components/ui/label";
import { useId } from "react";
import { useTranslations } from "use-intl";

import { DateField } from "@/components/date-field";
import { TimeField } from "@/components/time-field";
import { useLocalDateFormat } from "@/lib/hooks/use-local-date-format";
import type { ScheduleSlotFieldProps } from "@/types/content/schedule";

export function ScheduleSlotField({
  date,
  earliestDate,
  time,
  inPast,
  timeZone,
  onDateChange,
  onTimeChange,
}: ScheduleSlotFieldProps) {
  const t = useTranslations("content.calendar.schedule");
  const formatDate = useLocalDateFormat();
  const dateId = useId();
  const dateLabelId = useId();
  const timeId = useId();

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium">{t("when")}</h3>
        <span className="text-muted-foreground text-xs">{timeZone}</span>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col">
          <Label className="sr-only" id={dateLabelId}>
            {t("date")}
          </Label>
          <DateField
            aria-labelledby={`${dateLabelId} ${dateId}`}
            disabledDays={{ before: earliestDate }}
            display={
              date
                ? formatDate(date, {
                    weekday: "short",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : null
            }
            id={dateId}
            onSelect={onDateChange}
            placeholder={t("pickDate")}
            selected={date}
          />
        </div>
        <div>
          <Label className="sr-only" htmlFor={timeId}>
            {t("time")}
          </Label>
          <TimeField
            className="sm:w-32"
            id={timeId}
            onChange={onTimeChange}
            required
            value={time}
          />
        </div>
      </div>
      {inPast ? (
        <p className="text-destructive text-xs" role="alert">
          {t("inPast")}
        </p>
      ) : null}
    </section>
  );
}
