import "@/workflows/runtime";
import type { WorkflowNodeEvent } from "@notra/workflows/types/interpreter";
import type { WorkflowBlockCallResult } from "@notra/workflows/types/run";

import { WORKFLOW_NODE_MAX_RETRIES } from "@/constants/workflow-engine";
import { executeWorkflowNode } from "@/lib/workflow-engine/execute-node";
import {
  finishWorkflowRunRecord,
  markWorkflowRunStarted,
  recordWorkflowNodeEvents,
  startChildWorkflowRunRecord,
} from "@/lib/workflow-engine/store";
import type {
  WorkflowChildRunStart,
  WorkflowNodeStepInput,
  WorkflowRunFinish,
} from "@/types/workflow-engine";

export async function executeWorkflowNodeStep(
  input: WorkflowNodeStepInput
): Promise<WorkflowBlockCallResult> {
  "use step";
  return await executeWorkflowNode(input, WORKFLOW_NODE_MAX_RETRIES);
}

executeWorkflowNodeStep.maxRetries = WORKFLOW_NODE_MAX_RETRIES;

export async function executeSideEffectWorkflowNodeStep(
  input: WorkflowNodeStepInput
): Promise<WorkflowBlockCallResult> {
  "use step";
  return await executeWorkflowNode(input, 0);
}

executeSideEffectWorkflowNodeStep.maxRetries = 0;

export async function recordWorkflowNodesStep(
  runId: string,
  organizationId: string,
  events: WorkflowNodeEvent[]
) {
  "use step";
  await recordWorkflowNodeEvents(runId, organizationId, events);
}

export async function startWorkflowRunStep(
  runId: string,
  runtimeRunId: string
) {
  "use step";
  await markWorkflowRunStarted(runId, runtimeRunId);
}

export async function startChildWorkflowRunStep(start: WorkflowChildRunStart) {
  "use step";
  return await startChildWorkflowRunRecord(start);
}

export async function finishWorkflowRunStep(finish: WorkflowRunFinish) {
  "use step";
  await finishWorkflowRunRecord(finish);
}
