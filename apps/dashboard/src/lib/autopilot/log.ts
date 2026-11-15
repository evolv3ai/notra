import { db } from "@notra/db/drizzle";
import { autopilotRunEvents, autopilotRuns } from "@notra/db/schema";
import type {
  AutopilotEventLevel,
  AutopilotJobKind,
  AutopilotRunEventData,
  AutopilotTraceDetail,
} from "@notra/db/types/autopilot";
import { and, asc, desc, eq, inArray, isNotNull, lt } from "drizzle-orm";
import { nanoid } from "nanoid";

import {
  AUTOPILOT_JOB_DECISION_LIMIT,
  AUTOPILOT_JOB_DECISION_RUNS,
  AUTOPILOT_TRACE_DETAIL_RETENTION_MS,
} from "@/constants/autopilot";
import { AUTOPILOT_ADMIN_TRACE_EVENT_LIMIT } from "@/constants/autopilot-observability";
import type { AutopilotRunContext } from "@/types/autopilot";
import type {
  AutopilotLogFn,
  AutopilotLogger,
} from "@/types/autopilot-runtime";
import {
  clipAutopilotTraceDetail,
  redactAutopilotTraceDetail,
} from "@/utils/autopilot-log";

/** Writes the run trace; never fails the job. */
export function createAutopilotLogger(
  ctx: Pick<AutopilotRunContext, "organizationId" | "runId">,
  job: AutopilotJobKind | null
): AutopilotLogger {
  const insert = async (row: {
    level: AutopilotEventLevel;
    message: string;
    data?: AutopilotRunEventData;
    detail?: AutopilotTraceDetail;
    internal: boolean;
  }) => {
    await db
      .insert(autopilotRunEvents)
      .values({
        id: nanoid(),
        organizationId: ctx.organizationId,
        runId: ctx.runId,
        job,
        level: row.level,
        message: redactAutopilotTraceDetail(row.message) as string,
        data: row.data
          ? (redactAutopilotTraceDetail(row.data) as AutopilotRunEventData)
          : null,
        detail: row.detail
          ? (clipAutopilotTraceDetail(
              redactAutopilotTraceDetail(row.detail)
            ) as AutopilotTraceDetail)
          : null,
        internal: row.internal,
        createdAt: new Date(),
      })
      .catch(() => undefined);
  };
  const write =
    (level: AutopilotEventLevel): AutopilotLogFn =>
    (message, data, detail) =>
      insert({ level, message, data, detail, internal: false });
  return {
    info: write("info"),
    skip: write("skip"),
    decision: write("decision"),
    action: write("action"),
    error: write("error"),
    trace: (message, detail) =>
      insert({ level: "info", message, detail, internal: true }),
  };
}

const noop = () => Promise.resolve();

/** For checks that only become a run when they lead somewhere. */
export const silentAutopilotLogger: AutopilotLogger = {
  info: noop,
  skip: noop,
  decision: noop,
  action: noop,
  error: noop,
  trace: noop,
};

/** What workspace members see: no admin-only events or details. */
export function listRunEvents(organizationId: string, runId: string) {
  return db
    .select({
      id: autopilotRunEvents.id,
      job: autopilotRunEvents.job,
      level: autopilotRunEvents.level,
      message: autopilotRunEvents.message,
      data: autopilotRunEvents.data,
      createdAt: autopilotRunEvents.createdAt,
    })
    .from(autopilotRunEvents)
    .where(
      and(
        eq(autopilotRunEvents.organizationId, organizationId),
        eq(autopilotRunEvents.runId, runId),
        eq(autopilotRunEvents.internal, false)
      )
    )
    .orderBy(asc(autopilotRunEvents.createdAt));
}

const OPENED_PULL_REQUEST = /^Opened pull request #/;

/**
 * What each item run (a mention, a pull request event, a written suggestion)
 * was about and what it came to, read from its log. Item runs log a handful
 * of events, so reading them all stays cheap.
 */
export async function describeItemRuns(
  organizationId: string,
  runIds: string[]
) {
  const described = new Map<
    string,
    {
      headline: string | null;
      outcome: { level: AutopilotEventLevel; message: string } | null;
    }
  >();
  if (runIds.length === 0) {
    return described;
  }
  const events = await db
    .select({
      runId: autopilotRunEvents.runId,
      level: autopilotRunEvents.level,
      message: autopilotRunEvents.message,
    })
    .from(autopilotRunEvents)
    .where(
      and(
        inArray(autopilotRunEvents.runId, runIds),
        eq(autopilotRunEvents.organizationId, organizationId),
        eq(autopilotRunEvents.internal, false)
      )
    )
    .orderBy(asc(autopilotRunEvents.createdAt));
  const byRun = new Map<string, typeof events>();
  for (const event of events) {
    byRun.set(event.runId, [...(byRun.get(event.runId) ?? []), event]);
  }
  for (const [runId, runEvents] of byRun) {
    const [first, ...rest] = runEvents;
    const choices = rest.filter((event) => event.level !== "info");
    const outcome =
      rest.find((event) => OPENED_PULL_REQUEST.test(event.message)) ??
      choices.findLast((event) => event.level === "error") ??
      choices.at(-1);
    described.set(runId, {
      headline: first?.message ?? null,
      outcome: outcome
        ? { level: outcome.level, message: outcome.message }
        : null,
    });
  }
  return described;
}

/**
 * What one automation came to in each recent run, newest first: the pull
 * request it opened, else its last error, else its last skip or decision.
 */
export async function listJobDecisions(
  organizationId: string,
  job: AutopilotJobKind
) {
  // Through the runs index; events are only indexed by run.
  const runs = await db
    .select({ id: autopilotRuns.id })
    .from(autopilotRuns)
    .where(eq(autopilotRuns.organizationId, organizationId))
    .orderBy(desc(autopilotRuns.startedAt))
    .limit(AUTOPILOT_JOB_DECISION_RUNS);
  if (runs.length === 0) {
    return [];
  }
  const events = await db
    .select({
      id: autopilotRunEvents.id,
      runId: autopilotRunEvents.runId,
      level: autopilotRunEvents.level,
      message: autopilotRunEvents.message,
      createdAt: autopilotRunEvents.createdAt,
    })
    .from(autopilotRunEvents)
    .where(
      and(
        inArray(
          autopilotRunEvents.runId,
          runs.map((run) => run.id)
        ),
        eq(autopilotRunEvents.organizationId, organizationId),
        eq(autopilotRunEvents.job, job),
        eq(autopilotRunEvents.internal, false),
        inArray(autopilotRunEvents.level, [
          "skip",
          "decision",
          "action",
          "error",
        ])
      )
    )
    .orderBy(asc(autopilotRunEvents.createdAt));
  const byRun = new Map<string, typeof events>();
  for (const event of events) {
    byRun.set(event.runId, [...(byRun.get(event.runId) ?? []), event]);
  }
  const outcomes = [...byRun.values()]
    .map((runEvents) => {
      const opened = runEvents.find((event) =>
        OPENED_PULL_REQUEST.test(event.message)
      );
      const choices = runEvents.filter((event) => event.level !== "action");
      return (
        opened ??
        choices.findLast((event) => event.level === "error") ??
        choices.at(-1)
      );
    })
    .filter((event) => event !== undefined)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  // Runs that came to the same thing in a row read as one row: "since …".
  const rows: ((typeof outcomes)[number] & { runs: number; since: Date })[] =
    [];
  for (const outcome of outcomes) {
    const previous = rows.at(-1);
    if (
      previous &&
      previous.level === outcome.level &&
      previous.message === outcome.message
    ) {
      previous.runs += 1;
      previous.since = outcome.createdAt;
      continue;
    }
    rows.push({ ...outcome, runs: 1, since: outcome.createdAt });
  }
  return rows.slice(0, AUTOPILOT_JOB_DECISION_LIMIT);
}

/** Everything, including admin-only events and details, for the admin console. */
export function listRunTrace(runId: string) {
  return db.query.autopilotRunEvents.findMany({
    where: eq(autopilotRunEvents.runId, runId),
    orderBy: [asc(autopilotRunEvents.createdAt)],
    limit: AUTOPILOT_ADMIN_TRACE_EVENT_LIMIT + 1,
  });
}

/** Keep summarized history, but remove raw model/tool payloads after seven days. */
export async function purgeExpiredAutopilotTraceDetails(now = new Date()) {
  await db
    .update(autopilotRunEvents)
    .set({ detail: null })
    .where(
      and(
        isNotNull(autopilotRunEvents.detail),
        lt(
          autopilotRunEvents.createdAt,
          new Date(now.getTime() - AUTOPILOT_TRACE_DETAIL_RETENTION_MS)
        )
      )
    );
}
