import type * as z from "zod";

import {
  WORKFLOW_FAILURE_NODE_ID,
  WORKFLOW_TRIGGER_TYPE,
} from "../constants/graph";
import { workflowGraphSchema } from "../schemas/graph";
import type {
  CompiledWorkflowGraph,
  CompiledWorkflowNode,
  WorkflowGraph,
  WorkflowNode,
} from "../types/graph";
import type { WorkflowValidationIssue } from "../types/run";
import type { WorkflowValidationOptions } from "../types/validation";
import { WorkflowValidationError } from "../utils/errors";
import {
  collectReferences,
  hasReferences,
  parseReference,
  readPath,
} from "../utils/references";
import { getWorkflowCoreBlock } from "./core-blocks";
import { edgeSourcePort, getConnectablePorts } from "./ports";

function findCycleNodes(graph: WorkflowGraph) {
  const indegree = new Map(graph.nodes.map((node) => [node.id, 0]));
  for (const edge of graph.edges) {
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }
  const queue = [...indegree].filter(([, count]) => count === 0);
  const visited = new Set<string>();
  while (queue.length > 0) {
    const [nodeId] = queue.shift() ?? [];
    if (!nodeId || visited.has(nodeId)) {
      continue;
    }
    visited.add(nodeId);
    for (const edge of graph.edges.filter((item) => item.source === nodeId)) {
      const count = (indegree.get(edge.target) ?? 0) - 1;
      indegree.set(edge.target, count);
      if (count === 0) {
        queue.push([edge.target, 0]);
      }
    }
  }
  return graph.nodes
    .filter((node) => !visited.has(node.id))
    .map((node) => node.id);
}

function walk(
  graph: WorkflowGraph,
  nodeId: string,
  direction: "forward" | "backward"
) {
  const found = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.pop();
    for (const edge of graph.edges) {
      const [from, to] =
        direction === "forward"
          ? [edge.source, edge.target]
          : [edge.target, edge.source];
      if (from === current && !found.has(to)) {
        found.add(to);
        queue.push(to);
      }
    }
  }
  return found;
}

export function registeredBlock(
  options: WorkflowValidationOptions,
  type: string
) {
  return Object.hasOwn(options.blocks, type) ? options.blocks[type] : undefined;
}

function holdsReference(config: unknown, path: (string | number)[]) {
  return path.some((_, index) => {
    const value = readPath(config, path.slice(0, index + 1));
    return typeof value === "string" && hasReferences(value);
  });
}

function validateConfig(
  node: WorkflowNode,
  schema: z.ZodType,
  issues: WorkflowValidationIssue[]
) {
  const config = node.config ?? {};
  const parsed = schema.safeParse(config);
  if (parsed.success) {
    return;
  }
  for (const issue of parsed.error.issues) {
    const path = issue.path.filter(
      (segment): segment is string | number => typeof segment !== "symbol"
    );
    if (holdsReference(config, path)) {
      continue;
    }
    issues.push({
      code: "invalid_config",
      message: `"${node.title}" ${path.join(".") || "settings"}: ${issue.message}`,
      nodeId: node.id,
      path,
    });
  }
}

function compileNodes(
  graph: WorkflowGraph,
  options: WorkflowValidationOptions,
  issues: WorkflowValidationIssue[]
): CompiledWorkflowNode[] {
  const seen = new Set<string>();
  return graph.nodes.map((node) => {
    if (seen.has(node.id)) {
      issues.push({
        code: "duplicate_node",
        message: `Two steps share the id "${node.id}"`,
        nodeId: node.id,
      });
    }
    seen.add(node.id);
    const core = getWorkflowCoreBlock(node.type);
    const block = core
      ? { ...core, outputs: core.outputs(node.config ?? {}) }
      : registeredBlock(options, node.type);
    if (!block) {
      issues.push({
        code: "unknown_block",
        message: `"${node.title}" uses an unknown block "${node.type}"`,
        nodeId: node.id,
      });
      return { ...node, kind: "task" };
    }
    if (node.onError === "continue" && (block.outputs?.length ?? 0) > 1) {
      issues.push({
        code: "branch_continue",
        message: `"${node.title}" has several outputs, so when it fails it has to stop the run or take its error path`,
        nodeId: node.id,
      });
    }
    const before = issues.length;
    if (block.configSchema) {
      validateConfig(node, block.configSchema, issues);
    }
    if (block.kind === "switch" && !block.outputs && issues.length === before) {
      issues.push({
        code: "invalid_config",
        message: `"${node.title}" needs its cases written out, not read from a value`,
        nodeId: node.id,
        path: ["cases"],
      });
    }
    return {
      ...node,
      kind: block.kind,
      ...(block.outputs ? { outputs: block.outputs } : {}),
    };
  });
}

function validateEdges(
  graph: CompiledWorkflowGraph,
  issues: WorkflowValidationIssue[]
) {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const seenIds = new Set<string>();
  const seenConnections = new Set<string>();
  for (const edge of graph.edges) {
    if (seenIds.has(edge.id)) {
      issues.push({
        code: "duplicate_edge",
        message: `Two connections share the id "${edge.id}"`,
        edgeId: edge.id,
      });
    }
    seenIds.add(edge.id);
    const source = nodes.get(edge.source);
    const target = nodes.get(edge.target);
    if (!(source && target)) {
      issues.push({
        code: "dangling_edge",
        message: `Connection "${edge.id}" points at a step that doesn't exist`,
        edgeId: edge.id,
      });
      continue;
    }
    if (edge.source === edge.target) {
      issues.push({
        code: "self_edge",
        message: `"${source.title}" is connected to itself`,
        edgeId: edge.id,
      });
    }
    const sourcePort = edgeSourcePort(edge, source);
    if (!getConnectablePorts(source).some((port) => port.id === sourcePort)) {
      issues.push({
        code: "unknown_port",
        message: `"${source.title}" has no output "${sourcePort}"`,
        edgeId: edge.id,
      });
    }
    if (source.outputs && source.outputs.length > 1 && !edge.sourcePort) {
      issues.push({
        code: "missing_port",
        message: `A connection from "${source.title}" must say which output it leaves from`,
        edgeId: edge.id,
      });
    }
    const key = `${edge.source}:${sourcePort}->${edge.target}`;
    if (seenConnections.has(key)) {
      issues.push({
        code: "duplicate_connection",
        message: `"${source.title}" is connected to "${target.title}" twice`,
        edgeId: edge.id,
      });
    }
    seenConnections.add(key);
  }
}

function validateShape(
  graph: CompiledWorkflowGraph,
  issues: WorkflowValidationIssue[]
) {
  const triggers = graph.nodes.filter(
    (node) => node.type === WORKFLOW_TRIGGER_TYPE
  );
  if (triggers.length !== 1) {
    issues.push({
      code: "trigger_count",
      message:
        triggers.length === 0
          ? "A workflow needs a trigger"
          : "A workflow can only have one trigger",
    });
  }
  const cycle = findCycleNodes(graph);
  if (cycle.length > 0) {
    issues.push({
      code: "cycle",
      message: `Steps can't loop back on themselves: ${cycle.join(", ")}`,
      nodeId: cycle[0],
    });
  }
  const [trigger] = triggers;
  if (!trigger) {
    return;
  }
  if (graph.edges.some((edge) => edge.target === trigger.id)) {
    issues.push({
      code: "trigger_input",
      message: "Nothing can lead into the trigger",
      nodeId: trigger.id,
    });
  }
  const reached = walk(graph, trigger.id, "forward").add(trigger.id);
  for (const node of graph.nodes) {
    if (!reached.has(node.id)) {
      issues.push({
        code: "unreachable",
        message: `"${node.title}" isn't connected to the trigger`,
        nodeId: node.id,
      });
    }
  }
}

function validateOutput(
  graph: WorkflowGraph,
  issues: WorkflowValidationIssue[]
) {
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  for (const reference of collectReferences(graph.output)) {
    const parsed = parseReference(reference);
    if (!parsed || (parsed.nodeId && !nodeIds.has(parsed.nodeId))) {
      issues.push({
        code: "unknown_reference",
        message: `The workflow's result reads "${reference}", which doesn't exist`,
        path: ["output"],
      });
    }
  }
}

function validateReferences(
  graph: WorkflowGraph,
  issues: WorkflowValidationIssue[]
) {
  for (const node of graph.nodes) {
    const references = collectReferences(node.config);
    if (references.length === 0) {
      continue;
    }
    const ancestors = walk(graph, node.id, "backward");
    for (const reference of references) {
      const parsed = parseReference(reference);
      if (!parsed) {
        issues.push({
          code: "unknown_reference",
          message: `"${node.title}" reads "${reference}"; references start with trigger or nodes`,
          nodeId: node.id,
        });
        continue;
      }
      if (parsed.nodeId && !ancestors.has(parsed.nodeId)) {
        issues.push({
          code: "reference_order",
          message: `"${node.title}" reads "${parsed.nodeId}", which doesn't run before it`,
          nodeId: node.id,
        });
      }
    }
  }
}

function validateFailureHandler(
  graph: WorkflowGraph,
  options: WorkflowValidationOptions,
  issues: WorkflowValidationIssue[]
) {
  if (!graph.onFailure) {
    return;
  }
  const block = registeredBlock(options, graph.onFailure.type);
  if (!block) {
    issues.push({
      code: "unknown_block",
      message: `The failure handler uses an unknown block "${graph.onFailure.type}"`,
    });
    return;
  }
  const handler: WorkflowNode = {
    id: WORKFLOW_FAILURE_NODE_ID,
    type: graph.onFailure.type,
    title: "On failure",
    config: graph.onFailure.config ?? {},
  };
  if (block.configSchema) {
    validateConfig(handler, block.configSchema, issues);
  }
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  for (const reference of collectReferences(handler.config)) {
    const parsed = parseReference(reference);
    if (!parsed || (parsed.nodeId && !nodeIds.has(parsed.nodeId))) {
      issues.push({
        code: "unknown_reference",
        message: `"On failure" reads "${reference}", which isn't a step or trigger value`,
        nodeId: handler.id,
      });
    }
  }
}

export function inspectWorkflowGraph(
  input: WorkflowGraph,
  options: WorkflowValidationOptions
): { issues: WorkflowValidationIssue[]; graph: CompiledWorkflowGraph | null } {
  const parsed = workflowGraphSchema.safeParse(input);
  if (!parsed.success) {
    return {
      issues: parsed.error.issues.map((issue) => ({
        code: "invalid_graph",
        message: `${issue.path.join(".") || "graph"}: ${issue.message}`,
        path: issue.path.filter(
          (segment): segment is string | number => typeof segment !== "symbol"
        ),
      })),
      graph: null,
    };
  }
  const graph = parsed.data;
  const issues: WorkflowValidationIssue[] = [];
  const compiled: CompiledWorkflowGraph = {
    ...graph,
    nodes: compileNodes(graph, options, issues),
  };
  validateEdges(compiled, issues);
  validateShape(compiled, issues);
  validateReferences(graph, issues);
  validateOutput(graph, issues);
  validateFailureHandler(graph, options, issues);
  return { issues, graph: compiled };
}

export function validateWorkflowGraph(
  graph: WorkflowGraph,
  options: WorkflowValidationOptions
): WorkflowValidationIssue[] {
  return inspectWorkflowGraph(graph, options).issues;
}

export function compileWorkflowGraph(
  graph: WorkflowGraph,
  options: WorkflowValidationOptions
): CompiledWorkflowGraph {
  const inspected = inspectWorkflowGraph(graph, options);
  if (!inspected.graph || inspected.issues.length > 0) {
    throw new WorkflowValidationError(inspected.issues);
  }
  return inspected.graph;
}
