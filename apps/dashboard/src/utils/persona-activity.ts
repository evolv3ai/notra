import type {
  GeoPersona,
  GeoPersonaActivityPoint,
  GeoPersonaActivityResponse,
} from "@notra/geo-core/types/geo-personas";

import {
  GEO_PERSONA_CHART_MAX_STEP,
  GEO_PERSONA_CHART_MIN_MAX,
  GEO_PERSONA_ROLLING_DAYS,
} from "@/constants/geo-personas";
import type { PersonaActivitySeries } from "@/types/geo-personas";
import { chartKey } from "@/utils/chart-keys";

function activityPointKey(
  day: string,
  personaId: string,
  snapshotVersion: string
) {
  return `${day}:${personaId}:${snapshotVersion}`;
}

function personaActivityKey(personaId: string, snapshotVersion: string) {
  return chartKey(`${personaId}:${snapshotVersion}`);
}

export function buildPersonaActivitySeries(
  activity: GeoPersonaActivityResponse,
  personas: readonly GeoPersona[]
): PersonaActivitySeries[] {
  const latestChecks = new Map<string, Map<string, string>>();
  for (const point of activity.points) {
    const versions = latestChecks.get(point.personaId) ?? new Map();
    const current = versions.get(point.snapshotVersion);
    if (!current || point.lastCheckedAt > current) {
      versions.set(point.snapshotVersion, point.lastCheckedAt);
    }
    latestChecks.set(point.personaId, versions);
  }

  return personas.flatMap((persona) => {
    const versions = [...(latestChecks.get(persona.id)?.entries() ?? [])].sort(
      ([leftVersion, leftCheckedAt], [rightVersion, rightCheckedAt]) =>
        rightCheckedAt.localeCompare(leftCheckedAt) ||
        leftVersion.localeCompare(rightVersion)
    );
    return versions.map(([snapshotVersion], index) => ({
      personaId: persona.id,
      snapshotVersion,
      dataKey: personaActivityKey(persona.id, snapshotVersion),
      label:
        index === 0
          ? persona.name
          : `${persona.name} (previous · ${snapshotVersion.slice(0, 7)})`,
      isCurrent: index === 0,
    }));
  });
}

function addDays(day: string, amount: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function activityDays(from: string, to: string) {
  const days: string[] = [];
  for (let day = from; day < to; day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

/**
 * Start of the fetch window: the selected range plus the days before it that
 * the first day's rolling rate needs.
 */
export function personaActivityFetchFrom(from: string) {
  return addDays(from, -(GEO_PERSONA_ROLLING_DAYS - 1));
}

/** Narrows a response fetched from `personaActivityFetchFrom` back to the selected range. */
export function personaActivityWithin(
  activity: GeoPersonaActivityResponse,
  from: string
): GeoPersonaActivityResponse {
  return {
    ...activity,
    from,
    points: activity.points.filter((point) => point.day >= from),
  };
}

/**
 * One row per selected day with each series' mention rate over the last
 * `GEO_PERSONA_ROLLING_DAYS` days. A day holds only a few checks per persona,
 * so the daily rate jumps between 0% and 50% and hides the actual trend.
 * `activity` starts `GEO_PERSONA_ROLLING_DAYS - 1` days before `from`, so the
 * first day has a full window. Days without checks stay null.
 */
export function buildPersonaActivityRows(
  activity: GeoPersonaActivityResponse,
  series: readonly PersonaActivitySeries[],
  from: string
) {
  const points = new Map(
    activity.points.map((point) => [
      activityPointKey(point.day, point.personaId, point.snapshotVersion),
      point,
    ])
  );
  const days = activityDays(activity.from, activity.to);
  const rows: Record<string, string | number | null>[] = [];
  const rowsByDay = new Map<string, Record<string, string | number | null>>();
  for (const day of days) {
    if (day >= from) {
      const row = { day };
      rows.push(row);
      rowsByDay.set(day, row);
    }
  }
  for (const item of series) {
    let checks = 0;
    let mentions = 0;
    for (const [index, day] of days.entries()) {
      const entering = points.get(
        activityPointKey(day, item.personaId, item.snapshotVersion)
      );
      checks += entering?.checks ?? 0;
      mentions += entering?.mentions ?? 0;
      const leavingDay = days[index - GEO_PERSONA_ROLLING_DAYS];
      if (leavingDay) {
        const leaving = points.get(
          activityPointKey(leavingDay, item.personaId, item.snapshotVersion)
        );
        checks -= leaving?.checks ?? 0;
        mentions -= leaving?.mentions ?? 0;
      }
      const row = rowsByDay.get(day);
      if (row) {
        row[item.dataKey] =
          entering && entering.checks > 0 && checks > 0
            ? (mentions / checks) * 100
            : null;
      }
    }
  }
  return rows;
}

function rateBetween(
  activity: GeoPersonaActivityResponse,
  personaId: string,
  snapshotVersion: string,
  from: string,
  to: string
) {
  let mentions = 0;
  let checks = 0;
  for (const point of activity.points) {
    if (
      point.personaId === personaId &&
      point.snapshotVersion === snapshotVersion &&
      point.day >= from &&
      point.day < to
    ) {
      mentions += point.mentions;
      checks += point.checks;
    }
  }
  return checks ? (mentions / checks) * 100 : null;
}

/** Rate change in points between the first and second half of the range. */
export function personaMentionRateDelta(
  activity: GeoPersonaActivityResponse,
  personaId: string,
  snapshotVersion: string | undefined
) {
  const days = activityDays(activity.from, activity.to);
  const middle = days[Math.floor(days.length / 2)];
  if (!(snapshotVersion && middle)) {
    return null;
  }
  const first = rateBetween(
    activity,
    personaId,
    snapshotVersion,
    activity.from,
    middle
  );
  const second = rateBetween(
    activity,
    personaId,
    snapshotVersion,
    middle,
    activity.to
  );
  return first === null || second === null ? null : second - first;
}

export function personaMentionRate(
  activity: GeoPersonaActivityResponse,
  personaId: string,
  snapshotVersion: string | undefined
) {
  if (!snapshotVersion) {
    return null;
  }
  let mentions = 0;
  let checks = 0;
  for (const point of activity.points) {
    if (
      point.personaId !== personaId ||
      point.snapshotVersion !== snapshotVersion
    ) {
      continue;
    }
    mentions += point.mentions;
    checks += point.checks;
  }
  return checks ? (mentions / checks) * 100 : null;
}

/**
 * Y-axis ceiling for the visible series: the highest rate rounded up to the
 * next step, so a 37% peak uses the chart height instead of a fixed 0–100%.
 */
export function personaActivityAxisMax(
  rows: readonly Record<string, string | number | null>[],
  keys: readonly string[]
) {
  let peak = 0;
  for (const row of rows) {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === "number" && value > peak) {
        peak = value;
      }
    }
  }
  const ceiling =
    Math.floor(peak / GEO_PERSONA_CHART_MAX_STEP + 1) *
    GEO_PERSONA_CHART_MAX_STEP;
  return Math.min(100, Math.max(GEO_PERSONA_CHART_MIN_MAX, ceiling));
}
