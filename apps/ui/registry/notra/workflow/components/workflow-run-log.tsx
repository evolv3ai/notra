import { cn } from "cn";

import { formatClock } from "../lib/workflow";
import type { WorkflowLogLevel, WorkflowRunLogProps } from "../types/workflow";

const LEVEL_CLASS: Record<WorkflowLogLevel, string> = {
  error: "bg-red-500",
  info: "bg-primary",
  skip: "bg-muted-foreground/40",
  success: "bg-emerald-500",
};

export const WorkflowRunLog = ({
  className,
  emptyLabel = "Run the workflow to see its log.",
  entries,
  ...props
}: WorkflowRunLogProps) => (
  <div
    className={cn(
      "flex flex-col font-mono text-[0.75rem] leading-5",
      className
    )}
    data-slot="workflow-run-log"
    role="log"
    {...props}
  >
    {entries.length === 0 ? (
      <p className="text-muted-foreground px-3 py-4 font-sans text-xs">
        {emptyLabel}
      </p>
    ) : (
      entries.map((entry) => (
        <div
          className="hover:bg-muted/60 motion-safe:animate-in motion-safe:fade-in-0 grid grid-cols-[4.5rem_0.5rem_minmax(0,1fr)] items-baseline gap-2.5 px-3 py-0.5"
          data-level={entry.level}
          data-slot="workflow-run-log-entry"
          key={entry.id}
        >
          <span className="text-muted-foreground tabular-nums">
            {formatClock(entry.at)}
          </span>
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 self-center rounded-full",
              LEVEL_CLASS[entry.level]
            )}
          />
          <span className="min-w-0 break-words">
            <span className="text-foreground font-medium">{entry.title}</span>
            <span
              className={cn(
                "text-muted-foreground",
                entry.level === "error" && "text-red-600 dark:text-red-400"
              )}
            >
              {" "}
              {entry.message}
            </span>
          </span>
        </div>
      ))
    )}
  </div>
);
