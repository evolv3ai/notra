"use client";

import { toast } from "sonner";

import { WorkflowNodePalette } from "../components/workflow-node-palette";
import {
  WorkflowShell,
  WorkflowShellCard,
  WorkflowShellHeader,
} from "../components/workflow-shell";
import { WORKFLOW_BLOCKS } from "../constants/workflow-blocks";

export default function WorkflowNodePaletteExample() {
  return (
    <WorkflowShell className="w-72">
      <WorkflowShellHeader>Blocks</WorkflowShellHeader>
      <WorkflowShellCard className="h-96 overflow-hidden">
        <WorkflowNodePalette
          blocks={WORKFLOW_BLOCKS}
          className="h-full"
          onAdd={(block) => toast(`Added ${block.title}`)}
        />
      </WorkflowShellCard>
    </WorkflowShell>
  );
}
