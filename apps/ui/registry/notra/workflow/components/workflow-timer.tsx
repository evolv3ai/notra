import { cn } from "cn";

import { formatDuration } from "../lib/workflow";
import type { WorkflowTimerProps } from "../types/workflow";

export const WorkflowTimer = ({
  className,
  ms,
  running,
  ...props
}: WorkflowTimerProps) => (
  <span
    className={cn(
      "text-muted-foreground inline-flex items-center gap-1 font-mono text-[0.6875rem] leading-4 tabular-nums",
      running && "text-foreground",
      className
    )}
    data-running={running || undefined}
    data-slot="workflow-timer"
    {...props}
  >
    {running && (
      <span
        aria-hidden="true"
        className="bg-primary size-1.5 rounded-full motion-safe:animate-pulse"
      />
    )}
    <time dateTime={`PT${(ms / 1000).toFixed(1)}S`}>{formatDuration(ms)}</time>
  </span>
);
