import { AUTOPILOT_AUTOMATION_KINDS } from "@notra/db/constants/autopilot";
import { db } from "@notra/db/drizzle";
import {
  autopilotFindings,
  autopilotRunEvents,
  autopilotRuns,
} from "@notra/db/schema";
import { and, count, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";

import {
  AUTOPILOT_CREDITS_CHARGED_EVENT,
  AUTOPILOT_OUTCOME_BY_STATUS,
} from "@/constants/autopilot";
import type {
  AutopilotAnalytics,
  AutopilotMetricsDays,
  AutopilotOutcomeKey,
} from "@/types/autopilot-metrics";

const DAY_MS = 24 * 60 * 60 * 1000;

// Older findings have no openedAt; their pull request opened with the finding.
const openedAt = sql`coalesce(${autopilotFindings.openedAt}, ${autopilotFindings.createdAt})`;

function utcDay(column: unknown) {
  return sql<string>`to_char(${column} at time zone 'UTC', 'YYYY-MM-DD')`;
}

/** Everything the Analytics tab shows for one period, ending at `now`. */
export async function loadAutopilotAnalytics(
  organizationId: string,
  days: AutopilotMetricsDays,
  now = new Date()
): Promise<AutopilotAnalytics> {
  const since = new Date(now.getTime() - days * DAY_MS);
  const ofOrganization = eq(autopilotFindings.organizationId, organizationId);
  const [opened, merged, closed, ideas, mergeTime, runs, credits] =
    await Promise.all([
      db
        .select({
          day: utcDay(openedAt),
          kind: autopilotFindings.kind,
          total: count(),
        })
        .from(autopilotFindings)
        .where(
          and(
            ofOrganization,
            isNotNull(autopilotFindings.pullRequestUrl),
            gte(openedAt, since),
            lte(openedAt, now)
          )
        )
        .groupBy(sql`1`, autopilotFindings.kind),
      db
        .select({
          day: utcDay(autopilotFindings.mergedAt),
          kind: autopilotFindings.kind,
          total: count(),
        })
        .from(autopilotFindings)
        .where(
          and(
            ofOrganization,
            eq(autopilotFindings.status, "merged"),
            gte(autopilotFindings.mergedAt, since),
            lte(autopilotFindings.mergedAt, now)
          )
        )
        .groupBy(sql`1`, autopilotFindings.kind),
      db
        .select({ kind: autopilotFindings.kind, total: count() })
        .from(autopilotFindings)
        .where(
          and(
            ofOrganization,
            isNotNull(autopilotFindings.pullRequestUrl),
            inArray(autopilotFindings.status, ["dismissed", "expired"]),
            gte(autopilotFindings.dismissedAt, since),
            lte(autopilotFindings.dismissedAt, now)
          )
        )
        .groupBy(autopilotFindings.kind),
      db
        .select({
          kind: autopilotFindings.kind,
          status: autopilotFindings.status,
          total: count(),
          withPullRequest: count(autopilotFindings.pullRequestUrl),
        })
        .from(autopilotFindings)
        .where(
          and(
            ofOrganization,
            gte(autopilotFindings.createdAt, since),
            lte(autopilotFindings.createdAt, now)
          )
        )
        .groupBy(autopilotFindings.kind, autopilotFindings.status),
      db
        .select({
          hours: sql<
            number | null
          >`percentile_cont(0.5) within group (order by extract(epoch from (${autopilotFindings.mergedAt} - ${openedAt})) / 3600)`.mapWith(
            (value) => (value === null ? null : Number(value))
          ),
        })
        .from(autopilotFindings)
        .where(
          and(
            ofOrganization,
            eq(autopilotFindings.status, "merged"),
            gte(autopilotFindings.mergedAt, since),
            lte(autopilotFindings.mergedAt, now)
          )
        ),
      db
        .select({
          trigger: autopilotRuns.trigger,
          status: autopilotRuns.status,
          total: count(),
          seconds: sql<
            number | null
          >`avg(extract(epoch from (${autopilotRuns.finishedAt} - ${autopilotRuns.startedAt})))`.mapWith(
            (value) => (value === null ? null : Number(value))
          ),
        })
        .from(autopilotRuns)
        .where(
          and(
            eq(autopilotRuns.organizationId, organizationId),
            gte(autopilotRuns.startedAt, since),
            lte(autopilotRuns.startedAt, now)
          )
        )
        .groupBy(autopilotRuns.trigger, autopilotRuns.status),
      db
        .select({
          total:
            sql<number>`coalesce(sum((${autopilotRunEvents.data}->>'credits')::numeric), 0)`.mapWith(
              Number
            ),
        })
        .from(autopilotRunEvents)
        .where(
          and(
            eq(autopilotRunEvents.organizationId, organizationId),
            sql`${autopilotRunEvents.data}->>'event' = ${AUTOPILOT_CREDITS_CHARGED_EVENT}`,
            gte(autopilotRunEvents.createdAt, since),
            lte(autopilotRunEvents.createdAt, now)
          )
        ),
    ]);

  // From the day of `since` to today, so no row of the queries falls outside.
  const series = new Map<string, { opened: number; merged: number }>();
  for (let offset = days; offset >= 0; offset -= 1) {
    const day = new Date(now.getTime() - offset * DAY_MS)
      .toISOString()
      .slice(0, 10);
    series.set(day, { opened: 0, merged: 0 });
  }
  for (const row of opened) {
    const point = series.get(row.day);
    if (point) {
      point.opened += row.total;
    }
  }
  for (const row of merged) {
    const point = series.get(row.day);
    if (point) {
      point.merged += row.total;
    }
  }

  const outcomes: Record<AutopilotOutcomeKey, number> = {
    merged: 0,
    inReview: 0,
    suggested: 0,
    dismissed: 0,
    expired: 0,
    failed: 0,
  };
  for (const row of ideas) {
    outcomes[AUTOPILOT_OUTCOME_BY_STATUS[row.status]] += row.total;
  }

  const sumBy = (rows: { kind: string; total: number }[], kind: string) =>
    rows
      .filter((row) => row.kind === kind)
      .reduce((total, row) => total + row.total, 0);
  const automations = AUTOPILOT_AUTOMATION_KINDS.map((kind) => {
    const mergedCount = sumBy(merged, kind);
    return {
      kind,
      ideas: sumBy(ideas, kind),
      pullRequests: sumBy(opened, kind),
      merged: mergedCount,
      mergeRate: rate(mergedCount, sumBy(closed, kind)),
    };
  });

  const triggers = new Map<
    AutopilotAnalytics["triggers"][number]["trigger"],
    number
  >();
  let completedRuns = 0;
  let failedRuns = 0;
  let timedRuns = 0;
  let timedSeconds = 0;
  for (const row of runs) {
    triggers.set(row.trigger, (triggers.get(row.trigger) ?? 0) + row.total);
    if (row.status === "completed") {
      completedRuns += row.total;
    } else if (row.status === "failed") {
      failedRuns += row.total;
    }
    // Failed runs took time too; only running ones have no end yet.
    if (row.status !== "running" && row.seconds !== null) {
      timedRuns += row.total;
      timedSeconds += row.seconds * row.total;
    }
  }

  const mergedTotal = merged.reduce((total, row) => total + row.total, 0);
  const closedTotal = closed.reduce((total, row) => total + row.total, 0);
  const hours = mergeTime[0]?.hours ?? null;
  return {
    days,
    summary: {
      ideas: ideas.reduce((total, row) => total + row.total, 0),
      ideasWithPullRequest: ideas.reduce(
        (total, row) => total + row.withPullRequest,
        0
      ),
      pullRequests: opened.reduce((total, row) => total + row.total, 0),
      merged: mergedTotal,
      closed: closedTotal,
      mergeRate: rate(mergedTotal, closedTotal),
      medianHoursToMerge: hours === null ? null : Math.round(hours * 10) / 10,
      runs: runs.reduce((total, row) => total + row.total, 0),
      runSuccessRate:
        completedRuns + failedRuns === 0
          ? null
          : completedRuns / (completedRuns + failedRuns),
      averageRunSeconds: timedRuns
        ? Math.round(timedSeconds / timedRuns)
        : null,
      credits: Math.round((credits[0]?.total ?? 0) * 10) / 10,
    },
    series: [...series].map(([day, point]) => ({ day, ...point })),
    outcomes,
    triggers: [...triggers]
      .map(([trigger, total]) => ({ trigger, runs: total }))
      .toSorted((a, b) => b.runs - a.runs),
    automations,
  };
}

function rate(merged: number, closed: number) {
  const decided = merged + closed;
  return decided === 0 ? null : merged / decided;
}
