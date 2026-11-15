import type { AutopilotTraceSummaryProps } from "@/types/autopilot";
import {
  autopilotDuration,
  autopilotRecordedTokens,
  autopilotTimestamp,
  hasMissingAutopilotHeartbeat,
} from "@/utils/autopilot";

export function AutopilotTraceSummary({ trace }: AutopilotTraceSummaryProps) {
  return (
    <>
      <dl className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-muted-foreground text-sm">Workspace</dt>
          <dd className="font-medium">
            {trace.run.organizationSlug}
            <span className="text-muted-foreground block font-mono text-xs break-all">
              {trace.run.organizationId}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Status / trigger</dt>
          <dd>
            {trace.run.status} · {trace.run.trigger}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Duration</dt>
          <dd className="tabular-nums">{autopilotDuration(trace.run)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Last heartbeat</dt>
          <dd className="text-sm tabular-nums">
            {autopilotTimestamp(trace.run.heartbeatAt)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">
            Recorded tokens{trace.truncated ? " (partial)" : ""}
          </dt>
          <dd className="tabular-nums">
            {autopilotRecordedTokens(trace.events).toLocaleString("en-US")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">Slack delivery</dt>
          <dd>{trace.run.slackMessageTs ? "Sent" : "No message recorded"}</dd>
        </div>
      </dl>
      {hasMissingAutopilotHeartbeat(trace.run) ? (
        <p role="status" className="rounded-lg border p-4 text-sm">
          Heartbeat missing for over five minutes. This run may have stopped
          unexpectedly.
        </p>
      ) : null}
      {trace.run.errorMessage ? (
        <p role="alert" className="rounded-lg border p-4 text-sm">
          {trace.run.errorMessage}
        </p>
      ) : null}
    </>
  );
}
