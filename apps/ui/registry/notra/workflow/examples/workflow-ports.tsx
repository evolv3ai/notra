"use client";

import { WorkflowCanvas } from "../components/workflow-canvas";
import { useWorkflowGraph } from "../hooks/use-workflow-graph";
import type { WorkflowGraph } from "../types/workflow";

const GRAPH: WorkflowGraph = {
  edges: [
    { id: "e1", source: "traffic", target: "summary", targetPort: "traffic" },
    {
      id: "e2",
      source: "visibility",
      target: "summary",
      targetPort: "visibility",
    },
    { id: "e3", source: "summary", target: "route" },
    {
      id: "e4",
      label: "≥ 10%",
      source: "route",
      sourcePort: "up",
      target: "slack",
    },
    { id: "e5", source: "route", sourcePort: "flat", target: "sheet" },
    {
      id: "e6",
      label: "≤ -10%",
      source: "route",
      sourcePort: "down",
      target: "linear",
    },
  ],
  nodes: [
    {
      id: "traffic",
      kind: "integration",
      logo: "posthog",
      position: { x: 32, y: 72 },
      title: "AI referral traffic",
    },
    {
      id: "visibility",
      kind: "task",
      position: { x: 32, y: 288 },
      title: "Visibility report",
    },
    {
      id: "summary",
      inputs: [
        { id: "traffic", label: "Traffic" },
        { id: "visibility", label: "Visibility" },
      ],
      kind: "ai",
      model: "claude-haiku-5-5",
      position: { x: 352, y: 144 },
      title: "Write digest",
    },
    {
      id: "route",
      kind: "switch",
      outputs: [
        { hint: "Share the win", id: "up", label: "Visibility up" },
        { hint: "Add to the sheet", id: "flat", label: "No change" },
        { hint: "Open a Linear issue", id: "down", label: "Visibility down" },
      ],
      position: { x: 680, y: 144 },
      rule: {
        operator: "compared to",
        subject: "AI visibility",
        value: "last week",
      },
      title: "Week over week",
    },
    {
      id: "slack",
      kind: "integration",
      logo: "slack",
      position: { x: 1056, y: 96.5 },
      title: "Celebrate in #geo",
    },
    {
      id: "sheet",
      kind: "integration",
      logo: "google-sheets",
      position: { x: 1056, y: 272.5 },
      title: "Log to sheet",
    },
    {
      id: "linear",
      kind: "integration",
      logo: "linear",
      position: { x: 1056, y: 432.5 },
      title: "Open an issue",
    },
  ],
};

export default function WorkflowPortsExample() {
  const graph = useWorkflowGraph(GRAPH);
  return (
    <WorkflowCanvas
      className="h-80 w-full"
      edges={graph.edges}
      nodes={graph.nodes}
      onConnect={graph.connect}
      onNodeMove={graph.moveNode}
    />
  );
}
