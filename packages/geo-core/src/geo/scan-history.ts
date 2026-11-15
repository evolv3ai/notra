import { db } from "@notra/db/drizzle";
import { geoMentionChecks, geoScans } from "@notra/db/schema";
import type { GeoScanPlanSnapshot } from "@notra/db/types/geo-scan";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { Effect } from "effect";

import {
  GEO_SCAN_RESULTS_PAGE_SIZE,
  GEO_SCAN_RUNS_PAGE_SIZE,
} from "../constants/geo-scan-history";
import type {
  GeoLiveScanRowsInput,
  GeoScanRunInput,
  GeoScanRunsInput,
  GeoScanRunSummary,
} from "../types/geo-scan-history";
import { geoScanAnswerKey } from "../utils/geo-scan-plan";
import { geoDb } from "./effect";
import { requireGeoProject } from "./projects";
import { sweepStaleGeoScanRows } from "./scan-status";

export const loadGeoScanRuns = Effect.fn("geo.scanRuns")(function* (
  input: GeoScanRunsInput
) {
  const scope = yield* requireGeoProject(input);
  yield* sweepStaleGeoScanRows(scope);
  const rows = yield* geoDb("scan history lookup failed", () =>
    db.query.geoScans.findMany({
      columns: {
        id: true,
        status: true,
        startedAt: true,
        finishedAt: true,
      },
      extras: {
        plan: sql<GeoScanPlanSnapshot | null>`${geoScans.plan} - 'tasks' - 'taskStates'`.as(
          "plan"
        ),
      },
      where: and(
        eq(geoScans.organizationId, scope.organizationId),
        eq(geoScans.projectId, scope.projectId)
      ),
      orderBy: [desc(geoScans.startedAt), desc(geoScans.id)],
      limit: GEO_SCAN_RUNS_PAGE_SIZE + 1,
      offset: input.offset,
    })
  );
  const page = rows.slice(0, GEO_SCAN_RUNS_PAGE_SIZE);
  const counts =
    page.length === 0
      ? []
      : yield* geoDb("scan counts lookup failed", () =>
          db
            .select({
              scanId: geoMentionChecks.scanId,
              checks: count(),
              mentions:
                sql<number>`count(*) filter (where ${geoMentionChecks.mentioned})`.mapWith(
                  Number
                ),
            })
            .from(geoMentionChecks)
            .where(
              and(
                eq(geoMentionChecks.organizationId, scope.organizationId),
                eq(geoMentionChecks.projectId, scope.projectId),
                inArray(
                  geoMentionChecks.scanId,
                  page.map((row) => row.id)
                )
              )
            )
            .groupBy(geoMentionChecks.scanId)
        );
  const countsByScan = new Map(counts.map((row) => [row.scanId, row]));
  const runs: GeoScanRunSummary[] = page.map((row) => ({
    ...row,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    checks: countsByScan.get(row.id)?.checks ?? 0,
    mentions: countsByScan.get(row.id)?.mentions ?? 0,
  }));
  return { runs, hasMore: rows.length > GEO_SCAN_RUNS_PAGE_SIZE };
});

const scanRunColumns = {
  id: true,
  status: true,
  startedAt: true,
  finishedAt: true,
  plan: true,
} as const;

const resultColumns = {
  id: geoMentionChecks.id,
  prompt: geoMentionChecks.prompt,
  engine: geoMentionChecks.engine,
  mentioned: geoMentionChecks.mentioned,
  position: geoMentionChecks.position,
  language: geoMentionChecks.language,
  turn: geoMentionChecks.turn,
  sequenceId: geoMentionChecks.sequenceId,
  sources: sql<number>`jsonb_array_length(${geoMentionChecks.sources})`.mapWith(
    Number
  ),
  capturedAt: geoMentionChecks.capturedAt,
};

export const loadGeoScanRun = Effect.fn("geo.scanRun")(function* (
  input: GeoScanRunInput
) {
  const scope = yield* requireGeoProject(input);
  yield* sweepStaleGeoScanRows(scope);
  const projectFilter = and(
    eq(geoScans.organizationId, scope.organizationId),
    eq(geoScans.projectId, scope.projectId)
  );
  const { scanId } = input;
  const scan = yield* geoDb("scan lookup failed", () =>
    scanId
      ? db.query.geoScans.findFirst({
          columns: scanRunColumns,
          where: and(eq(geoScans.id, scanId), projectFilter),
        })
      : db.query.geoScans.findFirst({
          columns: scanRunColumns,
          where: projectFilter,
          orderBy: [desc(geoScans.startedAt), desc(geoScans.id)],
        })
  );
  if (!scan) {
    return null;
  }

  const scopeFilter = and(
    eq(geoMentionChecks.scanId, scan.id),
    eq(geoMentionChecks.organizationId, scope.organizationId),
    eq(geoMentionChecks.projectId, scope.projectId)
  );
  const engineFilter = input.engine
    ? eq(geoMentionChecks.engine, input.engine)
    : undefined;
  const resultFilter = and(
    scopeFilter,
    engineFilter,
    input.mentioned ? eq(geoMentionChecks.mentioned, true) : undefined
  );
  const tasks = scan.plan?.tasks ?? [];
  const live = scan.status === "running" && tasks.length > 0;
  const [results, totals, saved] = yield* geoDb(
    "scan results lookup failed",
    () =>
      Promise.all([
        db
          .select(resultColumns)
          .from(geoMentionChecks)
          .where(resultFilter)
          .orderBy(asc(geoMentionChecks.createdAt), asc(geoMentionChecks.id))
          .limit(GEO_SCAN_RESULTS_PAGE_SIZE)
          .offset(input.offset),
        db
          .select({
            checks: count(),
            mentions:
              sql<number>`count(*) filter (where ${geoMentionChecks.mentioned})`.mapWith(
                Number
              ),
            engineChecks: engineFilter
              ? sql<number>`count(*) filter (where ${engineFilter})`.mapWith(
                  Number
                )
              : count(),
            engineMentions: sql<number>`count(*) filter (where ${and(
              engineFilter,
              eq(geoMentionChecks.mentioned, true)
            )})`.mapWith(Number),
          })
          .from(geoMentionChecks)
          .where(scopeFilter),
        tasks.length
          ? db
              .select({
                promptId: geoMentionChecks.promptId,
                engine: geoMentionChecks.engine,
                language: geoMentionChecks.language,
                turn: geoMentionChecks.turn,
              })
              .from(geoMentionChecks)
              .where(scopeFilter)
          : Promise.resolve([]),
      ])
  );
  const savedKeys = new Set(
    saved.map((row) =>
      geoScanAnswerKey(row.promptId, row.engine, row.language, row.turn)
    )
  );
  const liveRows = live
    ? yield* loadLiveScanRows({
        tasks: tasks.filter(
          (task) => !input.engine || task.engine === input.engine
        ),
        offset: input.offset,
        savedKeys,
        taskStates: scan.plan?.taskStates ?? {},
        scopeFilter,
      })
    : null;
  const pending = tasks
    .filter(
      (task) =>
        !savedKeys.has(task.key) &&
        (!input.engine || task.engine === input.engine)
    )
    .map((task) => ({
      ...task,
      status:
        scan.status === "running"
          ? (scan.plan?.taskStates?.[task.key] ?? "queued")
          : "failed",
    }));
  const pendingOffset = Math.min(
    input.pendingOffset ?? 0,
    Math.max(0, Math.ceil(pending.length / GEO_SCAN_RESULTS_PAGE_SIZE) - 1) *
      GEO_SCAN_RESULTS_PAGE_SIZE
  );
  const run: GeoScanRunSummary = {
    id: scan.id,
    status: scan.status,
    startedAt: scan.startedAt.toISOString(),
    finishedAt: scan.finishedAt?.toISOString() ?? null,
    plan: scan.plan ? withoutPlanTasks(scan.plan) : null,
    checks: totals[0]?.checks ?? 0,
    mentions: totals[0]?.mentions ?? 0,
  };
  return {
    run,
    status: scan.status,
    pendingOffset,
    pending: pending.slice(
      pendingOffset,
      pendingOffset + GEO_SCAN_RESULTS_PAGE_SIZE
    ),
    pendingTotal: pending.length,
    results: results.map((row) => ({
      ...row,
      capturedAt: row.capturedAt.toISOString(),
    })),
    total: input.mentioned
      ? (totals[0]?.engineMentions ?? 0)
      : (totals[0]?.engineChecks ?? 0),
    answerTotal: totals[0]?.engineChecks ?? 0,
    mentionedTotal: totals[0]?.engineMentions ?? 0,
    live: liveRows,
  };
});

/**
 * One page of a running scan in plan order: every planned answer is a row
 * from the start, and fills in once its answer is saved, so a just-started
 * prompt shows up at once and rows never jump while the scan runs.
 */
const loadLiveScanRows = Effect.fn("geo.liveScanRows")(function* ({
  tasks,
  offset,
  savedKeys,
  taskStates,
  scopeFilter,
}: GeoLiveScanRowsInput) {
  const liveOffset = Math.min(
    offset,
    Math.max(0, Math.ceil(tasks.length / GEO_SCAN_RESULTS_PAGE_SIZE) - 1) *
      GEO_SCAN_RESULTS_PAGE_SIZE
  );
  const page = tasks.slice(liveOffset, liveOffset + GEO_SCAN_RESULTS_PAGE_SIZE);
  const answeredPromptIds = [
    ...new Set(
      page
        .filter((task) => savedKeys.has(task.key))
        .map((task) => task.promptId)
    ),
  ];
  const answers = answeredPromptIds.length
    ? yield* geoDb("live scan answers lookup failed", () =>
        db
          .select({ ...resultColumns, promptId: geoMentionChecks.promptId })
          .from(geoMentionChecks)
          .where(
            and(
              scopeFilter,
              inArray(geoMentionChecks.promptId, answeredPromptIds)
            )
          )
      )
    : [];
  const answersByKey = new Map(
    answers.map(({ promptId, ...row }) => [
      geoScanAnswerKey(promptId, row.engine, row.language, row.turn),
      { ...row, capturedAt: row.capturedAt.toISOString() },
    ])
  );
  return {
    offset: liveOffset,
    total: tasks.length,
    rows: page.map((task) => ({
      ...task,
      status: taskStates[task.key] ?? ("queued" as const),
      answer: answersByKey.get(task.key) ?? null,
    })),
  };
});

function withoutPlanTasks({
  tasks: _tasks,
  taskStates: _taskStates,
  ...plan
}: GeoScanPlanSnapshot): GeoScanPlanSnapshot {
  return plan;
}
