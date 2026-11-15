"use client";

import { Cancel01Icon, Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { CSSProperties } from "react";
import { useFormatter } from "use-intl";

import { useNow } from "@/lib/hooks/use-now";
import { cn } from "@/lib/utils";
import type { AutopilotRunTimelineProps } from "@/types/autopilot";
import { formatDuration } from "@/utils/autopilot-events";
import { runTimelinePhases } from "@/utils/autopilot-run-timeline";

/** The run's jobs as phase bars, like a deployment's build phases. */
export function AutopilotRunTimeline({
  run,
  events,
}: AutopilotRunTimelineProps) {
  const format = useFormatter();
  const now = useNow(run.status === "running");
  const phases = runTimelinePhases(events, run, now);
  const total = phases.reduce((sum, phase) => sum + phase.durationMs, 0);
  if (phases.length === 0) {
    return null;
  }

  return (
    <section aria-label="Timeline" className="space-y-3">
      <div className="flex min-h-7 items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Timeline</h2>
        <span className="text-muted-foreground text-xs tabular-nums">
          {formatDuration(total)} total
        </span>
      </div>
      <div className="overflow-x-auto pb-1">
        <ol className="flex min-w-xl gap-1.5">
          {phases.map((phase) => {
            let icon = null;
            if (phase.state === "active") {
              icon = Loading03Icon;
            } else if (phase.state === "failed") {
              icon = Cancel01Icon;
            }
            return (
              <li
                className="min-w-24 grow-(--phase-duration) basis-0 space-y-1.5"
                data-state={phase.state}
                key={phase.id}
                style={
                  {
                    "--phase-duration": Math.max(phase.durationMs, 1),
                  } as CSSProperties
                }
              >
                <div className="flex min-w-0 items-center gap-1.5 text-xs">
                  {icon ? (
                    <HugeiconsIcon
                      aria-hidden="true"
                      className={cn(
                        "size-3.5 shrink-0",
                        phase.state === "active" &&
                          "text-warning motion-safe:animate-spin",
                        phase.state === "failed" && "text-destructive"
                      )}
                      icon={icon}
                      strokeWidth={1.75}
                    />
                  ) : null}
                  <span className="min-w-0 truncate" title={phase.label}>
                    {phase.label}
                  </span>
                </div>
                <div
                  className={cn(
                    "relative isolate flex h-7 items-center justify-end overflow-hidden rounded-md border px-2 font-mono text-xs tabular-nums",
                    phase.state === "complete" &&
                      "border-geo-up/25 bg-geo-up/10 text-geo-up",
                    phase.state === "active" &&
                      "border-warning/30 bg-warning/10 text-warning before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-[repeating-linear-gradient(135deg,currentColor_0px,currentColor_3px,transparent_3px,transparent_8px)] before:opacity-15",
                    phase.state === "failed" &&
                      "border-destructive/35 bg-destructive/10 text-destructive"
                  )}
                >
                  {formatDuration(phase.durationMs)}
                </div>
                <div className="text-muted-foreground/70 min-h-4 font-mono text-xs tabular-nums">
                  <time dateTime={new Date(phase.startedAt).toISOString()}>
                    {format.dateTime(phase.startedAt, {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: false,
                    })}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
