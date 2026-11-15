"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";

import { WorkflowCanvas } from "../components/workflow-canvas";
import { WorkflowRunButton } from "../components/workflow-run-button";
import { WorkflowRunLog } from "../components/workflow-run-log";
import {
  WorkflowShell,
  WorkflowShellCard,
  WorkflowShellHeader,
} from "../components/workflow-shell";
import { WorkflowTimer } from "../components/workflow-timer";
import { CONTENT_REFRESH_WORKFLOW } from "../constants/workflow-templates";
import { useWorkflowGraph } from "../hooks/use-workflow-graph";
import { useWorkflowRun } from "../hooks/use-workflow-run";
import { getOutputPorts, getRunLog } from "../lib/workflow";

const ROUTE_ID = "route";

export default function WorkflowDecisionTree() {
  const graph = useWorkflowGraph(CONTENT_REFRESH_WORKFLOW);
  const run = useWorkflowRun(graph.nodes, graph.edges);
  const route = graph.nodes.find((node) => node.id === ROUTE_ID);
  const [cause, setCause] = useState(route?.branch ?? "");
  const log = getRunLog(graph.nodes, run.schedule, run.phase, run.elapsedMs);

  const pickCause = (id: string) => {
    run.stop();
    setCause(id);
    graph.updateNode(ROUTE_ID, { branch: id });
  };

  return (
    <WorkflowShell className="w-full">
      <WorkflowShellHeader>
        <span className="text-muted-foreground text-xs font-normal">
          Diagnosis
        </span>
        {route &&
          getOutputPorts(route).map((port) => (
            <button
              aria-pressed={cause === port.id}
              className="focus-visible:ring-ring/50 rounded-full outline-none focus-visible:ring-2"
              key={port.id}
              onClick={() => pickCause(port.id)}
              type="button"
            >
              <Badge variant={cause === port.id ? "default" : "outline"}>
                {port.label}
              </Badge>
            </button>
          ))}
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
      <WorkflowShellCard className="overflow-hidden">
        <WorkflowCanvas
          className="h-[30rem] rounded-none border-0"
          edgeState={run.edgeState}
          edges={graph.edges}
          nodeState={run.nodeState}
          nodes={graph.nodes}
          onNodeMove={graph.moveNode}
        />
      </WorkflowShellCard>
      <WorkflowShellHeader>Run log</WorkflowShellHeader>
      <WorkflowShellCard>
        <WorkflowRunLog className="h-48 overflow-y-auto py-2" entries={log} />
      </WorkflowShellCard>
    </WorkflowShell>
  );
}
