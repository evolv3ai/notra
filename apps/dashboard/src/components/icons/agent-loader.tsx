"use client";

import { cn } from "@notra/ui/lib/utils";
import { type CSSProperties, useLayoutEffect, useRef } from "react";

import { AGENT_ICON_DOTS, AGENT_LOADER_CYCLE_MS } from "@/constants/agent-icon";

const ORBIT_STEP_MS = AGENT_LOADER_CYCLE_MS / 8;

function dotClassName(active: boolean, orbit: number | null) {
  if (!active) {
    return undefined;
  }
  return orbit === null ? "agent-loader-core" : "agent-loader-dot";
}

/**
 * The agent mark with a light running clockwise around its outer ring while
 * the core breathes. Every loader shares one clock, so a loader that replaces
 * another mid-stream continues the same motion instead of restarting it.
 */
export function AgentLoader({
  active = true,
  className,
  label,
}: {
  active?: boolean;
  className?: string;
  label?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);

  useLayoutEffect(() => {
    if (!active) {
      return;
    }
    const now = document.timeline.currentTime;
    const elapsed = typeof now === "number" ? now : performance.now();
    ref.current?.style.setProperty(
      "--agent-loader-phase",
      `${String(-(elapsed % AGENT_LOADER_CYCLE_MS))}ms`
    );
  }, [active]);

  return (
    <svg
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn("size-4 shrink-0", className)}
      data-active={active || undefined}
      fill="currentColor"
      ref={ref}
      role={label ? "img" : undefined}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      {AGENT_ICON_DOTS.map(({ cx, cy, r, orbit }) => (
        <circle
          className={dotClassName(active, orbit)}
          cx={cx}
          cy={cy}
          key={`${cx}-${cy}`}
          r={r}
          style={
            orbit === null
              ? undefined
              : ({
                  "--agent-loader-offset": `${String(orbit * ORBIT_STEP_MS)}ms`,
                } as CSSProperties)
          }
        />
      ))}
    </svg>
  );
}
