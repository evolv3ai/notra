"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { WorkflowNodeSheet } from "../components/workflow-node-sheet";
import { LISTICLE_OUTREACH_WORKFLOW } from "../constants/workflow-templates";
import { getRunLog, scheduleRun } from "../lib/workflow";
import type { WorkflowNodeData } from "../types/workflow";

const SCHEDULE = scheduleRun(
  LISTICLE_OUTREACH_WORKFLOW.nodes,
  LISTICLE_OUTREACH_WORKFLOW.edges
);
const LOG = getRunLog(
  LISTICLE_OUTREACH_WORKFLOW.nodes,
  SCHEDULE,
  "done",
  SCHEDULE.totalMs
);
const CLASSIFY = LISTICLE_OUTREACH_WORKFLOW.nodes.find(
  (node) => node.id === "classify"
);

export default function WorkflowNodeSheetExample() {
  const [open, setOpen] = useState(false);
  const [node, setNode] = useState<WorkflowNodeData | undefined>(CLASSIFY);
  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline">
        Open “Classify fit”
      </Button>
      <WorkflowNodeSheet
        log={LOG}
        node={node}
        onModelChange={(_, model) =>
          setNode((current) => current && { ...current, model })
        }
        onOpenChange={setOpen}
        open={open}
        state={{ elapsedMs: 2200, status: "success" }}
      />
    </>
  );
}
