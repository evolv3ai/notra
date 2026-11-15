"use client";

import { useCallback, useState } from "react";

import { WORKFLOW_IN_PORT, WORKFLOW_OUT_PORT } from "../constants/workflow";
import type {
  WorkflowEdgeData,
  WorkflowGraph,
  WorkflowNodeData,
  WorkflowPoint,
} from "../types/workflow";

export const useWorkflowGraph = (initial: WorkflowGraph) => {
  const [graph, setGraph] = useState<WorkflowGraph>(initial);

  const load = useCallback((next: WorkflowGraph) => setGraph(next), []);

  const moveNode = useCallback(
    (id: string, position: WorkflowPoint) =>
      setGraph((current) => ({
        ...current,
        nodes: current.nodes.map((node) =>
          node.id === id ? { ...node, position } : node
        ),
      })),
    []
  );

  const updateNode = useCallback(
    (id: string, patch: Partial<WorkflowNodeData>) =>
      setGraph((current) => ({
        ...current,
        nodes: current.nodes.map((node) =>
          node.id === id ? { ...node, ...patch } : node
        ),
      })),
    []
  );

  const addNode = useCallback(
    (node: WorkflowNodeData) =>
      setGraph((current) => ({ ...current, nodes: [...current.nodes, node] })),
    []
  );

  const removeNode = useCallback(
    (id: string) =>
      setGraph((current) => ({
        edges: current.edges.filter(
          (edge) => edge.source !== id && edge.target !== id
        ),
        nodes: current.nodes.filter((node) => node.id !== id),
      })),
    []
  );

  const connect = useCallback(
    (edge: Omit<WorkflowEdgeData, "id">) =>
      setGraph((current) => {
        const key = (item: Omit<WorkflowEdgeData, "id">) =>
          `${item.source}:${item.sourcePort ?? WORKFLOW_OUT_PORT.id}-${item.target}:${item.targetPort ?? WORKFLOW_IN_PORT.id}`;
        const id = key(edge);
        return current.edges.some((item) => key(item) === id)
          ? current
          : { ...current, edges: [...current.edges, { ...edge, id }] };
      }),
    []
  );

  return {
    addNode,
    connect,
    edges: graph.edges,
    load,
    moveNode,
    nodes: graph.nodes,
    removeNode,
    updateNode,
  };
};
