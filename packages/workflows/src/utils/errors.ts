import type * as z from "zod";

import type { WorkflowValidationIssue } from "../types/run";

export class WorkflowConfigError extends Error {
  override name = "WorkflowConfigError";
}

export class WorkflowValidationError extends Error {
  override name = "WorkflowValidationError";
  readonly issues: WorkflowValidationIssue[];

  constructor(issues: WorkflowValidationIssue[]) {
    super(
      `The workflow can't run: ${issues.map((issue) => issue.message).join("; ")}`
    );
    this.issues = issues;
  }
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function formatConfigIssues(title: string, error: z.ZodError) {
  return `"${title}" has invalid settings: ${error.issues
    .map((issue) => `${issue.path.join(".") || "config"} ${issue.message}`)
    .join(", ")}`;
}
