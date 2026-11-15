import {
  WORKFLOW_DEFAULT_OUTPUT_PORT,
  WORKFLOW_ERROR_PORT,
} from "../constants/graph";
import type {
  CompiledWorkflowNode,
  WorkflowEdge,
  WorkflowPort,
} from "../types/graph";

export function getOutputPorts(
  node: Pick<CompiledWorkflowNode, "outputs">
): WorkflowPort[] {
  return node.outputs?.length
    ? node.outputs
    : [{ id: WORKFLOW_DEFAULT_OUTPUT_PORT }];
}

export function getConnectablePorts(
  node: Pick<CompiledWorkflowNode, "outputs" | "onError">
): WorkflowPort[] {
  const ports = getOutputPorts(node);
  return node.onError === "route"
    ? [...ports, { id: WORKFLOW_ERROR_PORT, label: "Failed" }]
    : ports;
}

export function edgeSourcePort(
  edge: WorkflowEdge,
  source: Pick<CompiledWorkflowNode, "outputs">
) {
  return (
    edge.sourcePort ??
    getOutputPorts(source)[0]?.id ??
    WORKFLOW_DEFAULT_OUTPUT_PORT
  );
}

export function isBranching(node: Pick<CompiledWorkflowNode, "outputs">) {
  return getOutputPorts(node).length > 1;
}
