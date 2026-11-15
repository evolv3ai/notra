import { log } from "@notra/ai/evlog";
import type { WorkflowBlockCallResult } from "@notra/workflows/types/run";
import {
  errorMessage,
  WorkflowConfigError,
} from "@notra/workflows/utils/errors";
import { FatalError, getStepMetadata } from "workflow";

import { WORKFLOW_RUN_STOPPED_MESSAGE } from "@/constants/workflow-engine";
import { workflowBlockRegistry } from "@/lib/workflow-engine/blocks";
import {
  isWorkflowRunStopped,
  markWorkflowNodeStep,
} from "@/lib/workflow-engine/store";
import type { WorkflowNodeStepInput } from "@/types/workflow-engine";

export async function executeWorkflowNode(
  input: WorkflowNodeStepInput,
  maxRetries: number
): Promise<WorkflowBlockCallResult> {
  const { attempt } = getStepMetadata();
  const { call, node } = input;
  const block = workflowBlockRegistry.get(node.type);
  const context = {
    organizationId: input.organizationId,
    runId: input.runId,
    node,
    config: input.config,
    failure: input.failure,
    lastAttempt: attempt > maxRetries,
    idempotencyKey: `${input.runId}:${node.id}`,
    state: call.state,
  };
  const isFinal = (error: unknown) =>
    attempt > maxRetries ||
    FatalError.is(error) ||
    error instanceof WorkflowConfigError;
  const logFailure = (step: string, error: unknown) =>
    log.error({
      event: "workflow.node.failed",
      runId: input.runId,
      nodeId: node.id,
      step,
      error: errorMessage(error),
    });

  if ("finalize" in call) {
    try {
      await block?.finalize?.({ ...context, outcome: call.finalize });
    } catch (error) {
      if (!isFinal(error)) {
        throw error;
      }
      logFailure("finally", error);
    }
    return call.finalize;
  }

  const step = block?.steps[call.step];
  if (!(block && step)) {
    return {
      status: "error",
      error: `No block "${node.type}" is registered`,
    };
  }
  if (step.id !== call.stepId) {
    return {
      status: "error",
      error: `"${node.title}" changed since this run started`,
    };
  }
  if (await isWorkflowRunStopped(input.runId)) {
    return { status: "halted", reason: WORKFLOW_RUN_STOPPED_MESSAGE };
  }
  const progress = (update: Parameters<typeof markWorkflowNodeStep>[2]) =>
    markWorkflowNodeStep(
      input,
      { id: step.id, index: call.step, attempt },
      update
    );
  await progress({ status: "running" });
  try {
    const result = await block.runStep(call.step, context);
    await progress({
      status: result.status === "halted" ? "halted" : "success",
      finished: true,
    });
    if (result.status === "next") {
      return { status: "next", state: { ...call.state, ...result.state } };
    }
    return result.status === "success"
      ? { status: "success", output: result.output, port: result.port ?? null }
      : result;
  } catch (error) {
    const message = errorMessage(error);
    if (!isFinal(error)) {
      await progress({ status: "retrying", error: message });
      throw error;
    }
    logFailure(step.id, error);
    await progress({ status: "error", error: message, finished: true });
    return { status: "error", error: message };
  }
}
