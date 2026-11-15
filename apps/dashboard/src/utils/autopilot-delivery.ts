import { createHash } from "node:crypto";

/** Deterministic UUID without leaking the internal run ID into Slack's dedupe key. */
export function autopilotSlackMessageId(runId: string) {
  const hex = createHash("sha256")
    .update(`autopilot-brief:${runId}`)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
