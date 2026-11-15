import { db } from "@notra/db/drizzle";
import { workflowRunNodes, workflowRuns } from "@notra/db/schema";
import type { WorkflowRunNodeStep } from "@notra/db/types/workflows";
import { getConnectablePorts } from "@notra/workflows/runtime/ports";
import { isEdgeTaken, settledPort } from "@notra/workflows/runtime/scheduler";
import { and, asc, eq, inArray } from "drizzle-orm";

import { workflowBlockRegistry } from "@/lib/workflow-engine/blocks";
import { workflowDefinitions } from "@/lib/workflow-engine/definitions/autopilot";
import type {
  WorkflowRunView,
  WorkflowRunViewNode,
  WorkflowRunViewStep,
} from "@/types/workflow-engine";

const UNSETTLED = new Set(["running", "retrying"]);
const UNFINISHED_CHILD = new Set(["queued", "running"]);

function viewSteps(
  manifest: readonly { id: string; title: string }[],
  recorded: Record<string, WorkflowRunNodeStep>
): WorkflowRunViewStep[] {
  const titles = new Map(manifest.map((step) => [step.id, step.title]));
  const ran = Object.entries(recorded)
    .toSorted(([, a], [, b]) => a.index - b.index)
    .map(([id, record]) => ({
      id,
      title: titles.get(id) ?? id,
      status: record.status,
      attempts: record.attempts,
      error: record.error ?? null,
      startedAt: record.startedAt,
      finishedAt: record.finishedAt ?? null,
    }));
  const pending = manifest
    .filter((step) => !Object.hasOwn(recorded, step.id))
    .map((step) => ({
      id: step.id,
      title: step.title,
      status: null,
      attempts: 0,
      error: null,
      startedAt: null,
      finishedAt: null,
    }));
  return [...ran, ...pending];
}

export async function getWorkflowRunViews(
  organizationId: string,
  rootRunId: string
): Promise<WorkflowRunView[]> {
  const runs = await db
    .select()
    .from(workflowRuns)
    .where(
      and(
        eq(workflowRuns.organizationId, organizationId),
        eq(workflowRuns.rootRunId, rootRunId)
      )
    )
    .orderBy(asc(workflowRuns.createdAt));
  if (runs.length === 0) {
    return [];
  }
  const rows = await db
    .select()
    .from(workflowRunNodes)
    .where(
      and(
        eq(workflowRunNodes.organizationId, organizationId),
        inArray(
          workflowRunNodes.runId,
          runs.map((run) => run.id)
        )
      )
    );

  const children = new Map(
    runs.map((run) => [`${run.parentRunId}/${run.parentNodeId}`, run])
  );

  return runs.map((run) => {
    const { graph } = run;
    const own = new Map(
      rows.filter((row) => row.runId === run.id).map((row) => [row.nodeId, row])
    );
    const nodes = graph.nodes.map(({ config: _config, ...node }) => {
      const row = own.get(node.id);
      const block = workflowBlockRegistry.get(node.type);
      const child = children.get(`${run.id}/${node.id}`);
      const calling =
        child && UNFINISHED_CHILD.has(child.status) ? child : null;
      return {
        ...node,
        logo: block?.logo ?? null,
        outputs: getConnectablePorts(node),
        status: row?.status ?? (calling ? "running" : null),
        port: row?.port ?? null,
        output: row?.output ?? null,
        error: row?.errorMessage ?? null,
        reason: row?.reason ?? null,
        startedAt: row?.startedAt ?? calling?.startedAt ?? null,
        finishedAt: row?.finishedAt ?? null,
        steps: viewSteps(block?.steps ?? [], row?.steps ?? {}),
      } satisfies WorkflowRunViewNode;
    });
    const byId = new Map(graph.nodes.map((node) => [node.id, node]));
    return {
      id: run.id,
      title: workflowDefinitions[run.workflowKey]?.title ?? run.workflowKey,
      parentRunId: run.parentRunId,
      startedAt: run.startedAt,
      nodes,
      edges: graph.edges.map((edge) => {
        const source = byId.get(edge.source);
        const row = own.get(edge.source);
        return {
          ...edge,
          taken:
            source && row && !UNSETTLED.has(row.status)
              ? isEdgeTaken(edge, source, settledPort(graph, source, row))
              : null,
        };
      }),
    };
  });
}
