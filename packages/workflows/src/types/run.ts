type WorkflowNodeRunStatus =
  | "pending"
  | "running"
  | "success"
  | "halted"
  | "error"
  | "skipped";

type WorkflowEdgeRunStatus = "pending" | "taken" | "skipped";

export interface WorkflowNodeRunState {
  status: WorkflowNodeRunStatus;
  port?: string | null;
  output?: unknown;
  error?: string;
  reason?: string;
}

export interface WorkflowRunState {
  nodes: Record<string, WorkflowNodeRunState>;
  edges: Record<string, WorkflowEdgeRunStatus>;
  failure: { nodeId: string; error: string } | null;
}

export type WorkflowNodeOutcome =
  | {
      status: "success";
      output?: unknown;
      port?: string | null;
      reason?: string;
    }
  | { status: "halted"; reason: string; output?: unknown }
  | { status: "error"; error: string };

export interface WorkflowScope {
  trigger: unknown;
  nodes: Record<string, Omit<WorkflowNodeRunState, "reason">>;
}

export interface WorkflowBlockExecution {
  steps: { id: string; sideEffect: boolean; optional: boolean }[];
  finalize: boolean;
}

export type WorkflowValidationCode =
  | "invalid_graph"
  | "duplicate_node"
  | "unknown_block"
  | "invalid_config"
  | "branch_continue"
  | "duplicate_edge"
  | "dangling_edge"
  | "self_edge"
  | "unknown_port"
  | "missing_port"
  | "duplicate_connection"
  | "trigger_count"
  | "trigger_input"
  | "cycle"
  | "unreachable"
  | "unknown_reference"
  | "reference_order"
  | "unknown_workflow"
  | "not_callable"
  | "not_schedulable"
  | "call_cycle"
  | "call_depth";

export interface WorkflowValidationIssue {
  code: WorkflowValidationCode;
  message: string;
  workflowKey?: string;
  nodeId?: string;
  edgeId?: string;
  path?: (string | number)[];
}

export type WorkflowBlockCall =
  | { step: number; stepId: string; state: Record<string, unknown> }
  | { finalize: WorkflowNodeOutcome; state: Record<string, unknown> };

export type WorkflowBlockCallResult =
  | { status: "next"; state: Record<string, unknown> }
  | WorkflowNodeOutcome;

export type WorkflowBlockCaller = (
  call: WorkflowBlockCall,
  options: { sideEffect: boolean }
) => Promise<WorkflowBlockCallResult>;
