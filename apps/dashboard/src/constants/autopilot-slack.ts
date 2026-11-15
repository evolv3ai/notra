import type { AutopilotJobKind } from "@notra/db/types/autopilot";

export const AUTOPILOT_CREATE_SLACK_CHANNEL_VALUE = "__create_slack_channel__";

/** A 👍 merge or write request not settled by then is treated as stopped. */
export const AUTOPILOT_SLACK_ACTION_STALE_SECONDS = 300;

export const AUTOPILOT_SLACK_CHANNEL_HINT =
  "Invite the Notra app to this channel so it can send the daily brief.";

export const AUTOPILOT_SLACK_KIND_LABELS: Record<AutopilotJobKind, string> = {
  readiness: "Agent readiness",
  keywords: "Content opportunity",
  commits: "Recent GitHub work",
  prompts: "Tracked prompts",
  competitors: "Competitors",
};
