"use client";

import { Clock01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CUSTOM_SCHEDULE_MAX_INTERVAL_DAYS,
  CUSTOM_SCHEDULE_MIN_INTERVAL_DAYS,
} from "@notra/ai/constants/schedule-interval";
import { CRON_FREQUENCIES } from "@notra/schemas/dashboard/integrations";
import { NumberField } from "@notra/ui/components/ui/number-field";
import { useSyncExternalStore } from "react";
import { useFormatter, useTranslations } from "use-intl";

import { PickerSelect } from "@/components/automation/editor/editor-parts";
import { TimeField } from "@/components/time-field";
import { DAY_MS } from "@/constants/analytics-weekdays";
import {
  DAYS_OF_MONTH,
  DAYS_OF_WEEK,
  WEEKDAY_REFERENCE_SUNDAY_UTC,
} from "@/constants/schedule";
import { useScheduleSummary } from "@/lib/hooks/use-schedule-summary";
import type { ScheduleTriggerRowProps } from "@/types/automation/schedule";
import { formatTimeValue, parseTimeValue } from "@/utils/schedule-form";
import { computeNextRun, getLocalTimezone } from "@/utils/schedule-summary";

const NOW_REFRESH_INTERVAL_MS = 60_000;
const nowListeners = new Set<() => void>();
let nowIntervalId: ReturnType<typeof setInterval> | null = null;
let currentNow: Date | null = null;

function subscribeToNow(listener: () => void) {
  nowListeners.add(listener);
  if (nowIntervalId === null) {
    currentNow = new Date();
    nowIntervalId = setInterval(() => {
      currentNow = new Date();
      for (const notify of nowListeners) {
        notify();
      }
    }, NOW_REFRESH_INTERVAL_MS);
  }
  return () => {
    nowListeners.delete(listener);
    if (nowListeners.size === 0 && nowIntervalId !== null) {
      clearInterval(nowIntervalId);
      nowIntervalId = null;
    }
  };
}

const getNowSnapshot = () => currentNow;
const getServerNowSnapshot = () => null;

/** Months shorter than the picked day skip that run; say so for 29–31. */
function skipNoteKey(day: number) {
  if (day === 31) {
    return "day31";
  }
  if (day === 30) {
    return "day30";
  }
  return day === 29 ? "day29" : null;
}

/** "Every Monday at 09:00 UTC · Next run …" as one editable line. */
export function ScheduleTriggerRow({
  schedule,
  onFrequencyChange,
  onDayOfWeekChange,
  onDayOfMonthChange,
  onIntervalDaysChange,
  onTimeChange,
}: ScheduleTriggerRowProps) {
  const t = useTranslations("automation.schedules");
  const tLabels = useTranslations("common.labels");
  const format = useFormatter();
  const { relative, nextRunDate } = useScheduleSummary();
  const now = useSyncExternalStore(
    subscribeToNow,
    getNowSnapshot,
    getServerNowSnapshot
  );
  const { frequency, hour, minute, dayOfWeek, dayOfMonth, intervalDays } =
    schedule;
  const nextRun = now ? computeNextRun(schedule, now) : null;
  const skipNote =
    frequency === "monthly" ? skipNoteKey(dayOfMonth ?? 1) : null;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
        <HugeiconsIcon
          className="text-muted-foreground size-4 shrink-0"
          icon={Clock01Icon}
        />
        <PickerSelect
          ariaLabel={t("row.frequency")}
          onChange={(value) =>
            onFrequencyChange(
              value as ScheduleTriggerRowProps["schedule"]["frequency"]
            )
          }
          options={CRON_FREQUENCIES.map((option) => ({
            value: option,
            label: tLabels(option),
          }))}
          value={frequency}
        />
        {frequency === "weekly" ? (
          <>
            <span className="text-muted-foreground">{t("row.on")}</span>
            <PickerSelect
              ariaLabel={t("dayPicker.dayOfWeek")}
              onChange={(value) => onDayOfWeekChange(Number(value))}
              options={DAYS_OF_WEEK.map((day) => ({
                value: String(day),
                label: format.dateTime(
                  new Date(WEEKDAY_REFERENCE_SUNDAY_UTC + day * DAY_MS),
                  { weekday: "long", timeZone: "UTC" }
                ),
              }))}
              value={String(dayOfWeek ?? 1)}
            />
          </>
        ) : null}
        {frequency === "monthly" ? (
          <>
            <span className="text-muted-foreground">{t("row.on")}</span>
            <PickerSelect
              ariaLabel={t("dayPicker.dayOfMonth")}
              onChange={(value) => onDayOfMonthChange(Number(value))}
              options={DAYS_OF_MONTH.map((day) => ({
                value: String(day),
                label: t("dayPicker.dayOption", { day }),
              }))}
              value={String(dayOfMonth ?? 1)}
            />
          </>
        ) : null}
        {frequency === "custom" ? (
          <>
            <span className="text-muted-foreground">{t("row.every")}</span>
            <NumberField
              aria-label={t("interval.repeatEvery")}
              decrementLabel={t("interval.fewer")}
              incrementLabel={t("interval.more")}
              max={CUSTOM_SCHEDULE_MAX_INTERVAL_DAYS}
              min={CUSTOM_SCHEDULE_MIN_INTERVAL_DAYS}
              onValueChange={(value) =>
                onIntervalDaysChange(value ?? undefined)
              }
              value={intervalDays ?? null}
            />
            <span className="text-muted-foreground">{t("interval.days")}</span>
          </>
        ) : null}
        <label className="text-muted-foreground" htmlFor="schedule-time">
          {t("row.at")}
        </label>
        <TimeField
          className="h-8 w-24 sm:w-24"
          id="schedule-time"
          onChange={(value) => {
            const parsed = parseTimeValue(value);
            if (parsed) {
              onTimeChange(parsed.hour, parsed.minute);
            }
          }}
          value={formatTimeValue(hour, minute)}
        />
        <span className="text-muted-foreground">UTC</span>
      </div>
      {/* Own line, so it sits in the same place for every frequency instead
          of wrapping whenever the controls above get wider. */}
      {nextRun && now ? (
        <p className="text-muted-foreground pl-6 text-xs">
          {t("summary.nextRun", {
            date: nextRunDate(nextRun),
            relative: relative(nextRun, now),
          })}{" "}
          <span className="text-muted-foreground/70">
            · {getLocalTimezone()}
          </span>
        </p>
      ) : null}
      {skipNote ? (
        <p className="text-muted-foreground pl-6 text-xs">
          {t(`dayPicker.skipNotes.${skipNote}`)}
        </p>
      ) : null}
    </div>
  );
}
