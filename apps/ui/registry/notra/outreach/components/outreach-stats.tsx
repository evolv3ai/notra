import {
  WorkflowShell,
  WorkflowShellCard,
} from "../../workflow/components/workflow-shell";
import type { OutreachStatsProps } from "../types/outreach";

export const OutreachStats = ({
  className,
  stats,
  ...props
}: OutreachStatsProps) =>
  stats.length > 0 ? (
    <WorkflowShell className={className} data-slot="outreach-stats" {...props}>
      <WorkflowShellCard className="bg-table-card-border grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-px overflow-hidden">
        {stats.map((stat) => (
          <div
            className="bg-table-card flex min-w-0 flex-col gap-1 p-4"
            key={stat.label}
          >
            <span className="text-muted-foreground truncate text-xs">
              {stat.label}
            </span>
            <span
              className="truncate text-2xl leading-tight font-semibold tracking-tight tabular-nums sm:text-3xl"
              title={stat.value}
            >
              {stat.value}
            </span>
            <span className="text-muted-foreground truncate text-[0.6875rem]">
              {stat.hint}
            </span>
          </div>
        ))}
      </WorkflowShellCard>
    </WorkflowShell>
  ) : null;
