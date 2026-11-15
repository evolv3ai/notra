export const SLACK_STOP_ACTION_ID = "notra_stop_turn";
export const SLACK_LEAVE_ACTION_ID = "notra_leave_thread";
export const SLACK_CONTROLS_RENDERER_ID = "notra.slack.controls";
export const SLACK_CONTROLS_METADATA_TYPE = "notra_controls";

export const SLACK_CONTROLS_TEXT = {
  working: "Stop request · Stop replying here",
  waiting: "Stop replying here",
  idle: "Stop replying here",
} as const;

export const SLACK_CONTROL_MENTION_REGEX =
  /^(?:<@[^>]+>|@(?:notra|[UW][A-Z0-9]+))[,\s:]*/iu;

export const SLACK_STOP_MESSAGES = new Set([
  "stop",
  "stopp",
  "cancel",
  "abort",
]);
export const SLACK_LEAVE_MESSAGES = new Set([
  "stop replying",
  "stop replying here",
  "stop replying in this thread",
  "stop responding",
  "leave this thread",
  "unsubscribe",
  "nicht mehr antworten",
  "thread verlassen",
]);
