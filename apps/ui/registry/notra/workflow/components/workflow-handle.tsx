import { Handle, Position } from "@xyflow/react";
import { cn } from "cn";

import type { WorkflowHandleProps } from "../types/workflow";

export const WorkflowHandle = ({
  active,
  className,
  connectable,
  portId,
  type,
}: WorkflowHandleProps) => {
  if (connectable) {
    return (
      <Handle
        className={cn(
          "bg-table-card! border-muted-foreground! ring-background z-10 size-2.5! rounded-full! border-2! ring-2 transition-colors duration-200",
          type === "target" ? "-left-[3.5px]!" : "-right-[3.5px]!",
          active && "border-primary! bg-primary!",
          type === "source" && "after:absolute after:-inset-2",
          className
        )}
        data-active={active || undefined}
        data-slot="workflow-handle"
        id={portId}
        position={type === "target" ? Position.Left : Position.Right}
        type={type}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-table-card border-muted-foreground ring-background absolute top-1/2 z-10 size-2.5 -translate-y-1/2 rounded-full border-2 ring-2 transition-colors duration-200",
        type === "target" ? "-left-[8.5px]" : "-right-[8.5px]",
        active && "border-primary bg-primary",
        className
      )}
      data-active={active || undefined}
      data-slot="workflow-handle"
    />
  );
};
