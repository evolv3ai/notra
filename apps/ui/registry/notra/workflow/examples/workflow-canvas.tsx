"use client";

import { WorkflowCanvas } from "../components/workflow-canvas";
import { WorkflowRunButton } from "../components/workflow-run-button";
import { WorkflowTimer } from "../components/workflow-timer";
import { SCHEMA_AUDIT_WORKFLOW } from "../constants/workflow-templates";
import { useWorkflowGraph } from "../hooks/use-workflow-graph";
import { useWorkflowRun } from "../hooks/use-workflow-run";

export default function WorkflowCanvasExample() {
  const graph = useWorkflowGraph(SCHEMA_AUDIT_WORKFLOW);
  const run = useWorkflowRun(graph.nodes, graph.edges);

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <WorkflowRunButton
          onPlay={run.play}
          onStop={run.stop}
          phase={run.phase}
          progress={run.elapsedMs / run.totalMs}
        />
        <WorkflowTimer ms={run.elapsedMs} running={run.phase === "running"} />
      </div>
      <WorkflowCanvas
        className="h-56"
        edgeState={run.edgeState}
        edges={graph.edges}
        nodeState={run.nodeState}
        nodes={graph.nodes}
        onConnect={graph.connect}
        onNodeMove={graph.moveNode}
      />
    </div>
  );
}
