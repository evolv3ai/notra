import type { WORKFLOW_RUN_NODE_STATUSES } from "@notra/db/constants/workflows";
import type { db } from "@notra/db/drizzle";
import type { WorkflowRunNodeStep } from "@notra/db/types/workflows";
import type {
  CompiledWorkflowBundle,
  CompiledWorkflowGraph,
  CompiledWorkflowNode,
  StoredWorkflowNode,
  WorkflowEdge,
  WorkflowPort,
} from "@notra/workflows/types/graph";
import type {
  WorkflowBlockCall,
  WorkflowBlockExecution,
} from "@notra/workflows/types/run";

export type WorkflowTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

export interface WorkflowGraphRunPayload {
  runId: string;
  organizationId: string;
  bundle: CompiledWorkflowBundle;
  input: unknown;
  blocks: Record<string, WorkflowBlockExecution>;
}

export interface WorkflowChildRunStart {
  parentRunId: string;
  rootRunId: string;
  parentNodeId: string;
  organizationId: string;
  workflowKey: string;
  graph: CompiledWorkflowGraph;
  input: unknown;
  runtimeRunId: string;
}

export interface WorkflowNodeStepInput {
  runId: string;
  organizationId: string;
  node: CompiledWorkflowNode;
  config: Record<string, unknown>;
  failure?: { error: string };
  call: WorkflowBlockCall;
}

export interface WorkflowRunFinish {
  runId: string;
  organizationId: string;
  status: "completed" | "failed";
  output?: unknown;
  error?: string;
  failedNodeId?: string | null;
}

export interface WorkflowRunViewStep {
  id: string;
  title: string;
  status: WorkflowRunNodeStep["status"] | null;
  attempts: number;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface WorkflowRunViewNode extends Omit<
  StoredWorkflowNode,
  "config" | "outputs"
> {
  logo: string | null;
  outputs: WorkflowPort[];
  status: (typeof WORKFLOW_RUN_NODE_STATUSES)[number] | null;
  port: string | null;
  output: unknown;
  error: string | null;
  reason: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  steps: WorkflowRunViewStep[];
}

interface WorkflowRunViewEdge extends WorkflowEdge {
  taken: boolean | null;
}

export interface WorkflowRunView {
  id: string;
  title: string;
  parentRunId: string | null;
  startedAt: Date | null;
  nodes: WorkflowRunViewNode[];
  edges: WorkflowRunViewEdge[];
}
