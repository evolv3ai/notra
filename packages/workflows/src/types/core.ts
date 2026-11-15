import type * as z from "zod";

import type {
  CompiledWorkflowNode,
  WorkflowNodeKind,
  WorkflowPort,
  WorkflowRule,
} from "./graph";
import type { WorkflowInterpreterEffects } from "./interpreter";
import type { WorkflowNodeOutcome, WorkflowScope } from "./run";

export interface WorkflowCoreBlockContext {
  node: CompiledWorkflowNode;
  config: Record<string, unknown>;
  scope: WorkflowScope;
  effects: WorkflowInterpreterEffects;
}

export interface WorkflowCoreBlock {
  kind: WorkflowNodeKind;
  configSchema: z.ZodType;
  outputs: (config: unknown) => WorkflowPort[] | undefined;
  run: (context: WorkflowCoreBlockContext) => Promise<WorkflowNodeOutcome>;
}

export interface WorkflowBranchCase {
  id: string;
  rule: WorkflowRule;
}
