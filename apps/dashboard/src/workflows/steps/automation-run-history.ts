import type {
  FinishAutomationRunInput,
  StartAutomationRunInput,
} from "@/types/automation/runs";

import {
  finishAutomationRunStep,
  startAutomationRunStep,
} from "./automation-run-steps";

/**
 * Run history is bookkeeping: a database hiccup must not fail or change the
 * outcome of the content run itself. Deliberately not steps, so a rejection is
 * swallowed at the workflow level after the step's own retries.
 */
async function settle(task: Promise<void>, label: string) {
  const [result] = await Promise.allSettled([task]);
  if (result?.status === "rejected") {
    console.error(`[AutomationRuns] Failed to ${label}`, result.reason);
  }
}

export function recordAutomationRunStart(input: StartAutomationRunInput) {
  return settle(startAutomationRunStep(input), "record run start");
}

export function recordAutomationRunFinish(input: FinishAutomationRunInput) {
  return settle(finishAutomationRunStep(input), "record run result");
}
