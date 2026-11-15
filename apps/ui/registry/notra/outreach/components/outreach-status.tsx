import { cn } from "cn";

import { Badge } from "@/components/ui/badge";

import {
  WORKFLOW_LOGOS,
  WorkflowLogo,
} from "../../workflow/components/workflow-logo";
import { OUTREACH_STATUSES } from "../constants/outreach";
import type {
  OutreachCitationsProps,
  OutreachStatusBadgeProps,
} from "../types/outreach";

export const OutreachStatusBadge = ({
  className,
  status,
  ...props
}: OutreachStatusBadgeProps) => (
  <Badge
    className={cn("gap-1.5", OUTREACH_STATUSES[status].className, className)}
    data-slot="outreach-status-badge"
    data-status={status}
    variant="outline"
    {...props}
  >
    <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
    {OUTREACH_STATUSES[status].label}
  </Badge>
);

export const OutreachCitations = ({
  citations,
  className,
  ...props
}: OutreachCitationsProps) => {
  const prompts = citations.reduce(
    (sum, citation) => sum + citation.prompts,
    0
  );
  return (
    <span
      className={cn("inline-flex items-center gap-2", className)}
      data-slot="outreach-citations"
      title={citations
        .map(
          (citation) =>
            `${WORKFLOW_LOGOS[citation.engine].label}: ${citation.prompts} prompts`
        )
        .join(", ")}
      {...props}
    >
      <span className="flex -space-x-1">
        {citations.map((citation) => (
          <span
            className="bg-background ring-foreground/10 flex size-5 items-center justify-center rounded-full ring-1"
            key={citation.engine}
          >
            <WorkflowLogo className="size-3" name={citation.engine} />
          </span>
        ))}
      </span>
      <span className="text-muted-foreground text-xs tabular-nums">
        {prompts} prompts
      </span>
    </span>
  );
};
