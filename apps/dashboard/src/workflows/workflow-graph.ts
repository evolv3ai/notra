import { runWorkflowBlockSteps } from "@notra/workflows/runtime/block-steps";
import {
  interpretWorkflowGraph,
  runWorkflowFailureHandler,
} from "@notra/workflows/runtime/interpreter";
import type { CompiledWorkflowGraph } from "@notra/workflows/types/graph";
import type { WorkflowInterpreterEffects } from "@notra/workflows/types/interpreter";
import type { WorkflowNodeOutcome } from "@notra/workflows/types/run";
import { errorMessage } from "@notra/workflows/utils/errors";
import { getWorkflowMetadata } from "workflow";

import type { WorkflowGraphRunPayload } from "@/types/workflow-engine";

import {
  executeSideEffectWorkflowNodeStep,
  executeWorkflowNodeStep,
  finishWorkflowRunStep,
  recordWorkflowNodesStep,
  startChildWorkflowRunStep,
  startWorkflowRunStep,
} from "./steps/workflow-graph-steps";

export async function workflowGraphWorkflow(
  payload: WorkflowGraphRunPayload
): Promise<void> {
  "use workflow";
  const { organizationId, bundle } = payload;
  const { workflowRunId } = getWorkflowMetadata();

  const runGraph = async (params: {
    runId: string;
    graph: CompiledWorkflowGraph | undefined;
    input: unknown;
    before?: () => Promise<void>;
  }): Promise<WorkflowNodeOutcome> => {
    const { runId, graph, input } = params;

    const effects: WorkflowInterpreterEffects = {
      runBlock: async (request) => {
        const execution = Object.hasOwn(payload.blocks, request.node.type)
          ? payload.blocks[request.node.type]
          : undefined;
        if (!execution) {
          return {
            status: "error",
            error: `No block "${request.node.type}" is registered`,
          };
        }
        return await runWorkflowBlockSteps({
          execution,
          call: (call, { sideEffect }) =>
            (sideEffect
              ? executeSideEffectWorkflowNodeStep
              : executeWorkflowNodeStep)({
              runId,
              organizationId,
              node: request.node,
              config: request.config,
              failure: request.failure,
              call,
            }),
        });
      },
      callWorkflow: async (request) => {
        const child = Object.hasOwn(bundle.workflows, request.workflow)
          ? bundle.workflows[request.workflow]
          : undefined;
        if (!child) {
          return {
            status: "error",
            error: `"${request.node.title}" calls a workflow this run didn't load: ${request.workflow}`,
          };
        }
        const childRunId = await startChildWorkflowRunStep({
          parentRunId: runId,
          rootRunId: payload.runId,
          parentNodeId: request.node.id,
          organizationId,
          workflowKey: request.workflow,
          graph: child,
          input: request.input,
          runtimeRunId: workflowRunId,
        });
        return await runGraph({
          runId: childRunId,
          graph: child,
          input: request.input,
        });
      },
      record: (events) =>
        recordWorkflowNodesStep(runId, organizationId, events),
    };

    let failure: { nodeId: string | null; error: string } | null;
    let output: unknown;
    try {
      await params.before?.();
      if (!graph) {
        throw new Error(`This run didn't load "${bundle.root}"`);
      }
      ({ failure, output } = await interpretWorkflowGraph({
        graph,
        trigger: input,
        effects,
      }));
    } catch (error) {
      failure = graph
        ? await runWorkflowFailureHandler({
            graph,
            trigger: input,
            effects,
            failure: { nodeId: null, error: errorMessage(error) },
          })
        : { nodeId: null, error: errorMessage(error) };
    }
    await finishWorkflowRunStep({
      runId,
      organizationId,
      status: failure ? "failed" : "completed",
      output,
      error: failure?.error,
      failedNodeId: failure?.nodeId ?? null,
    });
    return failure
      ? { status: "error", error: failure.error }
      : { status: "success", output };
  };

  await runGraph({
    runId: payload.runId,
    graph: Object.hasOwn(bundle.workflows, bundle.root)
      ? bundle.workflows[bundle.root]
      : undefined,
    input: payload.input,
    before: () => startWorkflowRunStep(payload.runId, workflowRunId),
  });
}
