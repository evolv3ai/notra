import type * as z from "zod";

import type {
  CompiledWorkflowNode,
  WorkflowNodeKind,
  WorkflowPort,
} from "./graph";
import type { WorkflowBlockExecution, WorkflowNodeOutcome } from "./run";

export type WorkflowBlockDefinition<Schema extends z.ZodType> = Omit<
  WorkflowBlockManifest,
  "steps"
> & { configSchema: Schema };

export interface WorkflowBlockRegistry {
  get: (type: string) => WorkflowBlock | undefined;
  byType: () => Record<string, WorkflowBlock>;
  execution: () => Record<string, WorkflowBlockExecution>;
}

interface WorkflowBlockStepManifest {
  id: string;
  title: string;
  sideEffect: boolean;
  optional: boolean;
}

export interface WorkflowBlockManifest {
  type: string;
  kind: WorkflowNodeKind;
  title: string;
  description?: string;
  logo?: string;
  outputs?: WorkflowPort[];
  steps: WorkflowBlockStepManifest[];
}

export interface WorkflowBlockContext<Config> {
  organizationId: string;
  runId: string;
  node: CompiledWorkflowNode;
  config: Config;
  failure?: { error: string };
  lastAttempt: boolean;
  idempotencyKey: string;
}

export type WorkflowBlockResult =
  | { status: "success"; output?: unknown; port?: string }
  | { status: "halted"; reason: string; output?: unknown };

export type WorkflowBlockState = Record<string, unknown>;

export type WorkflowBlockStepContext<
  Config,
  State extends WorkflowBlockState = WorkflowBlockState,
> = WorkflowBlockContext<Config> & { state: Partial<State> };

export type WorkflowBlockStepResult<
  State extends WorkflowBlockState = WorkflowBlockState,
> = WorkflowBlockResult | { status: "next"; state?: Partial<State> };

export interface WorkflowBlockStep<
  Config,
  State extends WorkflowBlockState = WorkflowBlockState,
> {
  id: string;
  title: string;
  sideEffect?: boolean;
  optional?: boolean;
  run: (
    context: WorkflowBlockStepContext<Config, State>
  ) => Promise<WorkflowBlockStepResult<State>>;
}

export type WorkflowBlockFinalizer<
  Config,
  State extends WorkflowBlockState = WorkflowBlockState,
> = (
  context: WorkflowBlockStepContext<Config, State> & {
    outcome: WorkflowNodeOutcome;
  }
) => Promise<void>;

export interface WorkflowBlock extends WorkflowBlockManifest {
  configSchema: z.ZodType;
  runStep: (
    index: number,
    context: WorkflowBlockStepContext<unknown>
  ) => Promise<WorkflowBlockStepResult>;
  finalize?: WorkflowBlockFinalizer<unknown>;
}
