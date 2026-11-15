/** "45 min", "5.2 h" or "3.1 d"; long waits read better in days. */
export function formatHoursToMerge(hours: number | null) {
  if (hours === null) {
    return null;
  }
  if (hours < 1) {
    return `${Math.max(1, Math.round(hours * 60))} min`;
  }
  if (hours < 48) {
    return `${Math.round(hours * 10) / 10} h`;
  }
  return `${Math.round((hours / 24) * 10) / 10} d`;
}

/** "42s" or "4m 12s". */
export function formatRunDuration(seconds: number | null) {
  if (seconds === null) {
    return null;
  }
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}

export function formatShare(share: number | null) {
  return share === null ? null : `${Math.round(share * 100)}%`;
}

export function shareOf(part: number, total: number) {
  return total === 0 ? null : part / total;
}

/** Each day's counts plus every day before it. */
export function runningTotals(
  series: { day: string; opened: number; merged: number }[]
) {
  return series.reduce<{ day: string; opened: number; merged: number }[]>(
    (rows, point) => {
      const last = rows.at(-1);
      rows.push({
        day: point.day,
        opened: (last?.opened ?? 0) + point.opened,
        merged: (last?.merged ?? 0) + point.merged,
      });
      return rows;
    },
    []
  );
}
