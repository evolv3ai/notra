import type {
  WorkflowBlockCaller,
  WorkflowBlockCallResult,
  WorkflowBlockExecution,
  WorkflowNodeOutcome,
} from "../types/run";
import { errorMessage } from "../utils/errors";

export async function runWorkflowBlockSteps(params: {
  execution: WorkflowBlockExecution;
  call: WorkflowBlockCaller;
}): Promise<WorkflowNodeOutcome> {
  const { execution, call } = params;
  let state: Record<string, unknown> = {};
  let outcome: WorkflowNodeOutcome | undefined;
  for (const [step, options] of execution.steps.entries()) {
    const result = await call(
      { step, stepId: options.id, state },
      { sideEffect: options.sideEffect }
    ).catch((error: unknown): WorkflowBlockCallResult => ({
      status: "error",
      error: errorMessage(error),
    }));
    if (result.status === "next") {
      state = result.state;
    } else if (!(result.status === "error" && options.optional)) {
      outcome = result;
      break;
    }
  }
  outcome ??= { status: "success", output: state };
  if (execution.finalize) {
    await call({ finalize: outcome, state }, { sideEffect: false }).catch(
      () => undefined
    );
  }
  return outcome;
}
