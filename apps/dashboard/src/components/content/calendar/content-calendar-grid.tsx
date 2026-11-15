"use client";

import { TooltipProvider } from "@notra/ui/components/ui/tooltip";
import { isSameMonth } from "date-fns";

import { ContentCalendarDay } from "@/components/content/calendar/content-calendar-day";
import { CONTENT_CALENDAR_TOOLTIP_DELAY_MS } from "@/constants/content-calendar";
import { useLocalDateFormat } from "@/lib/hooks/use-local-date-format";
import type { ContentCalendarGridProps } from "@/types/content/calendar";
import { calendarDayKey } from "@/utils/content-calendar";

export function ContentCalendarGrid({
  days,
  month,
  itemsByDay,
  organizationSlug,
  onDropPost,
}: ContentCalendarGridProps) {
  const formatDate = useLocalDateFormat();

  return (
    <TooltipProvider delay={CONTENT_CALENDAR_TOOLTIP_DELAY_MS}>
      <div className="border-shell-border bg-shell overflow-hidden rounded-t-2xl border border-b-0 pb-5">
        <div className="grid grid-cols-7">
          {days.slice(0, 7).map((day) => (
            <div
              className="text-muted-foreground px-3 py-2.5 text-sm font-medium"
              key={day.toISOString()}
            >
              {formatDate(day, { weekday: "short" })}
            </div>
          ))}
        </div>
      </div>
      <div className="border-table-card-border bg-table-card shadow-table-card relative -mt-5 overflow-hidden rounded-2xl border">
        <div className="bg-table-row-border grid grid-cols-7 gap-px">
          {days.map((day) => (
            <div className="bg-table-card" key={calendarDayKey(day)}>
              <ContentCalendarDay
                day={day}
                items={itemsByDay.get(calendarDayKey(day)) ?? []}
                onDropPost={onDropPost}
                organizationSlug={organizationSlug}
                outside={!isSameMonth(day, month)}
              />
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
