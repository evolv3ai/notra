export const AUTOPILOT_JOB_KINDS = [
  "readiness",
  "keywords",
  "commits",
  "prompts",
  "competitors",
] as const;

/**
 * The automations the dashboard lists: the jobs that open pull requests.
 * prompts suggests pauses on the Prompts page and competitors is a line in
 * the brief, so neither has pull requests or merges to count.
 */
export const AUTOPILOT_AUTOMATION_KINDS = [
  "readiness",
  "keywords",
  "commits",
] as const satisfies readonly (typeof AUTOPILOT_JOB_KINDS)[number][];

/**
 * manual, cron and onboarding run every job and never overlap. github (a
 * `@notra` mention or a merge) and suggestion (writing a dashboard
 * suggestion) handle one item and may run next to them.
 */
export const AUTOPILOT_RUN_TRIGGERS = [
  "manual",
  "cron",
  "onboarding",
  "github",
  "suggestion",
] as const;

/** Full runs; only one of these runs per workspace at a time. */
export const AUTOPILOT_SCHEDULED_TRIGGERS = [
  "manual",
  "cron",
  "onboarding",
] as const;

export const AUTOPILOT_RUN_STATUSES = [
  "running",
  "completed",
  "failed",
  "stopped",
] as const;

/**
 * suggested: Jev thought it was worth a post but not sure enough to open a
 * pull request. expired: Autopilot closed its own draft because nobody worked
 * on it; unlike dismissed it is not a "no", so the topic may come back.
 */
export const AUTOPILOT_FINDING_STATUSES = [
  "suggested",
  "open",
  "proposed",
  "merged",
  "dismissed",
  "expired",
  "failed",
] as const;

/**
 * skip: a gate stopped the job, decision: a filter or model picked something,
 * action: Autopilot changed something (LLM call, pull request), error: it failed.
 */
export const AUTOPILOT_EVENT_LEVELS = [
  "info",
  "skip",
  "decision",
  "action",
  "error",
] as const;
