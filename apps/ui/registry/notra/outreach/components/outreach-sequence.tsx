import { cn } from "cn";

import { OUTREACH_STEP_STATUSES } from "../constants/outreach";
import type { OutreachSequenceProps } from "../types/outreach";

export const OutreachSequence = ({
  className,
  steps,
  ...props
}: OutreachSequenceProps) => (
  <ol
    className={cn("flex flex-col", className)}
    data-slot="outreach-sequence"
    {...props}
  >
    {steps.map((step, index) => (
      <li
        className="relative grid grid-cols-[0.75rem_minmax(0,1fr)_auto] gap-3 pb-4 last:pb-0"
        data-status={step.status}
        key={step.id}
      >
        {index < steps.length - 1 && (
          <span
            aria-hidden="true"
            className="bg-border absolute top-4 bottom-0 left-[0.3125rem] w-px"
          />
        )}
        <span
          aria-hidden="true"
          className={cn(
            "mt-1 size-2.5 rounded-full",
            OUTREACH_STEP_STATUSES[step.status].className
          )}
        />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[0.8125rem] font-medium">
            {step.subject}
          </span>
          <span className="text-muted-foreground text-xs">
            {`Day ${step.day} · ${OUTREACH_STEP_STATUSES[step.status].label}`}
          </span>
        </span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {step.at}
        </span>
      </li>
    ))}
  </ol>
);
