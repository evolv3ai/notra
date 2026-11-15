import { compileWorkflowBundle } from "@notra/workflows/runtime/bundle";
import type { CompiledWorkflowBundle } from "@notra/workflows/types/graph";
import { errorMessage } from "@notra/workflows/utils/errors";

import { workflowBlockRegistry } from "@/lib/workflow-engine/blocks";
import { workflowDefinitions } from "@/lib/workflow-engine/definitions/autopilot";
import {
  createWorkflowRunRecord,
  markWorkflowRunLaunchFailed,
} from "@/lib/workflow-engine/store";
import { startWorkflowGraphRun } from "@/lib/workflows/start";

export async function startWorkflowRun(params: {
  runId: string;
  organizationId: string;
  workflowKey: string;
  trigger: string;
  input: unknown;
}) {
  const { organizationId, workflowKey, trigger, input } = params;
  let bundle: CompiledWorkflowBundle | null = null;
  let invalid: unknown = null;
  try {
    bundle = compileWorkflowBundle(workflowKey, {
      definitions: workflowDefinitions,
      blocks: workflowBlockRegistry.byType(),
    });
  } catch (error) {
    invalid = error;
  }
  const runId = await createWorkflowRunRecord({
    id: params.runId,
    organizationId,
    workflowKey,
    graph: bundle?.workflows[workflowKey] ??
      workflowDefinitions[workflowKey]?.graph ?? { nodes: [], edges: [] },
    trigger,
    input,
  });
  try {
    if (!bundle) {
      throw invalid;
    }
    await startWorkflowGraphRun(
      {
        runId,
        organizationId,
        bundle,
        input,
        blocks: workflowBlockRegistry.execution(),
      },
      trigger
    );
    return runId;
  } catch (error) {
    await markWorkflowRunLaunchFailed(runId, errorMessage(error));
    throw error;
  }
}
