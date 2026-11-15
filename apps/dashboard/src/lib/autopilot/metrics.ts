import { AUTOPILOT_AUTOMATION_KINDS } from "@notra/db/constants/autopilot";
import { db } from "@notra/db/drizzle";
import {
  autopilotFindings,
  autopilotRunEvents,
  autopilotRuns,
} from "@notra/db/schema";
import {
  and,
  count,
  countDistinct,
  eq,
  gte,
  like,
  lte,
  or,
  sql,
} from "drizzle-orm";

import {
  AUTOPILOT_CREDITS_CHARGED_EVENT,
  AUTOPILOT_LEGACY_PR_CREATED_MESSAGE_PATTERN,
  AUTOPILOT_PULL_REQUEST_CREATED_EVENT,
} from "@/constants/autopilot";
import type {
  AutopilotMetrics,
  AutopilotMetricsDays,
} from "@/types/autopilot-metrics";

/** Aggregate the full reporting period, not the paginated activity preview. */
export async function loadAutopilotMetrics(
  organizationId: string,
  days: AutopilotMetricsDays,
  now = new Date()
): Promise<AutopilotMetrics> {
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const [created, merged, usage, runs] = await Promise.all([
    db
      .select({
        kind: autopilotRunEvents.job,
        total: countDistinct(sql`${autopilotRunEvents.data}->>'url'`),
      })
      .from(autopilotRunEvents)
      .innerJoin(autopilotRuns, eq(autopilotRuns.id, autopilotRunEvents.runId))
      .where(
        and(
          eq(autopilotRunEvents.organizationId, organizationId),
          eq(autopilotRuns.organizationId, organizationId),
          eq(autopilotRunEvents.level, "action"),
          gte(autopilotRunEvents.createdAt, since),
          lte(autopilotRunEvents.createdAt, now),
          or(
            eq(
              sql`${autopilotRunEvents.data}->>'event'`,
              AUTOPILOT_PULL_REQUEST_CREATED_EVENT
            ),
            and(
              sql`${autopilotRunEvents.data}->>'event' is null`,
              like(
                autopilotRunEvents.message,
                AUTOPILOT_LEGACY_PR_CREATED_MESSAGE_PATTERN
              )
            )
          )
        )
      )
      .groupBy(autopilotRunEvents.job),
    db
      .select({ kind: autopilotFindings.kind, total: count() })
      .from(autopilotFindings)
      .where(
        and(
          eq(autopilotFindings.organizationId, organizationId),
          eq(autopilotFindings.status, "merged"),
          gte(autopilotFindings.mergedAt, since),
          lte(autopilotFindings.mergedAt, now)
        )
      )
      .groupBy(autopilotFindings.kind),
    // A job ran in a run when it logged anything there.
    db
      .select({
        kind: autopilotRunEvents.job,
        runs: countDistinct(autopilotRunEvents.runId),
        credits:
          sql<number>`coalesce(sum((${autopilotRunEvents.data}->>'credits')::numeric) filter (where ${autopilotRunEvents.data}->>'event' = ${AUTOPILOT_CREDITS_CHARGED_EVENT}), 0)`.mapWith(
            Number
          ),
      })
      .from(autopilotRunEvents)
      .where(
        and(
          eq(autopilotRunEvents.organizationId, organizationId),
          gte(autopilotRunEvents.createdAt, since),
          lte(autopilotRunEvents.createdAt, now)
        )
      )
      .groupBy(autopilotRunEvents.job),
    db
      .select({ runs: count() })
      .from(autopilotRuns)
      .where(
        and(
          eq(autopilotRuns.organizationId, organizationId),
          gte(autopilotRuns.startedAt, since),
          lte(autopilotRuns.startedAt, now)
        )
      ),
  ]);
  const createdByKind = new Map(created.map((row) => [row.kind, row.total]));
  const usageByKind = new Map(usage.map((row) => [row.kind, row]));
  const totalCredits = usage.reduce((total, row) => total + row.credits, 0);
  const runCount = runs[0]?.runs ?? 0;
  const mergedByKind = new Map(merged.map((row) => [row.kind, row.total]));
  const automations = AUTOPILOT_AUTOMATION_KINDS.map((kind) => {
    const used = usageByKind.get(kind);
    return {
      kind,
      pullRequests: createdByKind.get(kind) ?? 0,
      merged: mergedByKind.get(kind) ?? 0,
      creditsPerRun: used?.runs ? roundCredits(used.credits / used.runs) : 0,
    };
  });
  return {
    days,
    pullRequests: automations.reduce(
      (total, row) => total + row.pullRequests,
      0
    ),
    merged: automations.reduce((total, row) => total + row.merged, 0),
    averageCreditsPerRun: runCount ? roundCredits(totalCredits / runCount) : 0,
    totalCredits: roundCredits(totalCredits),
    automations,
  };
}

function roundCredits(value: number) {
  return Math.round(value * 10) / 10;
}
