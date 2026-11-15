import type * as z from "zod";

import {
  WORKFLOW_CORE_TYPE_PREFIX,
  WORKFLOW_ERROR_PORT,
} from "../constants/graph";
import type {
  WorkflowBlock,
  WorkflowBlockContext,
  WorkflowBlockDefinition,
  WorkflowBlockFinalizer,
  WorkflowBlockRegistry,
  WorkflowBlockResult,
  WorkflowBlockState,
  WorkflowBlockStep,
  WorkflowBlockStepResult,
} from "../types/blocks";
import { formatConfigIssues, WorkflowConfigError } from "../utils/errors";

export function defineWorkflowBlock<Schema extends z.ZodType>(
  definition: WorkflowBlockDefinition<Schema> & {
    sideEffect?: boolean;
    run: (
      context: WorkflowBlockContext<z.output<Schema>>
    ) => Promise<WorkflowBlockResult>;
  }
): WorkflowBlock;
export function defineWorkflowBlock<
  Schema extends z.ZodType,
  State extends WorkflowBlockState,
>(
  definition: WorkflowBlockDefinition<Schema> & {
    steps: WorkflowBlockStep<z.output<Schema>, State>[];
    finally?: WorkflowBlockFinalizer<z.output<Schema>, State>;
  }
): WorkflowBlock;
export function defineWorkflowBlock(
  definition: WorkflowBlockDefinition<z.ZodType> & {
    sideEffect?: boolean;
    run?: (
      context: WorkflowBlockContext<unknown>
    ) => Promise<WorkflowBlockResult>;
    steps?: WorkflowBlockStep<unknown>[];
    finally?: WorkflowBlockFinalizer<unknown>;
  }
): WorkflowBlock {
  const {
    run,
    steps: stepList,
    finally: finalizer,
    sideEffect,
    configSchema,
    ...manifest
  } = definition;
  const steps: WorkflowBlockStep<unknown>[] =
    stepList ??
    (run ? [{ id: "run", title: manifest.title, sideEffect, run }] : []);
  if (steps.length === 0) {
    throw new Error(`Block "${manifest.type}" has no steps`);
  }
  assertUnique(
    manifest.type,
    "step",
    steps.map((step) => step.id)
  );
  const ports = (manifest.outputs ?? []).map((port) => port.id);
  assertUnique(manifest.type, "output", ports);
  if (ports.includes(WORKFLOW_ERROR_PORT)) {
    throw new Error(
      `Block "${manifest.type}" can't name an output "${WORKFLOW_ERROR_PORT}"; that one belongs to onError: "route"`
    );
  }
  const parse = (context: WorkflowBlockContext<unknown>) => {
    const parsed = configSchema.safeParse(context.config ?? {});
    if (!parsed.success) {
      throw new WorkflowConfigError(
        formatConfigIssues(context.node.title, parsed.error)
      );
    }
    return parsed.data;
  };
  return {
    ...manifest,
    configSchema,
    steps: steps.map((step) => ({
      id: step.id,
      title: step.title,
      sideEffect: step.sideEffect ?? false,
      optional: step.optional ?? false,
    })),
    runStep: async (index, context) => {
      const step = steps[index];
      if (!step) {
        throw new Error(`Block "${manifest.type}" has no step ${index + 1}`);
      }
      return await step.run({ ...context, config: parse(context) });
    },
    ...(finalizer
      ? {
          finalize: (context) =>
            finalizer({ ...context, config: parse(context) }),
        }
      : {}),
  };
}

function assertUnique(type: string, what: string, ids: string[]) {
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicate !== undefined) {
    throw new Error(`Block "${type}" has two ${what}s named "${duplicate}"`);
  }
}

export function createWorkflowBlockRegistry(
  blocks: WorkflowBlock[]
): WorkflowBlockRegistry {
  const byType = new Map<string, WorkflowBlock>();
  for (const block of blocks) {
    if (block.type.startsWith(WORKFLOW_CORE_TYPE_PREFIX)) {
      throw new Error(
        `"${block.type}" uses "${WORKFLOW_CORE_TYPE_PREFIX}", which is kept for the engine's own blocks`
      );
    }
    if (byType.has(block.type)) {
      throw new Error(`Block type "${block.type}" is registered twice`);
    }
    byType.set(block.type, block);
  }
  return {
    get: (type) => byType.get(type),
    byType: () => Object.fromEntries(byType),
    execution: () =>
      Object.fromEntries(
        [...byType].map(([type, block]) => [
          type,
          {
            steps: block.steps.map(({ id, sideEffect, optional }) => ({
              id,
              sideEffect,
              optional,
            })),
            finalize: block.finalize !== undefined,
          },
        ])
      ),
  };
}

export function succeed(output?: unknown, port?: string): WorkflowBlockResult {
  return port === undefined
    ? { status: "success", output }
    : { status: "success", output, port };
}

export function halt(reason: string, output?: unknown): WorkflowBlockResult {
  return { status: "halted", reason, output };
}

export function next<State extends WorkflowBlockState>(
  state?: Partial<State>
): WorkflowBlockStepResult<State> {
  return state === undefined ? { status: "next" } : { status: "next", state };
}

export function requireStepState<
  State extends WorkflowBlockState,
  Key extends keyof State,
>(state: Partial<State>, ...keys: Key[]): Pick<State, Key> {
  for (const key of keys) {
    if (state[key] === undefined) {
      throw new WorkflowConfigError(
        `A step before this one didn't leave "${String(key)}"`
      );
    }
  }
  return state as Pick<State, Key>;
}
