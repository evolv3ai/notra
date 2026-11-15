import { WORKFLOW_LOGOS } from "ui/workflow/logo";
import type {
  WorkflowEdgeData,
  WorkflowEdgeStatus,
  WorkflowField,
  WorkflowLogEntry,
  WorkflowLogLevel,
  WorkflowLogoName,
  WorkflowNodeData,
  WorkflowNodeKind,
  WorkflowNodeState,
  WorkflowNodeStatus,
} from "ui/workflow/types";

import type {
  WorkflowRunView,
  WorkflowRunViewNode,
  WorkflowRunViewStep,
} from "@/types/workflow-engine";

const NODE_STATUS: Record<
  NonNullable<WorkflowRunViewNode["status"]>,
  WorkflowNodeStatus
> = {
  running: "running",
  retrying: "running",
  success: "success",
  halted: "skipped",
  error: "error",
  skipped: "skipped",
};

const LOG_LEVEL: Record<
  NonNullable<WorkflowRunViewNode["status"]>,
  WorkflowLogLevel
> = {
  running: "info",
  retrying: "info",
  success: "success",
  halted: "skip",
  error: "error",
  skipped: "skip",
};

function isLogo(logo: string | null): logo is WorkflowLogoName {
  return logo !== null && Object.hasOwn(WORKFLOW_LOGOS, logo);
}

function nodeKind(node: WorkflowRunViewNode): WorkflowNodeKind {
  return node.kind === undefined || node.kind === "workflow"
    ? "task"
    : node.kind;
}

function stepLine(step: WorkflowRunViewStep) {
  return [
    step.title,
    step.status ?? "didn't run",
    step.attempts > 1 ? `${step.attempts} attempts` : null,
    step.error,
  ]
    .filter(Boolean)
    .join(" · ");
}

function nodeFields(node: WorkflowRunViewNode): WorkflowField[] {
  return [
    { label: "Block", value: node.type },
    { label: "On error", value: node.onError ?? "fail" },
    ...node.steps.map((step, index) => ({
      label: String(index + 1),
      value: stepLine(step),
    })),
    ...(node.port ? [{ label: "Path", value: node.port }] : []),
    ...(node.reason ? [{ label: "Reason", value: node.reason }] : []),
    ...(node.error ? [{ label: "Error", value: node.error }] : []),
  ];
}

function elapsedMs(node: WorkflowRunViewNode, now: number) {
  if (!node.startedAt) {
    return 0;
  }
  const end = node.finishedAt ? new Date(node.finishedAt).getTime() : now;
  return Math.max(0, end - new Date(node.startedAt).getTime());
}

export function toWorkflowCanvasNodes(
  run: WorkflowRunView
): WorkflowNodeData[] {
  return run.nodes.map((node) => ({
    id: node.id,
    durationMs: node.finishedAt ? elapsedMs(node, 0) : 0,
    kind: nodeKind(node),
    title: node.title,
    description: node.reason ?? node.description,
    position: node.position ?? { x: 0, y: 0 },
    outputs: node.outputs.length > 1 ? node.outputs : undefined,
    branch: node.port ?? undefined,
    fields: nodeFields(node),
    ...(isLogo(node.logo) ? { logo: node.logo } : {}),
    ...(node.output === null
      ? {}
      : { output: JSON.stringify(node.output, null, 2) }),
  }));
}

export function toWorkflowCanvasEdges(
  run: WorkflowRunView
): WorkflowEdgeData[] {
  return run.edges.map(({ id, source, sourcePort, target }) => ({
    id,
    source,
    target,
    ...(sourcePort ? { sourcePort } : {}),
  }));
}

export function workflowNodeState(
  node: WorkflowRunViewNode | undefined,
  now: number
): WorkflowNodeState {
  return node?.status
    ? { status: NODE_STATUS[node.status], elapsedMs: elapsedMs(node, now) }
    : { status: "idle", elapsedMs: 0 };
}

export function workflowEdgeStatus(
  run: WorkflowRunView,
  edgeId: string
): WorkflowEdgeStatus {
  const edge = run.edges.find((item) => item.id === edgeId);
  if (!edge || edge.taken === null) {
    return "idle";
  }
  if (!edge.taken) {
    return "skipped";
  }
  const target = run.nodes.find((node) => node.id === edge.target);
  return target?.status === "running" || target?.status === "retrying"
    ? "active"
    : "done";
}

export function workflowRunLog(run: WorkflowRunView): WorkflowLogEntry[] {
  const origin = run.startedAt ? new Date(run.startedAt).getTime() : 0;
  const at = (value: Date | string | null) =>
    value ? Math.max(0, new Date(value).getTime() - origin) : 0;
  return run.nodes
    .flatMap((node) => {
      const entry = (
        key: string,
        time: Date | string | null,
        level: WorkflowLogLevel,
        message: string
      ): WorkflowLogEntry => ({
        at: at(time),
        id: `${node.id}:${key}`,
        level,
        message,
        nodeId: node.id,
        title: node.title,
      });
      if (!node.status) {
        return [];
      }
      if (node.status === "skipped") {
        return [
          entry("skipped", node.finishedAt, "skip", node.reason ?? "Skipped"),
        ];
      }
      const steps = node.steps.flatMap((step) =>
        step.status
          ? [
              entry(
                `step:${step.id}`,
                step.finishedAt ?? step.startedAt,
                LOG_LEVEL[step.status],
                stepLine(step)
              ),
            ]
          : []
      );
      const settled = node.finishedAt
        ? [
            entry(
              "finished",
              node.finishedAt,
              LOG_LEVEL[node.status],
              node.error ?? node.reason ?? "Finished"
            ),
          ]
        : [];
      return [
        entry("started", node.startedAt, "info", "Started"),
        ...steps,
        ...settled,
      ];
    })
    .sort((a, b) => a.at - b.at);
}
