import { finishAutomationRun, startAutomationRun } from "@/lib/automation/runs";
import type {
  FinishAutomationRunInput,
  StartAutomationRunInput,
} from "@/types/automation/runs";

export async function startAutomationRunStep(
  input: StartAutomationRunInput
): Promise<void> {
  "use step";
  await startAutomationRun(input);
}

export async function finishAutomationRunStep(
  input: FinishAutomationRunInput
): Promise<void> {
  "use step";
  await finishAutomationRun(input);
}
