"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import { PlayIcon, RotateCcwIcon, SquareIcon } from "lucide-react";

import {
  WORKFLOW_RUN_LABELS,
  WORKFLOW_RUN_RING_LENGTH,
  WORKFLOW_RUN_RING_RADIUS,
} from "../constants/workflow-ui";
import type { WorkflowRunButtonProps } from "../types/workflow";

const runButtonVariants = cva(
  "group/run focus-visible:ring-ring/50 relative inline-flex h-8 shrink-0 items-center gap-2 rounded-full pr-3.5 pl-1 text-[0.8125rem] font-medium whitespace-nowrap transition-[background-color,box-shadow,color] duration-200 outline-none select-none focus-visible:ring-3 active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      phase: {
        done: "bg-foreground text-background hover:bg-foreground/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(0,0,0,0.2)]",
        idle: "bg-foreground text-background hover:bg-foreground/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(0,0,0,0.2)]",
        running:
          "bg-background text-foreground ring-foreground/15 hover:bg-muted ring-1",
      },
    },
  }
);

export const WorkflowRunButton = ({
  className,
  onClick,
  onPlay,
  onStop,
  phase,
  progress = 0,
  ...props
}: WorkflowRunButtonProps) => {
  const running = phase === "running";
  const ratio = Number.isFinite(progress)
    ? Math.min(1, Math.max(0, progress))
    : 0;
  let Icon = PlayIcon;
  if (running) {
    Icon = SquareIcon;
  } else if (phase === "done") {
    Icon = RotateCcwIcon;
  }

  return (
    <ButtonPrimitive
      className={cn(runButtonVariants({ phase }), className)}
      data-phase={phase}
      data-slot="workflow-run-button"
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          (running ? onStop : onPlay)?.();
        }
      }}
    >
      <span
        className={cn(
          "relative flex size-6 items-center justify-center rounded-full",
          running ? "text-primary" : "bg-background/15"
        )}
      >
        {running && (
          <svg
            aria-hidden="true"
            className="absolute inset-0 size-6 -rotate-90"
            viewBox="0 0 24 24"
          >
            <circle
              className="stroke-primary/20"
              cx={12}
              cy={12}
              fill="none"
              r={WORKFLOW_RUN_RING_RADIUS}
              strokeWidth={2}
            />
            <circle
              className="stroke-primary transition-[stroke-dashoffset] duration-100"
              cx={12}
              cy={12}
              fill="none"
              r={WORKFLOW_RUN_RING_RADIUS}
              strokeDasharray={WORKFLOW_RUN_RING_LENGTH}
              strokeDashoffset={WORKFLOW_RUN_RING_LENGTH * (1 - ratio)}
              strokeLinecap="round"
              strokeWidth={2}
            />
          </svg>
        )}
        <Icon
          className={cn(
            "size-3",
            running ? "fill-current" : "fill-current group-hover/run:scale-110",
            phase === "done" && "fill-none",
            "transition-transform"
          )}
        />
      </span>
      {WORKFLOW_RUN_LABELS[phase]}
    </ButtonPrimitive>
  );
};
