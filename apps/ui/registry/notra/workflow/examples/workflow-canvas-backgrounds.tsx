"use client";

import { useState } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { WorkflowCanvas } from "../components/workflow-canvas";
import { WEEKLY_DIGEST_WORKFLOW } from "../constants/workflow-templates";
import { useWorkflowGraph } from "../hooks/use-workflow-graph";
import type {
  WorkflowCanvasBackgroundOption,
  WorkflowCanvasBackgroundVariant,
} from "../types/workflow";

const VARIANTS: WorkflowCanvasBackgroundOption[] = [
  { label: "Dots", value: "dots" },
  { label: "Lines", value: "lines" },
  { label: "Grid", value: "grid" },
  { label: "Cross", value: "cross" },
  { label: "None", value: "none" },
];

export default function WorkflowCanvasBackgroundsExample() {
  const graph = useWorkflowGraph(WEEKLY_DIGEST_WORKFLOW);
  const [variant, setVariant] =
    useState<WorkflowCanvasBackgroundVariant>("grid");

  return (
    <div className="flex w-full flex-col gap-3">
      <ToggleGroup
        aria-label="Canvas background"
        onValueChange={(value) => {
          const [next] = value;
          const match = VARIANTS.find((item) => item.value === next);
          if (match) {
            setVariant(match.value);
          }
        }}
        value={[variant]}
        variant="outline"
      >
        {VARIANTS.map((item) => (
          <ToggleGroupItem key={item.value} value={item.value}>
            {item.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <WorkflowCanvas
        background={variant}
        className="h-72"
        edges={graph.edges}
        nodes={graph.nodes}
        onConnect={graph.connect}
        onNodeMove={graph.moveNode}
      />
    </div>
  );
}
