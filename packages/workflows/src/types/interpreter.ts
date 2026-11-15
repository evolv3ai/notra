import type { CompiledWorkflowGraph, CompiledWorkflowNode } from "./graph";
import type { WorkflowNodeOutcome, WorkflowRunState } from "./run";

export interface WorkflowNodeEvent {
  nodeId: string;
  status: "success" | "halted" | "error" | "skipped";
  port?: string | null;
  output?: unknown;
  error?: string;
  reason?: string;
  startedAt?: string;
  finishedAt: string;
}

export type WorkflowNodeSettlement = Omit<
  WorkflowNodeEvent,
  "nodeId" | "startedAt" | "finishedAt"
>;

export interface WorkflowBlockRequest {
  node: CompiledWorkflowNode;
  config: Record<string, unknown>;
  failure?: { error: string };
}

export interface WorkflowCallRequest {
  node: CompiledWorkflowNode;
  workflow: string;
  input: Record<string, unknown>;
}

export interface WorkflowInterpreterEffects {
  runBlock: (request: WorkflowBlockRequest) => Promise<WorkflowNodeOutcome>;
  callWorkflow: (request: WorkflowCallRequest) => Promise<WorkflowNodeOutcome>;
  record: (events: WorkflowNodeEvent[]) => Promise<void>;
}

export interface WorkflowGraphResult {
  state: WorkflowRunState;
  failure: { nodeId: string; error: string } | null;
  output: unknown;
}

export interface WorkflowInterpreterInput {
  graph: CompiledWorkflowGraph;
  trigger: unknown;
  effects: WorkflowInterpreterEffects;
}
