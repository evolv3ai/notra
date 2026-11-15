import { cn } from "cn";

import { formatDuration } from "../lib/workflow";
import type { WorkflowRunHistoryProps } from "../types/workflow";
import { WorkflowStatusIndicator } from "./workflow-status";

export const WorkflowRunHistory = ({
  className,
  onSelect,
  runs,
  selectedId,
  ...props
}: WorkflowRunHistoryProps) => (
  <div
    className={cn("flex flex-col gap-0.5", className)}
    data-slot="workflow-run-history"
    {...props}
  >
    {runs.map((run) => (
      <button
        aria-current={run.id === selectedId || undefined}
        className="hover:bg-muted aria-current:bg-muted focus-visible:ring-ring/50 grid grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none focus-visible:ring-2"
        data-slot="workflow-run-history-item"
        key={run.id}
        onClick={() => onSelect?.(run.id)}
        type="button"
      >
        <WorkflowStatusIndicator status={run.status} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[0.8125rem] leading-5 font-medium">
            {run.id}
          </span>
          <span className="text-muted-foreground truncate text-[0.6875rem] leading-4">
            {run.trigger} · {run.startedAt}
          </span>
        </span>
        <span className="flex flex-col items-end">
          <span className="font-mono text-[0.6875rem] tabular-nums">
            {formatDuration(run.durationMs)}
          </span>
          <span className="text-muted-foreground text-[0.6875rem]">
            {run.steps} steps
          </span>
        </span>
      </button>
    ))}
  </div>
);
