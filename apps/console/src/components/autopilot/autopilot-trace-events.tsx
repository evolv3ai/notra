import { Badge } from "@notra/ui/components/ui/badge";

import type { AutopilotTraceEventsProps } from "@/types/autopilot";
import { autopilotRelatedUrl, autopilotTimestamp } from "@/utils/autopilot";

export function AutopilotTraceEvents({
  events,
  includeDetail,
}: AutopilotTraceEventsProps) {
  if (events.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No events recorded yet.</p>
    );
  }
  return (
    <ol className="divide-y rounded-lg border">
      {events.map((event) => {
        const relatedUrl = autopilotRelatedUrl(event.data?.url);
        return (
          <li key={event.id} className="grid gap-2 p-4">
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
              <time dateTime={event.createdAt}>
                {autopilotTimestamp(event.createdAt)}
              </time>
              <Badge
                variant={event.level === "error" ? "destructive" : "secondary"}
              >
                {event.level}
              </Badge>
              <span>{event.job ?? "Run"}</span>
              {event.internal ? <span>Admin only</span> : null}
            </div>
            <p className="text-sm break-words">{event.message}</p>
            {relatedUrl ? (
              <a
                className="w-fit text-sm underline underline-offset-4"
                href={relatedUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open related link
              </a>
            ) : null}
            {event.data ? (
              <pre className="bg-muted overflow-auto rounded-md p-3 text-xs">
                {JSON.stringify(event.data, null, 2)}
              </pre>
            ) : null}
            {includeDetail && event.detail ? (
              <details>
                <summary className="cursor-pointer text-sm">
                  Model / tool payload
                </summary>
                <pre className="bg-muted mt-2 max-h-96 overflow-auto rounded-md p-3 text-xs">
                  {JSON.stringify(event.detail, null, 2)}
                </pre>
              </details>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
