"use client";

import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { WorkflowCanvas } from "ui/workflow/canvas";
import { WorkflowNodeSheet } from "ui/workflow/node-sheet";

import { Button } from "@/components/button";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  AutopilotWorkflowGraphProps,
  WorkflowRunCanvasProps,
} from "@/types/autopilot";
import { runEventsRefetchInterval } from "@/utils/autopilot-events";
import {
  toWorkflowCanvasEdges,
  toWorkflowCanvasNodes,
  workflowEdgeStatus,
  workflowNodeState,
  workflowRunLog,
} from "@/utils/workflow-run-view";

function WorkflowRunCanvas({ run, calledFrom, now }: WorkflowRunCanvasProps) {
  const [selectedId, setSelectedId] = useState<string>();
  const [open, setOpen] = useState(false);
  const nodes = toWorkflowCanvasNodes(run);
  const selected = nodes.find((node) => node.id === selectedId);
  const nodeState = (id: string) =>
    workflowNodeState(
      run.nodes.find((node) => node.id === id),
      now
    );

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">
        {run.title}
        {calledFrom ? ` · called by ${calledFrom}` : null}
      </p>
      <WorkflowCanvas
        className="h-[26rem]"
        edgeState={(id) => workflowEdgeStatus(run, id)}
        edges={toWorkflowCanvasEdges(run)}
        nodeState={nodeState}
        nodes={nodes}
        onSelectNode={(id) => {
          setSelectedId(id);
          setOpen(true);
        }}
        selectedId={open ? selectedId : undefined}
      />
      <WorkflowNodeSheet
        log={workflowRunLog(run)}
        node={selected}
        onOpenChange={setOpen}
        open={open}
        state={selected ? nodeState(selected.id) : undefined}
      />
    </div>
  );
}

export function AutopilotWorkflowGraph({
  organizationId,
  run,
}: AutopilotWorkflowGraphProps) {
  const query = useQuery(
    dashboardOrpc.autopilot.runGraph.queryOptions({
      input: { organizationId, runId: run.id },
      refetchInterval: runEventsRefetchInterval(run),
    })
  );
  const runs = query.data ?? [];

  if (query.isPending) {
    return <Skeleton className="h-[26rem] rounded-2xl" />;
  }
  if (query.isError) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm" role="alert">
        <p>Could not load the workflow.</p>
        <Button
          disabled={query.isFetching}
          onClick={() => query.refetch()}
          size="sm"
          variant="outline"
        >
          Try again
        </Button>
      </div>
    );
  }
  if (runs.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        This run didn't record a workflow.
      </p>
    );
  }
  return (
    <div className="space-y-6">
      {runs.map((item) => (
        <WorkflowRunCanvas
          calledFrom={
            runs.find((other) => other.id === item.parentRunId)?.title ?? null
          }
          key={item.id}
          now={query.dataUpdatedAt}
          run={item}
        />
      ))}
    </div>
  );
}
