import type { WorkflowFailureDetail } from "@/types/analytics/workflow-events";

export interface WorkflowFailureAlertInput extends WorkflowFailureDetail {
  websiteUrl?: string;
  runId: string;
  workflow: string;
  organizationId?: string | null;
  projectId?: string | null;
}
