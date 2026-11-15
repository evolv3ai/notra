import type { ContentHistoryEntry } from "@notra/schemas/types/dashboard/content-history";

import type { ContentHistoryDay } from "@/types/content/history";

const DAY_MS = 86_400_000;

/** Days are grouped in the browser's zone, so labels and times must use it too (the intl provider is UTC). */
export const LOCAL_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function localDayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Groups versions (newest first) by local calendar day. */
export function groupContentHistoryByDay(
  items: ContentHistoryEntry[],
  now = new Date()
): ContentHistoryDay[] {
  const today = localDayStart(now).getTime();
  const days: ContentHistoryDay[] = [];
  for (const item of items) {
    const start = localDayStart(new Date(item.createdAt));
    const key = start.toISOString();
    const last = days.at(-1);
    if (last?.key === key) {
      last.items.push(item);
      continue;
    }
    const daysAgo = Math.round((today - start.getTime()) / DAY_MS);
    days.push({ key, date: start, daysAgo, items: [item] });
  }
  return days;
}
