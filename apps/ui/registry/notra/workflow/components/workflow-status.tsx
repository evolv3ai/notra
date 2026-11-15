import { cn } from "cn";
import {
  CheckIcon,
  CircleDashedIcon,
  CircleIcon,
  DicesIcon,
  HourglassIcon,
  LoaderCircleIcon,
  MinusIcon,
  RulerIcon,
  XIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { WORKFLOW_STATUSES } from "../constants/workflow";
import {
  WORKFLOW_LED_CLASS,
  WORKFLOW_PILL_BOTTOM_CLASS,
  WORKFLOW_PILL_CLASS,
  WORKFLOW_PILL_TOP_CLASS,
} from "../constants/workflow-ui";
import type {
  WorkflowDeterminismBadgeProps,
  WorkflowStatusBadgeProps,
  WorkflowStatusGlyphProps,
  WorkflowStatusIndicatorProps,
  WorkflowStatusPillProps,
} from "../types/workflow";

const StatusGlyph = ({ status }: WorkflowStatusGlyphProps) => {
  switch (status) {
    case "running": {
      return <LoaderCircleIcon className="size-3.5 animate-spin" />;
    }
    case "waiting": {
      return <HourglassIcon className="size-3.5 motion-safe:animate-pulse" />;
    }
    case "success": {
      return <CheckIcon className="size-3.5" strokeWidth={2.5} />;
    }
    case "error": {
      return <XIcon className="size-3.5" strokeWidth={2.5} />;
    }
    case "skipped": {
      return <MinusIcon className="size-3.5" />;
    }
    case "queued": {
      return <CircleDashedIcon className="size-3.5" />;
    }
    default: {
      return <CircleIcon className="size-3.5" />;
    }
  }
};

export const WorkflowStatusIndicator = ({
  className,
  status,
  ...props
}: WorkflowStatusIndicatorProps) => (
  <span
    className={cn(
      "inline-flex size-4 shrink-0 items-center justify-center",
      WORKFLOW_STATUSES[status].className,
      className
    )}
    data-slot="workflow-status-indicator"
    data-status={status}
    {...props}
  >
    <StatusGlyph status={status} />
    <span className="sr-only">{WORKFLOW_STATUSES[status].label}</span>
  </span>
);

export const WorkflowStatusBadge = ({
  className,
  status,
  ...props
}: WorkflowStatusBadgeProps) => (
  <Badge
    className={cn("gap-1 pl-1", WORKFLOW_STATUSES[status].className, className)}
    data-slot="workflow-status-badge"
    data-status={status}
    variant="outline"
    {...props}
  >
    <StatusGlyph status={status} />
    {WORKFLOW_STATUSES[status].label}
  </Badge>
);

export const WorkflowDeterminismBadge = ({
  className,
  deterministic,
  ...props
}: WorkflowDeterminismBadgeProps) => (
  <Badge
    className={cn(
      "text-muted-foreground gap-1 font-normal",
      !deterministic &&
        "border-violet-500/30 text-violet-600 dark:text-violet-300",
      className
    )}
    data-slot="workflow-determinism-badge"
    title={
      deterministic
        ? "Same input, same output"
        : "Uses a language model, so the output can change between runs"
    }
    variant="outline"
    {...props}
  >
    {deterministic ? <RulerIcon /> : <DicesIcon />}
    {deterministic ? "Deterministic" : "Non-deterministic"}
  </Badge>
);

export const WorkflowStatusPill = ({
  className,
  status,
  ...props
}: WorkflowStatusPillProps) => (
  <span
    className={cn(WORKFLOW_PILL_CLASS, className)}
    data-slot="workflow-status-pill"
    data-status={status}
    title={WORKFLOW_STATUSES[status].label}
    {...props}
  >
    <span className={WORKFLOW_PILL_TOP_CLASS}>
      <span
        className={cn(
          WORKFLOW_LED_CLASS,
          WORKFLOW_STATUSES[status].ledClassName
        )}
      />
    </span>
    {status !== "idle" && (
      <span className={WORKFLOW_PILL_BOTTOM_CLASS}>
        <StatusGlyph status={status} />
      </span>
    )}
    <span className="sr-only">{WORKFLOW_STATUSES[status].label}</span>
  </span>
);
