import { AUTOPILOT_HEARTBEAT_WARNING_MS } from "@/constants/autopilot";
import type { AutopilotAdminRun, AutopilotAdminTrace } from "@/types/autopilot";

export function autopilotTimestamp(value: string) {
  return `${new Date(value).toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

export function autopilotDuration(run: AutopilotAdminRun, now = Date.now()) {
  const end = run.finishedAt ? new Date(run.finishedAt).getTime() : now;
  const seconds = Math.max(
    0,
    Math.floor((end - new Date(run.startedAt).getTime()) / 1000)
  );
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function hasMissingAutopilotHeartbeat(
  run: AutopilotAdminRun,
  now = Date.now()
) {
  return (
    run.status === "running" &&
    now - new Date(run.heartbeatAt).getTime() > AUTOPILOT_HEARTBEAT_WARNING_MS
  );
}

export function autopilotRecordedTokens(events: AutopilotAdminTrace["events"]) {
  return events.reduce((sum, event) => {
    const input = event.data?.inputTokens;
    const output = event.data?.outputTokens;
    return (
      sum +
      (typeof input === "number" ? input : 0) +
      (typeof output === "number" ? output : 0)
    );
  }, 0);
}

export function autopilotGitHubUrl(value: string | null) {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "github.com"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function autopilotRelatedUrl(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      (url.hostname === "github.com" || url.hostname === "app.slack.com")
      ? url.href
      : null;
  } catch {
    return null;
  }
}
