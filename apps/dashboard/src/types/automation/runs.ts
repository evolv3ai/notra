import type { AutomationRunStatus } from "@notra/schemas/dashboard/automation/runs";

/** One run of an automation, newest first in every list. */
export interface AutomationRun {
  id: string;
  automationId: string;
  /** What the run produced; `null` while running or when nothing was made. */
  title: string | null;
  status: AutomationRunStatus;
  errorMessage: string | null;
  createdAt: string;
  finishedAt: string | null;
  /** Started with "Run now" or "Send test" rather than by its trigger. */
  manual: boolean;
  /** The draft a content run created, if any. */
  postId: string | null;
}

export interface AutomationRunsPage {
  runs: AutomationRun[];
  nextCursor: string | null;
}

export interface AutomationRunCursor {
  startedAt: Date;
  id: string;
}

export interface StartAutomationRunInput {
  id: string;
  organizationId: string;
  automationId: string;
  manual: boolean;
}

export interface FinishAutomationRunInput {
  id: string;
  status: Exclude<AutomationRunStatus, "running">;
  title?: string | null;
  errorMessage?: string | null;
  postId?: string | null;
}

export interface ListAutomationRunsInput {
  organizationId: string;
  automationId?: string;
  status?: AutomationRunStatus;
  cursor?: string;
  limit: number;
}
