"use client";

import { useMemo, useState } from "react";

import { WorkflowRunButton } from "../components/workflow-run-button";
import { WorkflowRunHistory } from "../components/workflow-run-history";
import { WorkflowRunLog } from "../components/workflow-run-log";
import { WorkflowRunTimeline } from "../components/workflow-run-timeline";
import {
  WorkflowShell,
  WorkflowShellCard,
  WorkflowShellHeader,
} from "../components/workflow-shell";
import { WorkflowStatusBadge } from "../components/workflow-status";
import { WorkflowTimer } from "../components/workflow-timer";
import { WORKFLOW_RUNS } from "../constants/workflow-runs";
import { LISTICLE_OUTREACH_WORKFLOW } from "../constants/workflow-templates";
import { useWorkflowRun } from "../hooks/use-workflow-run";
import { getRunLog, getRunOrder } from "../lib/workflow";
import type { WorkflowNodeStatus } from "../types/workflow";

const { edges } = LISTICLE_OUTREACH_WORKFLOW;
const ORDER = getRunOrder(LISTICLE_OUTREACH_WORKFLOW.nodes, edges);

export default function WorkflowRuns() {
  const [selected, setSelected] = useState(WORKFLOW_RUNS[0]?.id);
  const summary = WORKFLOW_RUNS.find((item) => item.id === selected);
  const failAt = summary?.status === "error" ? ORDER[summary.steps - 1] : "";
  const nodes = useMemo(
    () =>
      LISTICLE_OUTREACH_WORKFLOW.nodes.map((node) =>
        node.id === failAt ? { ...node, fail: true } : node
      ),
    [failAt]
  );
  const run = useWorkflowRun(nodes, edges);
  const log = getRunLog(nodes, run.schedule, run.phase, run.elapsedMs);
  let status: WorkflowNodeStatus = summary?.status ?? "idle";
  if (run.phase === "running") {
    status = "running";
  } else if (run.phase === "done") {
    status = failAt ? "error" : "success";
  }

  return (
    <WorkflowShell className="w-full">
      <WorkflowShellHeader className="gap-3">
        <span className="min-w-0 truncate">
          {LISTICLE_OUTREACH_WORKFLOW.title} · {selected}
        </span>
        <WorkflowStatusBadge status={status} />
        <div className="ml-auto flex items-center gap-3">
          <WorkflowTimer ms={run.elapsedMs} running={run.phase === "running"} />
          <WorkflowRunButton
            onPlay={run.play}
            onStop={run.stop}
            phase={run.phase}
            progress={run.elapsedMs / run.totalMs}
          />
        </div>
      </WorkflowShellHeader>
      <WorkflowShellCard className="grid overflow-hidden md:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="border-table-card-border flex min-w-0 flex-col gap-1 border-b p-1.5 md:border-r md:border-b-0">
          <h3 className="text-muted-foreground px-2.5 pt-1.5 pb-1 text-xs font-medium">
            Runs
          </h3>
          <WorkflowRunHistory
            onSelect={(id) => {
              run.stop();
              setSelected(id);
            }}
            runs={WORKFLOW_RUNS}
            selectedId={selected}
          />
        </aside>
        <section className="flex min-w-0 flex-col">
          <WorkflowRunTimeline
            className="border-table-card-border border-b p-4"
            elapsedMs={run.elapsedMs}
            nodes={nodes}
            phase={run.phase}
            schedule={run.schedule}
          />
          <WorkflowRunLog className="h-56 overflow-y-auto py-2" entries={log} />
        </section>
      </WorkflowShellCard>
    </WorkflowShell>
  );
}
