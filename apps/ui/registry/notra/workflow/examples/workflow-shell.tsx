import { Badge } from "@/components/ui/badge";

import {
  WorkflowShell,
  WorkflowShellCard,
  WorkflowShellHeader,
} from "../components/workflow-shell";

export default function WorkflowShellExample() {
  return (
    <WorkflowShell className="w-full max-w-sm">
      <WorkflowShellHeader className="justify-between">
        AI visibility
        <Badge variant="outline">Last 7 days</Badge>
      </WorkflowShellHeader>
      <WorkflowShellCard className="flex flex-col gap-1 p-4">
        <span className="text-muted-foreground text-xs">Share of voice</span>
        <span className="text-3xl leading-none font-semibold tracking-tight tabular-nums">
          38.2%
        </span>
      </WorkflowShellCard>
      <div className="text-muted-foreground flex h-9 items-center px-3 text-xs">
        Up 4.1 points from last week
      </div>
    </WorkflowShell>
  );
}
