import { cn } from "cn";

import { formatDuration, getNodeState } from "../lib/workflow";
import type { WorkflowRunTimelineProps } from "../types/workflow";
import { WorkflowBlockIcon } from "./workflow-block-icon";

export const WorkflowRunTimeline = ({
  className,
  elapsedMs,
  nodes,
  phase,
  schedule,
  ...props
}: WorkflowRunTimelineProps) => {
  const total = Math.max(schedule.totalMs, 1);
  const percent = (ms: number) => `${(Math.min(ms, total) / total) * 100}%`;

  return (
    <div
      className={cn("flex flex-col gap-1 text-xs", className)}
      data-slot="workflow-run-timeline"
      {...props}
    >
      {schedule.order.map((id) => {
        const node = nodes.find((item) => item.id === id);
        const run = schedule.nodes[id];
        if (!(node && run)) {
          return null;
        }
        const state = getNodeState(node, schedule, phase, elapsedMs);
        const live = state.status === "running" || state.status === "waiting";
        const shown = phase === "idle" ? run.end - run.start : state.elapsedMs;

        return (
          <div
            className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_3rem] items-center gap-3"
            data-slot="workflow-run-timeline-row"
            data-status={state.status}
            key={id}
          >
            <span className="flex min-w-0 items-center gap-2">
              <WorkflowBlockIcon
                block={node}
                className="size-5 rounded [&_svg]:size-3"
              />
              <span className="truncate font-medium">{node.title}</span>
            </span>
            <span className="bg-muted relative h-5 overflow-hidden rounded-md">
              {run.status === "skipped" ? (
                <span
                  className="border-muted-foreground/30 absolute inset-y-1.5 border-t border-dashed"
                  style={{ left: percent(run.start), right: 0 }}
                />
              ) : (
                <>
                  <span
                    className="bg-foreground/[0.06] absolute inset-y-1 rounded"
                    style={{
                      left: percent(run.start),
                      width: percent(run.end - run.start),
                    }}
                  />
                  <span
                    className={cn(
                      "absolute inset-y-1 rounded transition-[width] duration-75",
                      run.status === "error" ? "bg-red-500" : "bg-primary",
                      live && "motion-safe:animate-pulse",
                      phase === "idle" && "opacity-25"
                    )}
                    style={{ left: percent(run.start), width: percent(shown) }}
                  />
                </>
              )}
              {phase === "running" && (
                <span
                  aria-hidden="true"
                  className="bg-foreground/50 absolute inset-y-0 w-px"
                  style={{ left: percent(elapsedMs) }}
                />
              )}
            </span>
            <span className="text-muted-foreground text-right font-mono text-[0.6875rem] tabular-nums">
              {run.status === "skipped" ? "–" : formatDuration(shown)}
            </span>
          </div>
        );
      })}
    </div>
  );
};
