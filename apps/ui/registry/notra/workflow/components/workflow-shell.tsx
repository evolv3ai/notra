import { cn } from "cn";
import type { ComponentProps } from "react";

export const WorkflowShell = ({
  className,
  ...props
}: ComponentProps<"div">) => (
  <div
    className={cn(
      "border-table-shell-border bg-table-shell flex min-w-0 flex-col rounded-2xl border p-0.5",
      className
    )}
    data-slot="workflow-shell"
    {...props}
  />
);

export const WorkflowShellCard = ({
  className,
  ...props
}: ComponentProps<"div">) => (
  <div
    className={cn(
      "border-table-card-border bg-table-card shadow-table-card relative min-w-0 rounded-[14px] border",
      className
    )}
    data-slot="workflow-shell-card"
    {...props}
  />
);

export const WorkflowShellHeader = ({
  className,
  ...props
}: ComponentProps<"div">) => (
  <div
    className={cn(
      "flex min-h-10 min-w-0 flex-wrap items-center gap-2 px-3 py-1.5 text-sm font-medium",
      className
    )}
    data-slot="workflow-shell-header"
    {...props}
  />
);
