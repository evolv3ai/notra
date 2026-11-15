import type {
  WorkflowBannerConfig,
  WorkflowEdgeStatus,
  WorkflowRunPhase,
} from "../types/workflow";

export const WORKFLOW_NODE_WIDTH = 256;

export const WORKFLOW_NODE_DROP_OFFSET_Y = 24;

export const WORKFLOW_COLUMN = 320;

export const WORKFLOW_FIT_PADDING = 0.12;

export const WORKFLOW_FIT_MIN_ZOOM = 0.6;

export const WORKFLOW_FIT_MAX_ZOOM = 1;

export const WORKFLOW_FIT_EDGE_PX = 32;

export const WORKFLOW_FIT_VIEW_OPTIONS = {
  maxZoom: WORKFLOW_FIT_MAX_ZOOM,
  padding: WORKFLOW_FIT_PADDING,
};

export const WORKFLOW_ZOOM_DURATION_MS = 200;

export const WORKFLOW_FIT_DURATION_MS = 300;

export const WORKFLOW_MINIMAP_STYLE = { height: 96, width: 144 };

export const WORKFLOW_PATTERN_STRENGTH = {
  cross: 22,
  dots: 24,
  gridMajor: 12,
  gridMinor: 5,
  lines: 7,
};

export const WORKFLOW_PORT_ROW_CLASS =
  "text-muted-foreground border-table-card-border relative flex h-7.5 min-w-0 items-center border-t px-3 text-[0.6875rem] font-medium";

export const WORKFLOW_CHIP_CLASS =
  "bg-foreground/[0.05] text-muted-foreground inline-flex h-5 min-w-0 items-center gap-1 rounded-full px-2 text-[0.6875rem] leading-none tabular-nums [&_svg]:size-3 [&_svg]:shrink-0";

export const WORKFLOW_BANNERS: Record<
  "error" | "waiting",
  WorkflowBannerConfig
> = {
  error: {
    className: "text-red-600 dark:text-red-400",
    label: "Failed",
    message: "Check the run log",
  },
  waiting: {
    className: "text-amber-600 dark:text-amber-400",
    label: "Waiting",
    message: "Needs approval",
  },
};

export const WORKFLOW_PILL_CLASS =
  "bg-table-shell border-table-shell-border text-muted-foreground inline-flex h-9 w-7 shrink-0 flex-col overflow-hidden rounded-lg border [&_svg]:size-3";

export const WORKFLOW_PILL_TOP_CLASS =
  "flex flex-1 items-center justify-center";

export const WORKFLOW_PILL_BOTTOM_CLASS =
  "border-table-shell-border flex flex-1 items-center justify-center border-t";

export const WORKFLOW_LED_CLASS =
  "ring-background/60 size-1.5 rounded-full ring-2 transition-colors duration-300";

export const WORKFLOW_EDGE_COLOR: Record<WorkflowEdgeStatus, string> = {
  active: "text-primary",
  done: "text-primary/70",
  idle: "text-muted-foreground/70",
  skipped: "text-muted-foreground/25",
};

export const WORKFLOW_EDGE_DASH = "0 10";

export const WORKFLOW_EDGE_STEP_OPTIONS = { borderRadius: 24, offset: 24 };

export const WORKFLOW_EDGE_RADIUS = 24;

export const WORKFLOW_EDGE_LANE_GAP = 16;

export const WORKFLOW_RUN_LABELS: Record<WorkflowRunPhase, string> = {
  done: "Run again",
  idle: "Run workflow",
  running: "Stop",
};

export const WORKFLOW_RUN_RING_RADIUS = 10;

export const WORKFLOW_RUN_RING_LENGTH = 2 * Math.PI * WORKFLOW_RUN_RING_RADIUS;

export const WORKFLOW_SECTION_TITLE_CLASS =
  "text-muted-foreground text-[0.6875rem] font-medium tracking-wide uppercase";

export const WORKFLOW_EDGE_REVERSE_STYLE = { animationDirection: "reverse" };

export const WORKFLOW_SKIPPED_DIM_CLASS =
  "transition-opacity duration-300 group-data-[status=skipped]/node:opacity-45";

export const WORKFLOW_BRANCH_RAIL_CLASS =
  "border-table-card-border bg-table-card/60 divide-table-card-border mt-0.5 divide-y rounded-[14px] border";

export const WORKFLOW_BRANCH_ROW_CLASS =
  "relative flex h-10 min-w-0 items-center gap-2.5 px-3";

export const WORKFLOW_BRANCH_LED_CLASS =
  "size-2 shrink-0 rounded-full ring-2 transition-[background-color,box-shadow,opacity] duration-300";

export const WORKFLOW_RULE_TOKEN_CLASS =
  "bg-foreground/[0.05] text-foreground/80 inline-flex h-5 max-w-full min-w-0 items-center truncate rounded-md px-1.5 text-[0.6875rem] whitespace-nowrap";
