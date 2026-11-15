import {
  EdgeLabelRenderer,
  useStore,
  type ConnectionLineComponentProps,
  type EdgeProps,
} from "@xyflow/react";
import { cn } from "cn";
import type { ComponentProps } from "react";

import {
  WORKFLOW_EDGE_COLOR,
  WORKFLOW_EDGE_DASH,
  WORKFLOW_EDGE_REVERSE_STYLE,
} from "../constants/workflow-ui";
import { getEdgeLaneOffset, getFlowEdgePath } from "../lib/workflow";
import type {
  WorkflowEdgeProps,
  WorkflowFlowEdge as WorkflowFlowEdgeType,
} from "../types/workflow";

export const WorkflowEdge = ({
  animated,
  className,
  path,
  reverse,
  status = "idle",
  ...props
}: WorkflowEdgeProps) => {
  const flowing = status === "active" || (animated && status !== "skipped");

  return (
    <g
      className={cn(
        "transition-colors duration-300",
        WORKFLOW_EDGE_COLOR[status],
        className
      )}
      data-slot="workflow-edge"
      data-status={status}
      {...props}
    >
      <path
        className={cn(flowing && "motion-safe:animate-workflow-dash")}
        d={path}
        fill="none"
        stroke="currentColor"
        strokeDasharray={WORKFLOW_EDGE_DASH}
        strokeLinecap="round"
        strokeWidth={status === "active" ? 3.5 : 3}
        style={reverse ? WORKFLOW_EDGE_REVERSE_STYLE : undefined}
      />
      {status === "active" && (
        <circle
          className="fill-current drop-shadow-[0_0_4px_currentColor] motion-reduce:hidden"
          r={3.5}
        >
          <animateMotion
            calcMode="linear"
            dur="0.9s"
            keyPoints={reverse ? "1;0" : "0;1"}
            keyTimes="0;1"
            path={path}
            repeatCount="indefinite"
          />
        </circle>
      )}
    </g>
  );
};

export const WorkflowEdgeLabel = ({
  className,
  ...props
}: ComponentProps<"span">) => (
  <span
    className={cn(
      "bg-table-shell border-table-shell-border text-muted-foreground block max-w-40 truncate rounded-full border px-2 py-0.5 text-[0.6875rem] leading-4 font-medium whitespace-nowrap",
      className
    )}
    data-slot="workflow-edge-label"
    {...props}
  />
);

export const WorkflowFlowEdge = ({
  data,
  id,
  sourcePosition,
  sourceX,
  sourceY,
  targetPosition,
  targetX,
  targetY,
}: EdgeProps<WorkflowFlowEdgeType>) => {
  const reverse = Boolean(data?.reverse);
  const offset = useStore((state) => getEdgeLaneOffset(state, id));
  const [path, labelX, labelY] = getFlowEdgePath(
    { position: sourcePosition, x: sourceX, y: sourceY },
    { position: targetPosition, x: targetX, y: targetY },
    reverse,
    offset
  );

  return (
    <>
      <WorkflowEdge
        animated={data?.animated}
        path={path}
        reverse={reverse}
        status={data?.status}
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <WorkflowEdgeLabel
            className="nodrag nopan pointer-events-none absolute z-[1001]"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {data.label}
          </WorkflowEdgeLabel>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export const WorkflowConnectionLine = ({
  fromPosition,
  fromX,
  fromY,
  toPosition,
  toX,
  toY,
}: ConnectionLineComponentProps) => {
  const [path] = getFlowEdgePath(
    { position: fromPosition, x: fromX, y: fromY },
    { position: toPosition, x: toX, y: toY }
  );
  return <WorkflowEdge animated path={path} status="active" />;
};
