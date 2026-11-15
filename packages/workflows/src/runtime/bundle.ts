import {
  WORKFLOW_CALL_TYPE,
  WORKFLOW_MAX_CALL_DEPTH,
} from "../constants/graph";
import type {
  CompiledWorkflowBundle,
  CompiledWorkflowGraph,
  WorkflowDefinition,
  WorkflowNode,
} from "../types/graph";
import type { WorkflowValidationIssue } from "../types/run";
import type { WorkflowBundleOptions } from "../types/validation";
import { WorkflowValidationError } from "../utils/errors";
import { hasReferences } from "../utils/references";
import { inspectWorkflowGraph } from "./validate";

function definitionFor(options: WorkflowBundleOptions, key: string) {
  return Object.hasOwn(options.definitions, key)
    ? options.definitions[key]
    : undefined;
}

function calledWorkflow(node: WorkflowNode) {
  const workflow = node.config?.workflow;
  return typeof workflow === "string" && !hasReferences(workflow)
    ? workflow
    : null;
}

function inspectWorkflowBundle(
  rootKey: string,
  options: WorkflowBundleOptions
): { issues: WorkflowValidationIssue[]; bundle: CompiledWorkflowBundle } {
  const issues: WorkflowValidationIssue[] = [];
  const workflows: Record<string, CompiledWorkflowGraph> = {};
  const inspected = new Set<string>();
  const root = definitionFor(options, rootKey);
  if (!root) {
    issues.push({
      code: "unknown_workflow",
      message: `No workflow "${rootKey}" exists`,
      workflowKey: rootKey,
    });
  } else if (root.startedBy === "call") {
    issues.push({
      code: "not_schedulable",
      message: `"${root.title}" only runs when another workflow calls it`,
      workflowKey: rootKey,
    });
  }

  const visit = (definition: WorkflowDefinition, path: string[]) => {
    if (!inspected.has(definition.key)) {
      inspected.add(definition.key);
      const result = inspectWorkflowGraph(definition.graph, options);
      if (result.graph) {
        workflows[definition.key] = result.graph;
      }
      issues.push(
        ...result.issues.map((issue) => ({
          ...issue,
          workflowKey: definition.key,
        }))
      );
    }
    for (const node of definition.graph.nodes) {
      if (node.type !== WORKFLOW_CALL_TYPE) {
        continue;
      }
      const key = calledWorkflow(node);
      const target = key ? definitionFor(options, key) : undefined;
      const at = { nodeId: node.id, workflowKey: definition.key };
      if (!(key && target)) {
        issues.push({
          code: "unknown_workflow",
          message: `"${node.title}" calls a workflow that doesn't exist: ${key ?? "none named"}`,
          ...at,
        });
        continue;
      }
      if (target.startedBy === "schedule") {
        issues.push({
          code: "not_callable",
          message: `"${node.title}" calls "${target.title}", which only runs on its schedule`,
          ...at,
        });
        continue;
      }
      if (path.includes(key)) {
        issues.push({
          code: "call_cycle",
          message: `"${node.title}" calls "${target.title}", which is already running further up: ${[...path, key].join(" → ")}`,
          ...at,
        });
        continue;
      }
      if (path.length > WORKFLOW_MAX_CALL_DEPTH) {
        issues.push({
          code: "call_depth",
          message: `"${node.title}" calls workflows more than ${WORKFLOW_MAX_CALL_DEPTH} levels deep`,
          ...at,
        });
        continue;
      }
      visit(target, [...path, key]);
    }
  };
  if (root) {
    visit(root, [rootKey]);
  }
  const unique = [
    ...new Map(
      issues.map((issue) => [
        `${issue.workflowKey}:${issue.nodeId}:${issue.message}`,
        issue,
      ])
    ).values(),
  ];
  return { issues: unique, bundle: { root: rootKey, workflows } };
}

export function validateWorkflowBundle(
  rootKey: string,
  options: WorkflowBundleOptions
): WorkflowValidationIssue[] {
  return inspectWorkflowBundle(rootKey, options).issues;
}

export function compileWorkflowBundle(
  rootKey: string,
  options: WorkflowBundleOptions
): CompiledWorkflowBundle {
  const inspected = inspectWorkflowBundle(rootKey, options);
  if (inspected.issues.length > 0) {
    throw new WorkflowValidationError(inspected.issues);
  }
  return inspected.bundle;
}
