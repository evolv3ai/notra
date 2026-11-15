import type {
  WORKFLOW_ERROR_POLICIES,
  WORKFLOW_NODE_KINDS,
  WORKFLOW_RULE_OPERATORS,
  WORKFLOW_STARTED_BY,
} from "../constants/graph";

export type WorkflowNodeKind = (typeof WORKFLOW_NODE_KINDS)[number];

type WorkflowErrorPolicy = (typeof WORKFLOW_ERROR_POLICIES)[number];

export type WorkflowStartedBy = (typeof WORKFLOW_STARTED_BY)[number];

export type WorkflowRuleOperator = (typeof WORKFLOW_RULE_OPERATORS)[number];

export interface WorkflowRule {
  subject: unknown;
  operator: WorkflowRuleOperator;
  value?: unknown;
}

export interface WorkflowPort {
  id: string;
  label?: string;
}

export interface WorkflowNode {
  id: string;
  type: string;
  title: string;
  description?: string;
  position?: { x: number; y: number };
  config?: Record<string, unknown>;
  onError?: WorkflowErrorPolicy;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  sourcePort?: string;
  target: string;
}

export interface WorkflowGraph<Node extends WorkflowNode = WorkflowNode> {
  nodes: Node[];
  edges: WorkflowEdge[];
  output?: Record<string, unknown>;
  onFailure?: { type: string; config?: Record<string, unknown> };
}

export interface CompiledWorkflowNode extends WorkflowNode {
  kind: WorkflowNodeKind;
  outputs?: WorkflowPort[];
}

export type CompiledWorkflowGraph = WorkflowGraph<CompiledWorkflowNode>;

export type StoredWorkflowNode = WorkflowNode &
  Partial<Pick<CompiledWorkflowNode, "kind" | "outputs">>;

export type StoredWorkflowGraph = WorkflowGraph<StoredWorkflowNode>;

export interface WorkflowDefinition {
  key: string;
  title: string;
  startedBy: WorkflowStartedBy;
  graph: WorkflowGraph;
}

export interface CompiledWorkflowBundle {
  root: string;
  workflows: Record<string, CompiledWorkflowGraph>;
}
