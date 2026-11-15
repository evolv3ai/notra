"use client";

import { WorkflowRunButton } from "../components/workflow-run-button";
import { WorkflowRunTimeline } from "../components/workflow-run-timeline";
import {
  WorkflowShell,
  WorkflowShellCard,
  WorkflowShellHeader,
} from "../components/workflow-shell";
import { WorkflowTimer } from "../components/workflow-timer";
import { VISIBILITY_MONITOR_WORKFLOW } from "../constants/workflow-templates";
import { useWorkflowRun } from "../hooks/use-workflow-run";

const { edges, nodes } = VISIBILITY_MONITOR_WORKFLOW;

export default function WorkflowRunTimelineExample() {
  const run = useWorkflowRun(nodes, edges);
  return (
    <WorkflowShell className="w-full max-w-2xl">
      <WorkflowShellHeader className="justify-between">
        {VISIBILITY_MONITOR_WORKFLOW.title}
        <WorkflowRunButton
          onPlay={run.play}
          onStop={run.stop}
          phase={run.phase}
          progress={run.elapsedMs / run.totalMs}
        />
      </WorkflowShellHeader>
      <WorkflowShellCard className="p-4">
        <WorkflowRunTimeline
          elapsedMs={run.elapsedMs}
          nodes={nodes}
          phase={run.phase}
          schedule={run.schedule}
        />
      </WorkflowShellCard>
      <div className="flex h-9 items-center justify-end px-3">
        <WorkflowTimer ms={run.elapsedMs} running={run.phase === "running"} />
      </div>
    </WorkflowShell>
  );
}
