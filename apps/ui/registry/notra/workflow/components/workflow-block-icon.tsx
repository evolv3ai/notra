import { cn } from "cn";

import { WORKFLOW_KINDS } from "../constants/workflow";
import { findModel } from "../lib/workflow";
import type { WorkflowBlockIconProps } from "../types/workflow";
import { WORKFLOW_LOGOS, WorkflowLogo } from "./workflow-logo";

export const WorkflowBlockIcon = ({
  block,
  className,
}: WorkflowBlockIconProps) => {
  const logo = block.logo ?? findModel(block.model)?.logo;
  const kind = WORKFLOW_KINDS[block.kind];
  const KindIcon = kind.icon;

  if (logo && WORKFLOW_LOGOS[logo].tile) {
    return (
      <span
        className={cn(
          "flex size-7 shrink-0 overflow-hidden rounded-md",
          className
        )}
        data-slot="workflow-block-icon"
      >
        <WorkflowLogo className="size-full" name={logo} />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md",
        logo
          ? "bg-background border-foreground/10 border"
          : cn("ring-1 ring-inset", kind.tileClassName),
        className
      )}
      data-slot="workflow-block-icon"
    >
      {logo ? (
        <WorkflowLogo className="size-[58%]" name={logo} />
      ) : (
        <KindIcon className="size-1/2" />
      )}
    </span>
  );
};
