import {
  AUTOMATION_RUN_STALE_AFTER_MS,
  AUTOMATION_RUN_STALE_MESSAGE,
} from "@notra/db/constants/automation-runs";
import { db } from "@notra/db/drizzle";
import { automationRuns } from "@notra/db/schema";
import type { AutomationRunStatus } from "@notra/schemas/dashboard/automation/runs";
import { and, desc, eq, gte, lt, max, or, sql, type SQL } from "drizzle-orm";

import type {
  AutomationRun,
  AutomationRunsPage,
  FinishAutomationRunInput,
  ListAutomationRunsInput,
  StartAutomationRunInput,
} from "@/types/automation/runs";
import {
  decodeAutomationRunCursor,
  encodeAutomationRunCursor,
} from "@/utils/automation-runs";

type AutomationRunRow = typeof automationRuns.$inferSelect;

/** Records a run as started. Safe to repeat: an existing run is left alone. */
export async function startAutomationRun(input: StartAutomationRunInput) {
  await db
    .insert(automationRuns)
    .values({ ...input, status: "running", startedAt: new Date() })
    .onConflictDoNothing({ target: automationRuns.id });
}

/** Settles a running run. Does nothing when the run was never recorded. */
export async function finishAutomationRun(input: FinishAutomationRunInput) {
  await db
    .update(automationRuns)
    .set({
      status: input.status,
      title: input.title ?? null,
      errorMessage: input.errorMessage ?? null,
      postId: input.postId ?? null,
      finishedAt: new Date(),
    })
    .where(
      and(eq(automationRuns.id, input.id), eq(automationRuns.status, "running"))
    );
}

/** Records a run that started and finished within one call. */
export async function recordAutomationRun(
  input: StartAutomationRunInput &
    FinishAutomationRunInput & { startedAt: Date }
) {
  await db
    .insert(automationRuns)
    .values({
      id: input.id,
      organizationId: input.organizationId,
      automationId: input.automationId,
      manual: input.manual,
      status: input.status,
      title: input.title ?? null,
      errorMessage: input.errorMessage ?? null,
      postId: input.postId ?? null,
      startedAt: input.startedAt,
      finishedAt: new Date(),
    })
    .onConflictDoNothing({ target: automationRuns.id });
}

function staleBefore() {
  return new Date(Date.now() - AUTOMATION_RUN_STALE_AFTER_MS);
}

function statusCondition(
  status: AutomationRunStatus,
  cutoff: Date
): SQL | undefined {
  const running = eq(automationRuns.status, "running");
  if (status === "running") {
    return and(running, gte(automationRuns.startedAt, cutoff));
  }
  if (status === "failed") {
    return or(
      eq(automationRuns.status, "failed"),
      and(running, lt(automationRuns.startedAt, cutoff))
    );
  }
  return eq(automationRuns.status, status);
}

function toAutomationRun(row: AutomationRunRow, cutoff: Date): AutomationRun {
  const stale = row.status === "running" && row.startedAt < cutoff;
  return {
    id: row.id,
    automationId: row.automationId,
    title: row.title,
    status: stale ? "failed" : row.status,
    errorMessage: stale ? AUTOMATION_RUN_STALE_MESSAGE : row.errorMessage,
    createdAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    manual: row.manual,
    postId: row.postId,
  };
}

export async function listAutomationRuns(
  input: ListAutomationRunsInput
): Promise<AutomationRunsPage> {
  const cutoff = staleBefore();
  const cursor = input.cursor ? decodeAutomationRunCursor(input.cursor) : null;
  const rows = await db
    .select()
    .from(automationRuns)
    .where(
      and(
        eq(automationRuns.organizationId, input.organizationId),
        input.automationId
          ? eq(automationRuns.automationId, input.automationId)
          : undefined,
        input.status ? statusCondition(input.status, cutoff) : undefined,
        cursor
          ? sql`(${automationRuns.startedAt}, ${automationRuns.id}) < (${sql.param(cursor.startedAt, automationRuns.startedAt)}, ${sql.param(cursor.id, automationRuns.id)})`
          : undefined
      )
    )
    .orderBy(desc(automationRuns.startedAt), desc(automationRuns.id))
    .limit(input.limit + 1);

  const page = rows.slice(0, input.limit);
  const last = page.at(-1);
  return {
    runs: page.map((row) => toAutomationRun(row, cutoff)),
    nextCursor:
      rows.length > input.limit && last
        ? encodeAutomationRunCursor(last)
        : null,
  };
}

/** When each automation of the organization last started a run. */
export async function listLatestAutomationRuns(
  organizationId: string
): Promise<Record<string, string>> {
  const rows = await db
    .select({
      automationId: automationRuns.automationId,
      startedAt: max(automationRuns.startedAt).mapWith(
        automationRuns.startedAt
      ),
    })
    .from(automationRuns)
    .where(eq(automationRuns.organizationId, organizationId))
    .groupBy(automationRuns.automationId)
    .orderBy(automationRuns.automationId);
  return Object.fromEntries(
    rows.map((row) => [row.automationId, row.startedAt.toISOString()])
  );
}
