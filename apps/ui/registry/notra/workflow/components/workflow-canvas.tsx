"use client";

import {
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import type { Connection, NodeChange } from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import { cn } from "cn";
import { MaximizeIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";

import { Button } from "@/components/ui/button";

import {
  WORKFLOW_BLOCK_MIME,
  WORKFLOW_IN_PORT,
  WORKFLOW_OUT_PORT,
} from "../constants/workflow";
import {
  WORKFLOW_FIT_DURATION_MS,
  WORKFLOW_FIT_EDGE_PX,
  WORKFLOW_FIT_MAX_ZOOM,
  WORKFLOW_FIT_MIN_ZOOM,
  WORKFLOW_FIT_PADDING,
  WORKFLOW_FIT_VIEW_OPTIONS,
  WORKFLOW_MINIMAP_STYLE,
  WORKFLOW_NODE_DROP_OFFSET_Y,
  WORKFLOW_NODE_WIDTH,
  WORKFLOW_PATTERN_STRENGTH,
  WORKFLOW_ZOOM_DURATION_MS,
} from "../constants/workflow-ui";
import type {
  WorkflowCanvasBackgroundProps,
  WorkflowCanvasProps,
  WorkflowControlsProps,
  WorkflowFlowEdge as WorkflowFlowEdgeType,
  WorkflowFlowNode as WorkflowFlowNodeType,
  WorkflowNodeSizes,
} from "../types/workflow";
import { WorkflowConnectionLine, WorkflowFlowEdge } from "./workflow-edge";
import { WorkflowFlowNode } from "./workflow-node";

const NODE_TYPES = { workflow: WorkflowFlowNode };
const EDGE_TYPES = { workflow: WorkflowFlowEdge };

const pattern = (percent: number) =>
  `color-mix(in oklab, var(--color-foreground, var(--foreground)) ${percent}%, transparent)`;

export const WorkflowCanvasBackground = ({
  gap = 16,
  variant = "dots",
}: WorkflowCanvasBackgroundProps) => {
  switch (variant) {
    case "lines": {
      return (
        <Background
          color={pattern(WORKFLOW_PATTERN_STRENGTH.lines)}
          gap={gap}
          variant={BackgroundVariant.Lines}
        />
      );
    }
    case "cross": {
      return (
        <Background
          color={pattern(WORKFLOW_PATTERN_STRENGTH.cross)}
          gap={gap}
          size={6}
          variant={BackgroundVariant.Cross}
        />
      );
    }
    case "grid": {
      return (
        <>
          <Background
            color={pattern(WORKFLOW_PATTERN_STRENGTH.gridMinor)}
            gap={gap}
            id="minor"
            variant={BackgroundVariant.Lines}
          />
          <Background
            color={pattern(WORKFLOW_PATTERN_STRENGTH.gridMajor)}
            gap={gap * 5}
            id="major"
            variant={BackgroundVariant.Lines}
          />
        </>
      );
    }
    case "none": {
      return null;
    }
    default: {
      return (
        <Background
          className="mask-[radial-gradient(ellipse_at_center,black_55%,transparent_100%)]"
          color={pattern(WORKFLOW_PATTERN_STRENGTH.dots)}
          gap={gap}
          size={1.1}
          variant={BackgroundVariant.Dots}
        />
      );
    }
  }
};

const WorkflowControls = ({ toolbar }: WorkflowControlsProps) => {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const { zoom } = useViewport();

  return (
    <Panel
      className="bg-table-shell/90 border-table-shell-border m-3! flex items-center gap-0.5 rounded-xl border p-0.5 backdrop-blur"
      data-slot="workflow-canvas-controls"
      position="bottom-left"
    >
      <Button
        aria-label="Zoom out"
        onClick={() => zoomOut({ duration: WORKFLOW_ZOOM_DURATION_MS })}
        size="icon-sm"
        variant="ghost"
      >
        <ZoomOutIcon />
      </Button>
      <span className="text-muted-foreground w-10 text-center font-mono text-[0.6875rem] tabular-nums">
        {Math.round(zoom * 100)}%
      </span>
      <Button
        aria-label="Zoom in"
        onClick={() => zoomIn({ duration: WORKFLOW_ZOOM_DURATION_MS })}
        size="icon-sm"
        variant="ghost"
      >
        <ZoomInIcon />
      </Button>
      <Button
        aria-label="Fit to view"
        onClick={() =>
          fitView({
            ...WORKFLOW_FIT_VIEW_OPTIONS,
            duration: WORKFLOW_FIT_DURATION_MS,
          })
        }
        size="icon-sm"
        variant="ghost"
      >
        <MaximizeIcon />
      </Button>
      {toolbar}
    </Panel>
  );
};

const WorkflowFlow = ({
  background = "dots",
  className,
  controls = true,
  edgeState,
  edges,
  focusId,
  gap,
  maxZoom = 1.5,
  minZoom = 0.3,
  minimap = false,
  nodeState,
  nodes,
  onConnect,
  onDropBlock,
  onNodeMove,
  onNodeRemove,
  onSelectNode,
  selectedId,
  toolbar,
}: WorkflowCanvasProps) => {
  const { fitView, getNodesBounds, screenToFlowPosition, setViewport } =
    useReactFlow<WorkflowFlowNodeType, WorkflowFlowEdgeType>();
  const nodesInitialized = useNodesInitialized();
  const containerRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef<string>(undefined);
  const [measured, setMeasured] = useState<WorkflowNodeSizes>({});
  const fittedRef = useRef(false);
  const [localSelectedId, setLocalSelectedId] = useState<string>();
  const activeId = onSelectNode ? selectedId : localSelectedId;

  useEffect(() => {
    if (!nodesInitialized || fittedRef.current) {
      return;
    }
    fittedRef.current = true;
    containerRef.current?.setAttribute("data-fitted", "");
    const box = containerRef.current?.getBoundingClientRect();
    const bounds = getNodesBounds(nodes.map((node) => node.id));
    if (!box || bounds.width === 0) {
      return;
    }
    const zoom = Math.min(
      WORKFLOW_FIT_MAX_ZOOM,
      (box.width * (1 - WORKFLOW_FIT_PADDING)) / bounds.width,
      (box.height * (1 - WORKFLOW_FIT_PADDING)) / bounds.height
    );
    if (zoom >= WORKFLOW_FIT_MIN_ZOOM) {
      fitView(WORKFLOW_FIT_VIEW_OPTIONS);
      return;
    }
    const startZoom = Math.max(WORKFLOW_FIT_MIN_ZOOM, minZoom);
    setViewport({
      x: WORKFLOW_FIT_EDGE_PX - bounds.x * startZoom,
      y: box.height / 2 - (bounds.y + bounds.height / 2) * startZoom,
      zoom: startZoom,
    });
  }, [fitView, getNodesBounds, minZoom, nodes, nodesInitialized, setViewport]);

  useEffect(() => {
    if (
      focusId &&
      focusedRef.current !== focusId &&
      nodes.some((node) => node.id === focusId)
    ) {
      focusedRef.current = focusId;
      fitView({
        duration: WORKFLOW_FIT_DURATION_MS,
        maxZoom: WORKFLOW_FIT_MAX_ZOOM,
        minZoom: WORKFLOW_FIT_MIN_ZOOM,
        nodes: [{ id: focusId }],
      });
    }
  }, [fitView, focusId, nodes]);

  const flowNodes = useMemo<WorkflowFlowNodeType[]>(
    () =>
      nodes.map((node) => ({
        data: { node, state: nodeState?.(node.id) },
        id: node.id,
        measured: measured[node.id],
        position: node.position,
        selected: node.id === activeId,
        type: "workflow",
      })),
    [activeId, measured, nodes, nodeState]
  );

  const flowEdges = useMemo<WorkflowFlowEdgeType[]>(() => {
    const incoming = new Map<string, number>();
    for (const edge of edges) {
      const key = `${edge.target}:${edge.targetPort ?? WORKFLOW_IN_PORT.id}`;
      incoming.set(key, (incoming.get(key) ?? 0) + 1);
    }
    return edges.map((edge) => ({
      data: {
        animated: edge.animated,
        label: edge.label,
        reverse:
          (incoming.get(
            `${edge.target}:${edge.targetPort ?? WORKFLOW_IN_PORT.id}`
          ) ?? 0) > 1,
        status: edgeState?.(edge.id) ?? "idle",
      },
      id: edge.id,
      selectable: false,
      source: edge.source,
      sourceHandle: edge.sourcePort ?? WORKFLOW_OUT_PORT.id,
      target: edge.target,
      targetHandle: edge.targetPort ?? WORKFLOW_IN_PORT.id,
      type: "workflow",
    }));
  }, [edges, edgeState]);

  const handleNodesChange = (changes: NodeChange<WorkflowFlowNodeType>[]) => {
    const sizes: WorkflowNodeSizes = {};
    for (const change of changes) {
      if (change.type === "dimensions" && change.dimensions) {
        sizes[change.id] = change.dimensions;
      } else if (change.type === "position" && change.position) {
        onNodeMove?.(change.id, change.position);
      } else if (change.type === "remove") {
        onNodeRemove?.(change.id);
      } else if (change.type === "select" && !onSelectNode) {
        const { id, selected } = change;
        setLocalSelectedId((current) => {
          if (selected) {
            return id;
          }
          return current === id ? undefined : current;
        });
      }
    }
    if (Object.keys(sizes).length > 0) {
      setMeasured((current) => ({ ...current, ...sizes }));
    }
  };

  const handleConnect = (connection: Connection) =>
    onConnect?.({
      source: connection.source,
      sourcePort: connection.sourceHandle ?? undefined,
      target: connection.target,
      targetPort: connection.targetHandle ?? undefined,
    });

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (onDropBlock && event.dataTransfer.types.includes(WORKFLOW_BLOCK_MIME)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    const blockId = event.dataTransfer.getData(WORKFLOW_BLOCK_MIME);
    if (!(onDropBlock && blockId)) {
      return;
    }
    event.preventDefault();
    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    onDropBlock(blockId, {
      x: Math.round(position.x - WORKFLOW_NODE_WIDTH / 2),
      y: Math.round(position.y - WORKFLOW_NODE_DROP_OFFSET_Y),
    });
  };

  return (
    <div
      className={cn(
        "group/canvas bg-background border-table-shell-border relative isolate min-h-0 overflow-hidden rounded-2xl border",
        className
      )}
      data-slot="workflow-canvas"
      ref={containerRef}
    >
      <ReactFlow
        className={cn(
          "bg-transparent! transition-opacity duration-200 [--xy-attribution-background-color:transparent]",
          nodes.length > 0 && "opacity-0 group-data-fitted/canvas:opacity-100"
        )}
        connectionLineComponent={WorkflowConnectionLine}
        deleteKeyCode={onNodeRemove ? ["Backspace", "Delete"] : null}
        edgeTypes={EDGE_TYPES}
        edges={flowEdges}
        elementsSelectable={Boolean(onSelectNode || onNodeRemove)}
        maxZoom={maxZoom}
        minZoom={minZoom}
        nodeTypes={NODE_TYPES}
        nodes={flowNodes}
        nodesConnectable={Boolean(onConnect)}
        nodesDraggable={Boolean(onNodeMove)}
        onConnect={handleConnect}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onNodeClick={(_, node) => onSelectNode?.(node.id)}
        onNodesChange={handleNodesChange}
        panOnScroll
        zoomOnDoubleClick={false}
      >
        <WorkflowCanvasBackground gap={gap} variant={background} />
        {controls && <WorkflowControls toolbar={toolbar} />}
        {minimap && (
          <MiniMap
            bgColor="var(--color-table-shell, var(--table-shell))"
            className="border-table-shell-border m-3! hidden overflow-hidden rounded-xl border md:block"
            maskColor="color-mix(in oklab, var(--color-foreground, var(--foreground)) 6%, transparent)"
            nodeBorderRadius={8}
            nodeColor="color-mix(in oklab, var(--color-foreground, var(--foreground)) 22%, transparent)"
            nodeStrokeColor="transparent"
            pannable
            position="top-right"
            style={WORKFLOW_MINIMAP_STYLE}
            zoomable
          />
        )}
      </ReactFlow>
    </div>
  );
};

export const WorkflowCanvas = (props: WorkflowCanvasProps) => (
  <ReactFlowProvider>
    <WorkflowFlow {...props} />
  </ReactFlowProvider>
);
