import { mock } from "bun:test";

import { compileWorkflowBundle } from "@notra/workflows/runtime/bundle";
import type { WorkflowDefinition } from "@notra/workflows/types/graph";
import type {
  WorkflowBlockRequest,
  WorkflowNodeEvent,
} from "@notra/workflows/types/interpreter";
import type {
  WorkflowNodeRunState,
  WorkflowScope,
} from "@notra/workflows/types/run";

import type {
  WorkflowChildRunStart,
  WorkflowNodeStepInput,
  WorkflowRunFinish,
} from "../../src/types/workflow-engine";

const RUNTIME_DEFAULT_MAX_RETRIES = 3;

type StepName =
  | "executeWorkflowNodeStep"
  | "executeSideEffectWorkflowNodeStep"
  | "recordWorkflowNodesStep"
  | "startWorkflowRunStep"
  | "startChildWorkflowRunStep"
  | "finishWorkflowRunStep";

export async function createWorkflowGraphRunner() {
  const actual = await import("workflow");
  const current = { attempt: 1, stepId: "", stepName: "", runtimeRunId: "" };
  mock.module("workflow", () => ({
    ...actual,
    getStepMetadata: () => ({
      attempt: current.attempt,
      stepId: current.stepId,
      stepName: current.stepName,
      stepStartedAt: new Date(),
    }),
    getWorkflowMetadata: () => ({ workflowRunId: current.runtimeRunId }),
  }));

  const { WORKFLOW_NODE_MAX_RETRIES } =
    await import("../../src/constants/workflow-engine");
  const { executeWorkflowNode } =
    await import("../../src/lib/workflow-engine/execute-node");
  const { workflowBlockRegistry } =
    await import("../../src/lib/workflow-engine/blocks");
  const store = await import("../../src/lib/workflow-engine/store");

  const hooks: {
    beforeStep?: (name: StepName, args: unknown[]) => void | Promise<void>;
    events: WorkflowNodeEvent[];
    finish: WorkflowRunFinish | null;
  } = { events: [], finish: null };

  const durable =
    <Args extends unknown[], Result>(
      name: StepName,
      maxRetries: number,
      body: (...args: Args) => Promise<Result>
    ) =>
    async (...args: Args): Promise<Result> => {
      const input = structuredClone(args);
      for (let attempt = 1; ; attempt += 1) {
        current.attempt = attempt;
        current.stepName = name;
        current.stepId = `${name}:${JSON.stringify(input).slice(0, 200)}`;
        try {
          await hooks.beforeStep?.(name, input);
          return structuredClone(await body(...input));
        } catch (error) {
          if (attempt > maxRetries) {
            throw error;
          }
        }
      }
    };

  mock.module("../../src/workflows/steps/workflow-graph-steps", () => ({
    executeWorkflowNodeStep: durable(
      "executeWorkflowNodeStep",
      WORKFLOW_NODE_MAX_RETRIES,
      (input: WorkflowNodeStepInput) =>
        executeWorkflowNode(input, WORKFLOW_NODE_MAX_RETRIES)
    ),
    executeSideEffectWorkflowNodeStep: durable(
      "executeSideEffectWorkflowNodeStep",
      0,
      (input: WorkflowNodeStepInput) => executeWorkflowNode(input, 0)
    ),
    recordWorkflowNodesStep: durable(
      "recordWorkflowNodesStep",
      RUNTIME_DEFAULT_MAX_RETRIES,
      async (
        runId: string,
        organizationId: string,
        events: WorkflowNodeEvent[]
      ) => {
        await store.recordWorkflowNodeEvents(runId, organizationId, events);
        hooks.events.push(...events);
      }
    ),
    startWorkflowRunStep: durable(
      "startWorkflowRunStep",
      RUNTIME_DEFAULT_MAX_RETRIES,
      (runId: string, runtimeRunId: string) =>
        store.markWorkflowRunStarted(runId, runtimeRunId)
    ),
    startChildWorkflowRunStep: durable(
      "startChildWorkflowRunStep",
      RUNTIME_DEFAULT_MAX_RETRIES,
      (start: WorkflowChildRunStart) => store.startChildWorkflowRunRecord(start)
    ),
    finishWorkflowRunStep: durable(
      "finishWorkflowRunStep",
      RUNTIME_DEFAULT_MAX_RETRIES,
      async (finish: WorkflowRunFinish) => {
        await store.finishWorkflowRunRecord(finish);
        hooks.finish = finish;
      }
    ),
  }));
  const { workflowGraphWorkflow } =
    await import("../../src/workflows/workflow-graph");

  return async function runGraph(params: {
    organizationId: string;
    definition: WorkflowDefinition;
    definitions?: WorkflowDefinition[];
    input: unknown;
    onBlock?: (request: WorkflowBlockRequest) => void | Promise<void>;
    beforeStep?: (name: StepName, args: unknown[]) => void | Promise<void>;
  }) {
    const bundle = compileWorkflowBundle(params.definition.key, {
      blocks: workflowBlockRegistry.byType(),
      definitions: {
        ...Object.fromEntries(
          [params.definition, ...(params.definitions ?? [])].map(
            (definition) => [definition.key, definition]
          )
        ),
      },
    });
    const runId = await store.createWorkflowRunRecord({
      organizationId: params.organizationId,
      workflowKey: params.definition.key,
      graph: bundle.workflows[bundle.root] ?? params.definition.graph,
      trigger: "test",
      input: params.input,
    });
    const calls: string[] = [];
    hooks.events = [];
    hooks.finish = null;
    hooks.beforeStep = async (name, args) => {
      const [input] = args as [WorkflowNodeStepInput];
      if (
        (name === "executeWorkflowNodeStep" ||
          name === "executeSideEffectWorkflowNodeStep") &&
        current.attempt === 1 &&
        "step" in input.call &&
        input.call.step === 0
      ) {
        calls.push(input.node.id);
        await params.onBlock?.(input);
      }
      await params.beforeStep?.(name, args);
    };
    current.runtimeRunId = `test-${runId}`;
    await workflowGraphWorkflow({
      runId,
      organizationId: params.organizationId,
      bundle,
      input: params.input,
      blocks: workflowBlockRegistry.execution(),
    });
    const nodes: Record<string, WorkflowNodeRunState> = {};
    for (const event of hooks.events) {
      nodes[event.nodeId] = {
        status: event.status,
        port: event.port,
        output: event.output,
        error: event.error,
        reason: event.reason,
      };
    }
    const finish = hooks.finish as WorkflowRunFinish | null;
    return {
      runId,
      calls,
      status: finish?.status,
      state: { nodes },
      scope: { trigger: params.input, nodes } satisfies WorkflowScope,
      failure:
        finish?.status === "failed"
          ? { nodeId: finish.failedNodeId ?? null, error: finish.error ?? "" }
          : null,
    };
  };
}
