import type { SiteRecentBuild } from "@/types/sites";

export function formatSeconds(seconds: number): string {
  const roundedSeconds = Math.round(seconds);
  if (roundedSeconds < 60) {
    return `${roundedSeconds}s`;
  }
  return `${Math.floor(roundedSeconds / 60)}m ${roundedSeconds % 60}s`;
}

const DAY_FORMAT = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** `2026-10-04` → `Oct 4`. Days are UTC, so format them in UTC too. */
export function formatChartDay(day: string): string {
  return DAY_FORMAT.format(new Date(`${day.slice(0, 10)}T00:00:00Z`));
}

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatChartDateTime(date: Date | string): string {
  return DATE_TIME_FORMAT.format(new Date(date));
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

/** Median duration of the successful builds, or null when there are none. */
export function medianBuildMs(builds: SiteRecentBuild[]): number | null {
  return median(
    builds
      .filter((build) => build.status === "ready")
      .map((build) => build.durationMs)
  );
}
