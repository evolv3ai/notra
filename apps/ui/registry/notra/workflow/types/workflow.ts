import type { Edge, Node, Position } from "@xyflow/react";
import type { ComponentProps, ComponentType, ReactNode, SVGProps } from "react";

export type WorkflowNodeKind =
  | "trigger"
  | "task"
  | "ai"
  | "integration"
  | "condition"
  | "switch"
  | "merge"
  | "loop"
  | "delay"
  | "approval"
  | "email"
  | "output";

export type WorkflowNodeStatus =
  | "idle"
  | "queued"
  | "running"
  | "waiting"
  | "success"
  | "error"
  | "skipped";

export type WorkflowEdgeStatus = "idle" | "active" | "done" | "skipped";

export type WorkflowRunPhase = "idle" | "running" | "done";

export type WorkflowLogoName =
  | "openai"
  | "anthropic"
  | "claude"
  | "gemini"
  | "perplexity"
  | "mistral"
  | "deepseek"
  | "grok"
  | "browserbase"
  | "context-dev"
  | "firecrawl"
  | "resend"
  | "slack"
  | "gmail"
  | "notion"
  | "google"
  | "google-sheets"
  | "webflow"
  | "wordpress"
  | "linear"
  | "github"
  | "ahrefs"
  | "posthog";

export type WorkflowLogLevel = "info" | "success" | "error" | "skip";

export type WorkflowIcon = ComponentType<SVGProps<SVGSVGElement>>;

export interface WorkflowPoint {
  x: number;
  y: number;
}

export interface WorkflowAnchor extends WorkflowPoint {
  position: Position;
}

export interface WorkflowPort {
  id: string;
  label?: string;
  hint?: string;
  rate?: number;
}

export interface WorkflowRule {
  subject: string;
  operator: string;
  value: string;
}

export interface WorkflowField {
  label: string;
  value: string;
}

export interface WorkflowNodeData {
  id: string;
  kind: WorkflowNodeKind;
  title: string;
  description?: string;
  position: WorkflowPoint;
  inputs?: WorkflowPort[];
  outputs?: WorkflowPort[];
  logo?: WorkflowLogoName;
  model?: string;
  durationMs?: number;
  branch?: string;
  rule?: WorkflowRule;
  fail?: boolean;
  fields?: WorkflowField[];
  output?: string;
}

export interface WorkflowEdgeData {
  id: string;
  source: string;
  sourcePort?: string;
  target: string;
  targetPort?: string;
  label?: string;
  animated?: boolean;
}

export interface WorkflowEdgeLane {
  id: string;
  down: boolean;
  from: WorkflowPoint;
  to: WorkflowPoint;
}

export interface WorkflowGraph {
  edges: WorkflowEdgeData[];
  nodes: WorkflowNodeData[];
}

export interface WorkflowTemplate extends WorkflowGraph {
  id: string;
  title: string;
  description: string;
  category: string;
}

export interface WorkflowKindConfig {
  icon: WorkflowIcon;
  label: string;
  tileClassName: string;
}

export interface WorkflowStatusConfig {
  className: string;
  label: string;
  ledClassName: string;
}

export interface WorkflowLogoConfig {
  label: string;
  logo: WorkflowIcon;
  tile?: boolean;
}

export interface WorkflowModel {
  id: string;
  label: string;
  logo: WorkflowLogoName;
  provider: string;
}

export interface WorkflowBlock {
  id: string;
  title: string;
  description: string;
  group: string;
  kind: WorkflowNodeKind;
  logo?: WorkflowLogoName;
  model?: string;
  inputs?: WorkflowPort[];
  outputs?: WorkflowPort[];
  durationMs?: number;
}

export interface WorkflowNodeRun {
  start: number;
  end: number;
  status: "success" | "error" | "skipped";
}

export interface WorkflowEdgeRun {
  start: number;
  end: number;
  taken: boolean;
}

export interface WorkflowSchedule {
  edges: Record<string, WorkflowEdgeRun>;
  nodes: Record<string, WorkflowNodeRun>;
  order: string[];
  totalMs: number;
}

export interface WorkflowNodeState {
  elapsedMs: number;
  status: WorkflowNodeStatus;
}

export interface WorkflowLogEntry {
  at: number;
  id: string;
  level: WorkflowLogLevel;
  message: string;
  nodeId: string;
  title: string;
}

export interface WorkflowRunSummary {
  id: string;
  durationMs: number;
  startedAt: string;
  status: "success" | "error" | "running";
  trigger: string;
  steps: number;
}

export interface WorkflowRun {
  edgeState: (id: string) => WorkflowEdgeStatus;
  elapsedMs: number;
  nodeState: (id: string) => WorkflowNodeState;
  phase: WorkflowRunPhase;
  play: () => void;
  schedule: WorkflowSchedule;
  stop: () => void;
  totalMs: number;
}

export type WorkflowLogoProps = Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: WorkflowLogoName;
};

export interface WorkflowFlowNodeData extends Record<string, unknown> {
  node: WorkflowNodeData;
  state?: WorkflowNodeState;
}

export interface WorkflowFlowEdgeData extends Record<string, unknown> {
  animated?: boolean;
  reverse?: boolean;
  label?: string;
  status: WorkflowEdgeStatus;
}

export type WorkflowFlowNode = Node<WorkflowFlowNodeData, "workflow">;

export type WorkflowFlowEdge = Edge<WorkflowFlowEdgeData, "workflow">;

export type WorkflowCanvasBackgroundVariant =
  | "dots"
  | "lines"
  | "cross"
  | "grid"
  | "none";

export interface WorkflowCanvasBackgroundProps {
  gap?: number;
  variant?: WorkflowCanvasBackgroundVariant;
}

export type WorkflowNodeSizes = Record<
  string,
  { height: number; width: number }
>;

export interface WorkflowPortListProps {
  ports: WorkflowPort[];
  title: string;
}

export interface WorkflowControlsProps {
  toolbar?: ReactNode;
}

export interface WorkflowBannerConfig {
  className: string;
  label: string;
  message: string;
}

export interface WorkflowStatusGlyphProps {
  status: WorkflowNodeStatus;
}

export interface WorkflowTemplatePreviewProps {
  template: WorkflowTemplate;
}

export interface WorkflowCanvasProps {
  className?: string;
  focusId?: string;
  background?: WorkflowCanvasBackgroundVariant;
  gap?: number;
  nodes: WorkflowNodeData[];
  edges: WorkflowEdgeData[];
  nodeState?: (id: string) => WorkflowNodeState;
  edgeState?: (id: string) => WorkflowEdgeStatus;
  selectedId?: string;
  controls?: boolean;
  minimap?: boolean;
  toolbar?: ReactNode;
  minZoom?: number;
  maxZoom?: number;
  onSelectNode?: (id: string) => void;
  onNodeMove?: (id: string, position: WorkflowPoint) => void;
  onNodeRemove?: (id: string) => void;
  onConnect?: (edge: Omit<WorkflowEdgeData, "id">) => void;
  onDropBlock?: (blockId: string, position: WorkflowPoint) => void;
}

export type WorkflowNodeCardProps = ComponentProps<"div"> & {
  node: WorkflowNodeData;
  state?: WorkflowNodeState;
  selected?: boolean;
  connectable?: boolean;
  children?: ReactNode;
};

export interface WorkflowHandleProps {
  active?: boolean;
  className?: string;
  connectable?: boolean;
  portId: string;
  type: "source" | "target";
}

export type WorkflowEdgeProps = ComponentProps<"g"> & {
  path: string;
  reverse?: boolean;
  status?: WorkflowEdgeStatus;
  animated?: boolean;
};

export type WorkflowTimerProps = ComponentProps<"span"> & {
  ms: number;
  running?: boolean;
};

export type WorkflowStatusIndicatorProps = ComponentProps<"span"> & {
  status: WorkflowNodeStatus;
};

export type WorkflowStatusBadgeProps = ComponentProps<"span"> & {
  status: WorkflowNodeStatus;
};

export type WorkflowStatusPillProps = ComponentProps<"span"> & {
  status: WorkflowNodeStatus;
};

export type WorkflowDeterminismBadgeProps = ComponentProps<"span"> & {
  deterministic: boolean;
};

export type WorkflowRunButtonProps = Omit<
  ComponentProps<"button">,
  "children"
> & {
  phase: WorkflowRunPhase;
  progress?: number;
  onPlay?: () => void;
  onStop?: () => void;
};

export type WorkflowNodePaletteProps = ComponentProps<"div"> & {
  blocks: WorkflowBlock[];
  onAdd?: (block: WorkflowBlock) => void;
};

export interface WorkflowNodeBranchProps {
  connectable?: boolean;
  node: WorkflowNodeData;
  port: WorkflowPort;
  status: WorkflowNodeStatus;
}

export interface WorkflowNodeBannerProps {
  status: WorkflowNodeStatus;
}

export interface WorkflowNodeSummaryProps {
  children?: ReactNode;
  node: WorkflowNodeData;
}

export interface WorkflowNodeEngineProps {
  node: WorkflowNodeData;
}

export interface WorkflowNodeFooterProps {
  node: WorkflowNodeData;
  state?: WorkflowNodeState;
}

export interface WorkflowBranchSelectProps {
  node: WorkflowNodeData;
  outputs: WorkflowPort[];
  onBranchChange: (id: string, branch: string) => void;
}

export type WorkflowNodeSettingsProps = Pick<
  WorkflowNodeSheetProps,
  "onBranchChange" | "onModelChange"
> & {
  node: WorkflowNodeData;
};

export type WorkflowNodeSheetProps = WorkflowOverlayProps & {
  node?: WorkflowNodeData;
  state?: WorkflowNodeState;
  log?: WorkflowLogEntry[];
  onDelete?: (id: string) => void;
  onModelChange?: (id: string, model: string) => void;
  onBranchChange?: (id: string, branch: string) => void;
};

export type WorkflowRunLogProps = ComponentProps<"div"> & {
  entries: WorkflowLogEntry[];
  emptyLabel?: string;
};

export type WorkflowRunTimelineProps = ComponentProps<"div"> & {
  nodes: WorkflowNodeData[];
  schedule: WorkflowSchedule;
  elapsedMs: number;
  phase: WorkflowRunPhase;
};

export type WorkflowRunHistoryProps = Omit<
  ComponentProps<"div">,
  "onSelect"
> & {
  runs: WorkflowRunSummary[];
  selectedId?: string;
  onSelect?: (id: string) => void;
};

export interface WorkflowModelSelectProps {
  className?: string;
  defaultValue?: string;
  disabled?: boolean;
  id?: string;
  models?: WorkflowModel[];
  onValueChange?: (value: string) => void;
  value?: string;
}

export type WorkflowTemplateCardProps = ComponentProps<"div"> & {
  template: WorkflowTemplate;
  onUse?: (template: WorkflowTemplate) => void;
};

export type WorkflowTemplateDialogProps = WorkflowOverlayProps & {
  template?: WorkflowTemplate;
  onUse?: (template: WorkflowTemplate) => void;
};

export interface WorkflowBlockIconProps {
  block: Pick<WorkflowBlock, "kind" | "logo" | "model">;
  className?: string;
}

export interface WorkflowOverlayProps {
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}

export interface WorkflowCanvasBackgroundOption {
  label: string;
  value: WorkflowCanvasBackgroundVariant;
}

export interface WorkflowNodeDemo {
  node: WorkflowNodeData;
  state: WorkflowNodeState;
}

export interface WorkflowEdgeDemo {
  animated?: boolean;
  label: string;
  status: WorkflowEdgeStatus;
}
