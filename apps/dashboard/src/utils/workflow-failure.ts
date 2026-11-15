import { WORKFLOW_FAILURE_CLASSIFICATIONS } from "@/constants/workflow-analytics";
import type { WorkflowFailureDetail } from "@/types/analytics/workflow-events";

const REASON_MAX_LENGTH = 500;

export function isConfigurationFailure(detail: WorkflowFailureDetail): boolean {
  return (
    detail.classification === WORKFLOW_FAILURE_CLASSIFICATIONS.CONFIGURATION
  );
}

export function buildFailureTelemetryFields(detail: WorkflowFailureDetail) {
  return {
    reason: detail.reason?.slice(0, REASON_MAX_LENGTH),
    errorCode: detail.errorCode,
    phase: detail.phase,
    classification: detail.classification,
    diagnostics: detail.diagnostics,
  };
}

export function formatFailureDiagnostics(
  diagnostics: WorkflowFailureDetail["diagnostics"]
): string | undefined {
  if (!diagnostics) {
    return undefined;
  }
  const entries = Object.entries(diagnostics).map(
    ([key, value]) => `${key}=${value}`
  );
  return entries.length > 0 ? entries.join(", ") : undefined;
}
