import { db } from "@notra/db/drizzle";
import { workflowRunNodes, workflowRuns } from "@notra/db/schema";
import type { WorkflowRunNodeStep } from "@notra/db/types/workflows";
import type { WorkflowGraph } from "@notra/workflows/types/graph";
import type { WorkflowNodeEvent } from "@notra/workflows/types/interpreter";
import { and, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

import {
  WORKFLOW_STORED_PREVIEW_MAX_CHARS,
  WORKFLOW_STORED_VALUE_MAX_CHARS,
} from "@/constants/workflow-engine";
import type {
  WorkflowChildRunStart,
  WorkflowNodeStepInput,
  WorkflowRunFinish,
  WorkflowTransaction,
} from "@/types/workflow-engine";
import {
  clipAutopilotTraceDetail,
  redactAutopilotTraceDetail,
} from "@/utils/autopilot-log";

function toStoredValue(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }
  const plain: unknown = JSON.parse(JSON.stringify(value) ?? "null");
  const stored = clipAutopilotTraceDetail(redactAutopilotTraceDetail(plain));
  const json = JSON.stringify(stored);
  return json.length > WORKFLOW_STORED_VALUE_MAX_CHARS
    ? {
        truncated: true,
        chars: json.length,
        preview: json.slice(0, WORKFLOW_STORED_PREVIEW_MAX_CHARS),
      }
    : stored;
}

function appTimestamp(date: Date) {
  return sql`${date.toISOString()}::timestamp`;
}

export async function createWorkflowRunRecord(params: {
  id?: string;
  organizationId: string;
  workflowKey: string;
  graph: WorkflowGraph;
  trigger: string;
  input: unknown;
}) {
  const id = params.id ?? nanoid();
  await db.insert(workflowRuns).values({
    id,
    organizationId: params.organizationId,
    workflowKey: params.workflowKey,
    rootRunId: id,
    graph: params.graph,
    trigger: params.trigger,
    input: toStoredValue(params.input),
    createdAt: new Date(),
  });
  return id;
}

export async function markWorkflowRunStarted(
  runId: string,
  runtimeRunId: string
) {
  await db
    .update(workflowRuns)
    .set({
      status: sql`case when ${workflowRuns.status} = 'queued' then 'running' else ${workflowRuns.status} end`,
      runtimeRunId,
      startedAt: sql`coalesce(${workflowRuns.startedAt}, ${appTimestamp(new Date())})`,
    })
    .where(eq(workflowRuns.id, runId));
}

export async function startChildWorkflowRunRecord(
  start: WorkflowChildRunStart
) {
  const id = `${start.parentRunId}.${start.parentNodeId}`;
  await db
    .insert(workflowRuns)
    .values({
      id,
      organizationId: start.organizationId,
      workflowKey: start.workflowKey,
      parentRunId: start.parentRunId,
      rootRunId: start.rootRunId,
      parentNodeId: start.parentNodeId,
      graph: start.graph,
      runtimeRunId: start.runtimeRunId,
      trigger: "call",
      status: "running",
      input: toStoredValue(start.input),
      startedAt: appTimestamp(new Date()),
      createdAt: new Date(),
    })
    .onConflictDoNothing({ target: workflowRuns.id });
  return id;
}

export async function markWorkflowRunLaunchFailed(
  runId: string,
  error: string
) {
  await db
    .update(workflowRuns)
    .set({ status: "failed", errorMessage: error, finishedAt: new Date() })
    .where(and(eq(workflowRuns.id, runId), eq(workflowRuns.status, "queued")));
}

export async function finishWorkflowRunRecord(finish: WorkflowRunFinish) {
  const finishedAt = new Date();
  await db
    .update(workflowRunNodes)
    .set({
      status: "error",
      errorMessage: "The run ended before this step finished",
      finishedAt,
    })
    .where(
      and(
        eq(workflowRunNodes.runId, finish.runId),
        inArray(workflowRunNodes.status, ["running", "retrying"])
      )
    );
  await db
    .update(workflowRuns)
    .set({
      status: sql`case when exists (select 1 from workflow_runs as root where root.id = "workflow_runs"."root_run_id" and root.status = 'stopped') then 'stopped' else ${finish.status} end`,
      output: toStoredValue(finish.output),
      errorMessage: finish.error ?? null,
      failedNodeId: finish.failedNodeId ?? null,
      finishedAt,
    })
    .where(
      and(
        eq(workflowRuns.id, finish.runId),
        eq(workflowRuns.organizationId, finish.organizationId),
        inArray(workflowRuns.status, ["queued", "running", "stopped"])
      )
    );
}

export async function stopWorkflowRun(
  tx: WorkflowTransaction,
  organizationId: string,
  rootRunId: string
) {
  await tx
    .update(workflowRuns)
    .set({ status: "stopped", finishedAt: new Date() })
    .where(
      and(
        eq(workflowRuns.organizationId, organizationId),
        eq(workflowRuns.rootRunId, rootRunId),
        inArray(workflowRuns.status, ["queued", "running"])
      )
    );
}

export async function failWorkflowRunTrees(
  organizationId: string,
  rootRunIds: string[],
  error: string
) {
  if (rootRunIds.length === 0) {
    return;
  }
  await db
    .update(workflowRuns)
    .set({ status: "failed", errorMessage: error, finishedAt: new Date() })
    .where(
      and(
        eq(workflowRuns.organizationId, organizationId),
        inArray(workflowRuns.rootRunId, rootRunIds),
        inArray(workflowRuns.status, ["queued", "running"])
      )
    );
}

export async function isWorkflowRunStopped(runId: string) {
  const rows = await db
    .select({ id: workflowRuns.id })
    .from(workflowRuns)
    .where(
      and(
        eq(workflowRuns.status, "stopped"),
        sql`${workflowRuns.id} = (select coalesce(run.root_run_id, run.id) from workflow_runs as run where run.id = ${runId})`
      )
    )
    .limit(1);
  return rows.length > 0;
}

export async function recordWorkflowNodeEvents(
  runId: string,
  organizationId: string,
  events: WorkflowNodeEvent[]
) {
  if (events.length === 0) {
    return;
  }
  await db
    .insert(workflowRunNodes)
    .values(
      events.map((event) => ({
        id: nanoid(),
        organizationId,
        runId,
        nodeId: event.nodeId,
        status: event.status,
        port: event.port ?? null,
        output: toStoredValue(event.output),
        errorMessage: event.error ?? null,
        reason: event.reason ?? null,
        startedAt: event.startedAt ? new Date(event.startedAt) : null,
        finishedAt: new Date(event.finishedAt),
      }))
    )
    .onConflictDoUpdate({
      target: [workflowRunNodes.runId, workflowRunNodes.nodeId],
      set: {
        status: sql`excluded.status`,
        port: sql`excluded.port`,
        output: sql`excluded.output`,
        errorMessage: sql`excluded.error_message`,
        reason: sql`excluded.reason`,
        finishedAt: sql`excluded.finished_at`,
        startedAt: sql`coalesce(${workflowRunNodes.startedAt}, excluded.started_at)`,
      },
    });
}

export async function markWorkflowNodeStep(
  input: WorkflowNodeStepInput,
  step: { id: string; index: number; attempt: number },
  update: {
    status: WorkflowRunNodeStep["status"];
    error?: string;
    finished?: boolean;
  }
) {
  const now = new Date();
  const patch: Partial<WorkflowRunNodeStep> = {
    index: step.index,
    status: update.status,
    attempts: step.attempt,
    error: update.error ?? null,
    finishedAt: update.finished ? now.toISOString() : null,
  };
  const status = update.status === "retrying" ? "retrying" : "running";
  await db
    .insert(workflowRunNodes)
    .values({
      id: nanoid(),
      organizationId: input.organizationId,
      runId: input.runId,
      nodeId: input.node.id,
      status,
      steps: {
        [step.id]: { ...patch, startedAt: now.toISOString() },
      } as Record<string, WorkflowRunNodeStep>,
      startedAt: now,
    })
    .onConflictDoUpdate({
      target: [workflowRunNodes.runId, workflowRunNodes.nodeId],
      set: {
        status,
        steps: sql`${workflowRunNodes.steps} || jsonb_build_object(${step.id}::text, jsonb_build_object('startedAt', ${now.toISOString()}::text) || coalesce(${workflowRunNodes.steps} -> ${step.id}::text, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb)`,
        startedAt: sql`coalesce(${workflowRunNodes.startedAt}, ${appTimestamp(now)})`,
      },
    })
    .catch(() => undefined);
}
