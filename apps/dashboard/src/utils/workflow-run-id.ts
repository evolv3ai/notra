import { getWorkflowMetadata } from "workflow";

export function getCurrentWorkflowRunId(): string | undefined {
  try {
    return getWorkflowMetadata().workflowRunId;
  } catch {
    return undefined;
  }
}
