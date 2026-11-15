import { getSmoothStepPath } from "@xyflow/react";
import type { ReactFlowState } from "@xyflow/react";

import {
  WORKFLOW_DEFAULT_DURATION_MS,
  WORKFLOW_EDGE_TRAVEL_MS,
  WORKFLOW_IN_PORT,
  WORKFLOW_MODELS,
  WORKFLOW_NON_DETERMINISTIC_KINDS,
  WORKFLOW_OUT_PORT,
} from "../constants/workflow";
import {
  WORKFLOW_EDGE_LANE_GAP,
  WORKFLOW_EDGE_RADIUS,
  WORKFLOW_EDGE_STEP_OPTIONS,
} from "../constants/workflow-ui";
import type {
  WorkflowAnchor,
  WorkflowBlock,
  WorkflowEdgeData,
  WorkflowEdgeLane,
  WorkflowEdgeStatus,
  WorkflowLogEntry,
  WorkflowNodeData,
  WorkflowNodeState,
  WorkflowPoint,
  WorkflowPort,
  WorkflowRunPhase,
  WorkflowSchedule,
} from "../types/workflow";

export const getInputPorts = (node: WorkflowNodeData): WorkflowPort[] =>
  node.inputs ?? (node.kind === "trigger" ? [] : [WORKFLOW_IN_PORT]);

export const getOutputPorts = (node: WorkflowNodeData): WorkflowPort[] =>
  node.outputs ?? (node.kind === "output" ? [] : [WORKFLOW_OUT_PORT]);

export const isDeterministic = (node: Pick<WorkflowNodeData, "kind">) =>
  !WORKFLOW_NON_DETERMINISTIC_KINDS.includes(node.kind);

export const findModel = (id?: string) =>
  WORKFLOW_MODELS.find((model) => model.id === id);

const byPosition = (a: WorkflowNodeData, b: WorkflowNodeData) =>
  a.position.x - b.position.x || a.position.y - b.position.y;

export const getRunOrder = (
  nodes: WorkflowNodeData[],
  edges: WorkflowEdgeData[]
) => {
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) {
    if (indegree.has(edge.target) && indegree.has(edge.source)) {
      indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    }
  }

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const ready = nodes.filter((node) => indegree.get(node.id) === 0);
  const order: string[] = [];
  while (ready.length > 0) {
    ready.sort(byPosition);
    const node = ready.shift();
    if (!node) {
      break;
    }
    order.push(node.id);
    for (const edge of edges) {
      if (edge.source !== node.id) {
        continue;
      }
      const left = (indegree.get(edge.target) ?? 0) - 1;
      indegree.set(edge.target, left);
      const target = byId.get(edge.target);
      if (left === 0 && target) {
        ready.push(target);
      }
    }
  }

  const ordered = new Set(order);
  const rest = nodes.filter((node) => !ordered.has(node.id)).sort(byPosition);
  return [...order, ...rest.map((node) => node.id)];
};

export const scheduleRun = (
  nodes: WorkflowNodeData[],
  edges: WorkflowEdgeData[]
): WorkflowSchedule => {
  const order = getRunOrder(nodes, edges);
  const schedule: WorkflowSchedule = {
    edges: {},
    nodes: {},
    order,
    totalMs: 0,
  };

  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const id of order) {
    const node = byId.get(id);
    if (!node) {
      continue;
    }
    const incoming = edges
      .filter((edge) => edge.target === id)
      .map((edge) => schedule.edges[edge.id])
      .filter((run) => run !== undefined);
    const taken = incoming.filter((run) => run.taken);
    const settled = Math.max(0, ...incoming.map((run) => run.end));

    if (incoming.length > 0 && taken.length === 0) {
      schedule.nodes[id] = { end: settled, start: settled, status: "skipped" };
    } else {
      const start = Math.max(0, ...taken.map((run) => run.end));
      schedule.nodes[id] = {
        end: start + (node.durationMs ?? WORKFLOW_DEFAULT_DURATION_MS),
        start,
        status: node.fail ? "error" : "success",
      };
    }

    const run = schedule.nodes[id];
    for (const edge of edges.filter((item) => item.source === id)) {
      const port = edge.sourcePort ?? WORKFLOW_OUT_PORT.id;
      const isTaken =
        run.status === "success" &&
        (node.branch === undefined || node.branch === port);
      schedule.edges[edge.id] = {
        end: run.end + (isTaken ? WORKFLOW_EDGE_TRAVEL_MS : 0),
        start: run.end,
        taken: isTaken,
      };
    }
    schedule.totalMs = Math.max(schedule.totalMs, run.end);
  }

  return schedule;
};

export const getNodeState = (
  node: WorkflowNodeData | undefined,
  schedule: WorkflowSchedule,
  phase: WorkflowRunPhase,
  elapsedMs: number
): WorkflowNodeState => {
  const run = node ? schedule.nodes[node.id] : undefined;
  if (!(node && run) || phase === "idle") {
    return { elapsedMs: 0, status: "idle" };
  }
  if (elapsedMs < run.start) {
    return { elapsedMs: 0, status: "queued" };
  }
  if (run.status === "skipped") {
    return { elapsedMs: 0, status: "skipped" };
  }
  if (elapsedMs < run.end) {
    return {
      elapsedMs: elapsedMs - run.start,
      status: node.kind === "approval" ? "waiting" : "running",
    };
  }
  return { elapsedMs: run.end - run.start, status: run.status };
};

export const getEdgeState = (
  id: string,
  schedule: WorkflowSchedule,
  phase: WorkflowRunPhase,
  elapsedMs: number
): WorkflowEdgeStatus => {
  const run = schedule.edges[id];
  if (!run || phase === "idle" || elapsedMs < run.start) {
    return "idle";
  }
  if (!run.taken) {
    return "skipped";
  }
  return elapsedMs < run.end ? "active" : "done";
};

export const formatDuration = (ms: number) => {
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  if (ms < 3_600_000) {
    const minutes = Math.floor(ms / 60_000);
    const seconds = Math.floor((ms % 60_000) / 1000);
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
};

export const formatRate = (rate: number) => `${Math.round(rate * 100)}%`;

export const formatClock = (ms: number) => {
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  const tenths = Math.floor((ms % 1000) / 100);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
};

const branchLabel = (node: WorkflowNodeData) =>
  getOutputPorts(node).find((port) => port.id === node.branch)?.label ??
  node.branch;

export const getRunLog = (
  nodes: WorkflowNodeData[],
  schedule: WorkflowSchedule,
  phase: WorkflowRunPhase,
  elapsedMs: number
): WorkflowLogEntry[] => {
  if (phase === "idle") {
    return [];
  }
  const entries: WorkflowLogEntry[] = [];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const id of schedule.order) {
    const node = byId.get(id);
    const run = schedule.nodes[id];
    if (!(node && run) || elapsedMs < run.start) {
      continue;
    }
    const base = { nodeId: id, title: node.title };
    if (run.status === "skipped") {
      entries.push({
        ...base,
        at: run.start,
        id: `${id}:skip`,
        level: "skip",
        message: "Skipped, no earlier step led here",
      });
      continue;
    }
    entries.push({
      ...base,
      at: run.start,
      id: `${id}:start`,
      level: "info",
      message: node.kind === "approval" ? "Waiting for approval" : "Started",
    });
    if (elapsedMs < run.end) {
      continue;
    }
    const took = run.end - run.start;
    let message = `Completed in ${formatDuration(took)}`;
    if (run.status === "error") {
      message = `Failed after ${formatDuration(took)}`;
    } else if (node.branch !== undefined) {
      message = `Took the "${branchLabel(node)}" branch`;
    }
    entries.push({
      ...base,
      at: run.end,
      id: `${id}:end`,
      level: run.status === "error" ? "error" : "success",
      message,
    });
  }
  return entries.sort((a, b) => a.at - b.at);
};

const getEdgeMidX = (
  from: WorkflowPoint,
  to: WorkflowPoint,
  radius: number,
  offset: number
) => {
  const room = Math.max(0, Math.abs(to.x - from.x) / 2 - radius * 2);
  return (from.x + to.x) / 2 + Math.max(-room, Math.min(room, offset));
};

export const getEdgePath = (
  from: WorkflowPoint,
  to: WorkflowPoint,
  radius = WORKFLOW_EDGE_RADIUS,
  offset = 0
) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const midX = getEdgeMidX(from, to, radius, offset);
  const r = Math.min(
    radius,
    Math.abs(dy) / 2,
    Math.abs(midX - from.x),
    Math.abs(to.x - midX)
  );
  if (r < 0.5) {
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  }
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  const sweep = sx * sy > 0 ? 1 : 0;
  return [
    `M ${from.x} ${from.y}`,
    `L ${midX - sx * r} ${from.y}`,
    `A ${r} ${r} 0 0 ${sweep} ${midX} ${from.y + sy * r}`,
    `L ${midX} ${to.y - sy * r}`,
    `A ${r} ${r} 0 0 ${1 - sweep} ${midX + sx * r} ${to.y}`,
    `L ${to.x} ${to.y}`,
  ].join(" ");
};

export const getFlowEdgePath = (
  source: WorkflowAnchor,
  target: WorkflowAnchor,
  reverse = false,
  offset = 0
): [string, number, number] => {
  const [from, to] = reverse ? [target, source] : [source, target];
  if (target.x > source.x) {
    return [
      getEdgePath(from, to, WORKFLOW_EDGE_RADIUS, offset),
      getEdgeMidX(from, to, WORKFLOW_EDGE_RADIUS, offset),
      (source.y + target.y) / 2,
    ];
  }
  const [path, labelX, labelY] = getSmoothStepPath({
    ...WORKFLOW_EDGE_STEP_OPTIONS,
    sourcePosition: from.position,
    sourceX: from.x,
    sourceY: from.y,
    targetPosition: to.position,
    targetX: to.x,
    targetY: to.y,
  });
  return [path, labelX, labelY];
};

const getHandleAnchor = (
  state: ReactFlowState,
  nodeId: string,
  type: "source" | "target",
  handleId?: string | null
) => {
  const node = state.nodeLookup.get(nodeId);
  const handle = node?.internals.handleBounds?.[type]?.find(
    (item) => item.id === handleId
  );
  if (!(node && handle)) {
    return;
  }
  const { x, y } = node.internals.positionAbsolute;
  return {
    x: x + handle.x + (type === "source" ? handle.width : 0),
    y: y + handle.y + handle.height / 2,
  };
};

export const getEdgeLaneOffset = (state: ReactFlowState, edgeId: string) => {
  const edge = state.edgeLookup.get(edgeId);
  if (!edge) {
    return 0;
  }
  const lanes: WorkflowEdgeLane[] = [];
  for (const item of state.edges) {
    if (item.target !== edge.target) {
      continue;
    }
    const from = getHandleAnchor(
      state,
      item.source,
      "source",
      item.sourceHandle
    );
    const to = getHandleAnchor(state, item.target, "target", item.targetHandle);
    if (from && to && to.x > from.x && to.y !== from.y) {
      lanes.push({ down: to.y > from.y, from, id: item.id, to });
    }
  }
  const own = lanes.find((lane) => lane.id === edgeId);
  if (!own) {
    return 0;
  }
  const sign = own.down ? 1 : -1;
  const group = lanes
    .filter((lane) => lane.down === own.down)
    .toSorted(
      (a, b) => sign * (a.to.y - b.to.y) || sign * (a.from.y - b.from.y)
    );
  const rank = group.findIndex((lane) => lane.id === edgeId);
  return ((group.length - 1) / 2 - rank) * WORKFLOW_EDGE_LANE_GAP;
};

export const createNodeFromBlock = (
  block: WorkflowBlock,
  position: WorkflowPoint
): WorkflowNodeData => ({
  branch:
    block.outputs && block.outputs.length > 1
      ? block.outputs[0]?.id
      : undefined,
  description: block.description,
  durationMs: block.durationMs,
  id: `${block.id}-${Date.now().toString(36)}`,
  inputs: block.inputs,
  kind: block.kind,
  logo: block.logo,
  model: block.model,
  outputs: block.outputs,
  position,
  title: block.title,
});
