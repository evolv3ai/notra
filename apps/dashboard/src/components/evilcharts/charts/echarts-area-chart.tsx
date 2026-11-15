"use client";

import { LineChart, type LineSeriesOption } from "echarts/charts";
import {
  DataZoomComponent,
  type DataZoomComponentOption,
  GridComponent,
  type GridComponentOption,
  MarkLineComponent,
  TooltipComponent,
  type TooltipComponentOption,
} from "echarts/components";
import type { ComposeOption, ImagePatternObject } from "echarts/core";
import * as echarts from "echarts/core";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";
import { useLocale } from "use-intl";
import { motion, useReducedMotion } from "motion/react";
import { tween } from "@notra/ui/lib/motion";
import {
  Children,
  type CSSProperties,
  type FC,
  isValidElement,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { withLocaleTooltip, withLocaleValueAxis } from "@/utils/chart-locale";
import { buildZeroBaselineAxisLine } from "@/utils/chart-zero-baseline";
import { EChartsPlotFrame } from "@/components/charts/echarts-plot-frame";
import { CHART_SCRUB_POSITION_LERP } from "@/constants/charts";
import {
  Brush,
  type BrushGeometry,
  type BrushOverlayElements,
  type BrushProps,
  type BrushRange,
  buildBrushDataZoom,
  syncBrushOverlay,
} from "@/components/evilcharts/ui/echarts-brush";
import {
  buildChartCss,
  flattenColor,
  getColorsCount,
  type ResolvedColors,
  resolveColors,
  resolvedIndicatorBackground,
  seriesPaint,
  withAlpha,
} from "@/components/evilcharts/ui/echarts-chart";
import {
  type DotVariant,
  dotItemStyle,
  dotStyle,
  sampleGradient,
} from "@/components/evilcharts/ui/echarts-dot";
import {
  LegendOverlay,
  type LegendVariant,
} from "@/components/evilcharts/ui/echarts-legend";
import { applyChartMarkers } from "@/components/evilcharts/ui/echarts-marker";
import {
  type TooltipPosition,
  type TooltipRoundness,
  type TooltipVariant,
  composeTooltipBody,
  capTooltipGroups,
  capTooltipItems,
  composeTooltipGroupedBody,
  composeTooltipSectionedRows,
  configIndicatorHtml,
  formatTooltipValue,
  tooltipBaseOption,
  tooltipEmptyBody,
  tooltipItemsFromRow,
  tooltipShell,
} from "@/components/evilcharts/ui/echarts-tooltip";
import {
  keepTooltipContentMounted,
  withTooltipSizeMotion,
} from "@/utils/chart-tooltip-size";
import type {
  ChartConfig,
  ChartMarker,
  TooltipBodyGroup,
  TooltipBodyItem,
  TooltipEmptyLabel,
  TooltipLabelFormatter,
  TooltipLayout,
  TooltipRowGroup,
  TooltipValueFormatter,
} from "@/types/charts";
import { observeChartResize } from "@/components/evilcharts/ui/echarts-resize";
import {
  SCRUB_MUTE_OPACITY,
  SCRUB_ZLEVEL,
  clearScrub,
  clipSeriesToX,
  emptyScrubStore,
  nearestCategoryIndex,
  pointOnSeriesAtX,
  readScrubGrid,
  syncScrubOverlay,
  type ScrubDot,
  type ScrubOverlayStore,
} from "@/components/evilcharts/ui/echarts-scrub";

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  MarkLineComponent,
  CanvasRenderer,
  SVGRenderer,
]);

type EChartsInstance = ReturnType<typeof echarts.init>;

type EChartsOption = ComposeOption<
  | LineSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | DataZoomComponentOption
>;

type ArrayItem<T> = T extends readonly (infer U)[] ? U : T;
type XAxisOption = ArrayItem<NonNullable<EChartsOption["xAxis"]>>;
type YAxisOption = ArrayItem<NonNullable<EChartsOption["yAxis"]>>;


const defaultMoreLabel = (count: number) => `+${count} more`;
const DEFAULT_FILL_ALPHA = 0.24;
const STROKE_WIDTH = 0.8;
const LOADING_ANIMATION_DURATION = 2000;
const REVEAL_DURATION = 1000;
const CHART_UPDATE_MS = 420;
const HOVER_DOT_STATE_MS = 120;
const LOADING_DEFAULT_POINTS = 14;
const BUFFER_DASH: [number, number] = [4, 3];

const GRID_LINE_OPACITY = 1;
const AXIS_POINTER_OPACITY = 0.2;
const AXIS_POINTER_WIDTH = 1;
const LOADING_STROKE_OPACITY = 0.5;
const LOADING_SHIMMER_MAX_OPACITY = 0.03;
const LOADING_SHIMMER_BAND = 0.2;
const LOADING_SHIMMER_FEATHER = 0.2;
const BRUSH_STROKE_OPACITY = 0.5;
const BRUSH_FILL_OPACITY = 0.15;
const BRUSH_FILLER_OPACITY = 0;


export type AreaVariant =
  | "gradient"
  | "gradient-reverse"
  | "solid"
  | "dotted"
  | "lines"
  | "hatched"
  | "none";
export type StrokeVariant = "solid" | "dashed" | "animated-dashed";
export type GridLineVariant = "dashed" | "solid";
export type StackType = "default" | "stacked" | "expanded";
export type AreaAnimationType =
  | "none"
  | "left-to-right"
  | "right-to-left"
  | "center-out"
  | "edges-in";
export type CurveType =
  | "linear"
  | "smooth"
  | "bump"
  | "monotone"
  | "monotoneX"
  | "monotoneY"
  | "natural"
  | "step";

export interface ChartRangeSelection {
  startIndex: number;
  endIndex: number;
}

export interface EChartsAreaChartProps<TData extends Record<string, unknown>> {
  renderer?: "canvas" | "svg";
  data: TData[]; // rows rendered by the chart
  config: ChartConfig; // series colors + labels
  xDataKey?: keyof TData & string; // x category key — falls back to the <XAxis> dataKey / first free column
  className?: string; // extra classes for the chart container
  curveType?: CurveType; // default curve interpolation each <Area> inherits
  stackType?: StackType; // how multiple areas combine
  animation?: boolean; // master switch for the intro draw-in — false renders instantly
  animationType?: AreaAnimationType; // default intro reveal (first <Area> overrides)
  enableHoverHighlight?: boolean; // hovering a series dims the others, like a temporary selection
  enableHoverReveal?: boolean; // hovering colors each area up to the pointer's x and mutes the rest
  defaultSelectedDataKey?: string | null; // series selected on first render
  selectedDataKey?: string | null; // controlled selection — overrides internal state when set
  onSelectionChange?: (key: string | null) => void; // fires when the selected series changes
  isLoading?: boolean; // shows the animated loading skeleton
  loadingPoints?: number; // number of points in the loading skeleton
  chartOptions?: Record<string, unknown>; // escape hatch merged over the built ECharts option
  markers?: readonly ChartMarker[]; // vertical annotation lines pinned to x-axis categories
  onRangeSelect?: (selection: ChartRangeSelection) => void; // enables drag-to-select; fires on release with the picked days
  children?: ReactNode; // declarative config — <Area>, <XAxis>, <Grid>, <Tooltip>, <Legend>, <Brush>, …
}


export interface AreaProps {
  dataKey: string; // series key — must exist on the data + config
  variant?: AreaVariant; // fill style for this area only
  strokeVariant?: StrokeVariant; // stroke style for this area
  strokeWidth?: number; // stroke thickness in pixels for this area
  fillAlpha?: number; // peak opacity of the gradient/solid fill, 0–1 (default 0.24)
  curveType?: CurveType; // curve interpolation — falls back to the root curveType
  animationType?: AreaAnimationType; // intro reveal — first area drives the wrapper wipe
  connectNulls?: boolean; // join segments across null/missing values
  isClickable?: boolean; // lets this area be selected by clicking it
  enableBufferLine?: boolean; // renders this area's last segment as a dashed, fill-less buffer
  gapMissing?: boolean; // render absent data keys as gaps instead of zeroes
  visible?: boolean; // when false, keeps the series mounted but fades it out for smooth toggles
  children?: ReactNode; // optional <Dot> and <ActiveDot> config
}

/**
 * A single area series. Declares its own fill/stroke/curve/clickability and,
 * optionally, resting/active point markers via composed <Dot> / <ActiveDot>.
 * Renders nothing — the root reads these props to build the ECharts series.
 */
const Area: FC<AreaProps> = () => null;

export interface DotProps {
  variant?: DotVariant; // visual style of the point marker
  indices?: readonly number[]; // restrict resting markers to these data indices
}

const Dot: FC<DotProps> = () => null;

const ActiveDot: FC<DotProps> = () => null;

export interface XAxisProps {
  dataKey?: string; // x category key — overrides the root xDataKey
  // Category-axis values are always stringified, so the formatter sees a string —
  // letting examples share `(value) => value.substring(0, 3)` with the Recharts twin.
  tickFormatter?: (value: string, index: number) => string; // formats x tick labels
  label?: string; // axis title, centered below the tick labels
  hideDots?: boolean; // hides the tick dots beside this axis's labels
}

const XAxis: FC<XAxisProps> = () => null;

export interface YAxisProps {
  min?: number;
  max?: number;
  interval?: number;
  dataKey?: string; // reserved for parity with the Recharts twin
  tickFormatter?: (value: number, index: number) => string; // formats y tick labels
  label?: string; // axis title, rotated alongside the tick labels
  hideDots?: boolean; // hides the tick dots beside this axis's labels
  scale?: boolean; // when true, choose a data-relative range instead of forcing zero into view
}

const YAxis: FC<YAxisProps> = () => null;

export interface GridProps {
  variant?: GridLineVariant; // "dashed" (default) or unbroken "solid" split lines
  lineType?: GridLineVariant; // alias used by the shared chart API
  opacity?: number; // multiplies the split line alpha, 0–1 (default 1)
}

const Grid: FC<GridProps> = () => null;

export interface TooltipProps {
  variant?: TooltipVariant; // visual style of the tooltip surface
  roundness?: TooltipRoundness; // border-radius of the tooltip
  cursor?: boolean; // whether the vertical cursor line follows the pointer
  crosshair?: boolean; // also draw the horizontal line to the value axis
  // Mouse-follow hover (Liveline-style): a 1px line tracks X, the series clips
  // to it, and a solid dot rides the curve. No snap, no glow. The HTML tooltip
  // still reads the nearest category.
  scrub?: boolean;
  position?: TooltipPosition; // "variable" follows both axes (default); "fixed" pins the tooltip near the top and sits beside the pointer's X
  layout?: TooltipLayout; // "rows" is the default swatch list; "bars" ranks series as a mini bar chart
  valueFormatter?: TooltipValueFormatter;
  labelKey?: string; // optional row key used for the tooltip heading instead of the x-axis value
  labelFormatter?: TooltipLabelFormatter;
  barMax?: number; // bar layout: scale tracks to this ceiling (e.g. 100 for percents); omit to scale to the hovered max
  confine?: boolean; // keep the tooltip inside the chart rect (default true); false lets small sparklines overflow
  // When set, tooltip rows come from these data keys at the hovered index
  // instead of the visible series — so a single total line can still list a
  // per-engine breakdown on hover.
  rowKeys?: readonly string[];
  // Sectioned rows: each group heading is a data key rendered as a full bar,
  // followed by its row keys scaled to the heading value.
  rowGroups?: readonly TooltipRowGroup[];
  hideZeros?: boolean; // drop series whose hovered value is 0 / empty
  maxRows?: number; // row budget: with rowGroups it is shared by all sections (layout "rows" = compact captions, else activity bars), otherwise it caps the list; the rest folds into "+N more"
  moreLabel?: (count: number) => string; // label of the folded row, for translation (default "+N more")
  excludeKeys?: readonly string[]; // series drawn on the chart but omitted from the tooltip
  emptyLabel?: TooltipEmptyLabel; // shown when hideZeros / missing values leave no rows
}

const Tooltip: FC<TooltipProps> = () => null;

export interface LegendProps {
  variant?: LegendVariant; // visual style of the legend indicators
  align?: "left" | "center" | "right"; // horizontal placement
  verticalAlign?: "top" | "middle" | "bottom"; // vertical placement
  isClickable?: boolean; // lets each entry toggle selection of its series
}

const Legend: FC<LegendProps> = () => null;


type AreaSeriesConfig = {
  dataKey: string;
  variant: AreaVariant;
  strokeVariant: StrokeVariant;
  strokeWidth: number;
  fillAlpha: number;
  curveType?: CurveType;
  animationType?: AreaAnimationType;
  connectNulls: boolean;
  isClickable: boolean;
  enableBufferLine: boolean;
  gapMissing: boolean;
  visible: boolean;
  dotVariant: DotVariant;
  dotIndices?: readonly number[];
  activeDotVariant: DotVariant;
};

type XAxisSlot = {
  present: boolean;
  dataKey?: string;
  tickFormatter?: (value: string, index: number) => string;
  label?: string;
  hideDots: boolean;
};
type YAxisSlot = {
  min?: number;
  max?: number;
  interval?: number;
  present: boolean;
  dataKey?: string;
  tickFormatter?: (value: number, index: number) => string;
  label?: string;
  hideDots: boolean;
  scale: boolean;
};
type TooltipSlot = {
  present: boolean;
  variant: TooltipVariant;
  roundness: TooltipRoundness;
  cursor: boolean;
  crosshair?: boolean;
  scrub: boolean;
  position: TooltipPosition;
  layout: TooltipLayout;
  valueFormatter?: TooltipValueFormatter;
  labelKey?: string;
  labelFormatter?: TooltipLabelFormatter;
  barMax?: number;
  confine: boolean;
  rowKeys?: readonly string[];
  rowGroups?: readonly TooltipRowGroup[];
  hideZeros: boolean;
  maxRows?: number;
  moreLabel?: (count: number) => string;
  excludeKeys: readonly string[];
  emptyLabel?: TooltipEmptyLabel;
};
type LegendSlot = {
  present: boolean;
  variant: LegendVariant;
  align: "left" | "center" | "right";
  verticalAlign: "top" | "middle" | "bottom";
  isClickable: boolean;
};
type BrushSlot = {
  present: boolean;
  height?: number;
  formatLabel?: (value: string, index: number) => string;
  onChange?: (range: { startIndex: number; endIndex: number }) => void;
};

type CollectedConfig = {
  areas: AreaSeriesConfig[];
  xAxis: XAxisSlot;
  yAxis: YAxisSlot;
  showGrid: boolean;
  gridVariant: GridLineVariant;
  gridOpacity: number;
  tooltip: TooltipSlot;
  legend: LegendSlot;
  brush: BrushSlot;
};

function collectConfig(children: ReactNode): CollectedConfig {
  const areas: AreaSeriesConfig[] = [];
  let xAxis: XAxisSlot = { present: false, hideDots: false };
  let yAxis: YAxisSlot = { present: false, hideDots: false, scale: false };
  let showGrid = false;
  let gridVariant: GridLineVariant = "dashed";
  let gridOpacity = 1;
  let tooltip: TooltipSlot = {
    present: false,
    variant: "default",
    roundness: "lg",
    cursor: true,
    scrub: false,
    position: "variable",
    layout: "rows",
    confine: true,
    hideZeros: false,
    excludeKeys: [],
  };
  let legend: LegendSlot = {
    present: false,
    variant: "rounded-square",
    align: "right",
    verticalAlign: "top",
    isClickable: false,
  };
  let brush: BrushSlot = { present: false };

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const type = child.type;

    if (type === Area) {
      const props = child.props as AreaProps;
      let dotVariant: DotVariant = "none";
      let dotIndices: readonly number[] | undefined;
      let activeDotVariant: DotVariant = "none";
      Children.forEach(props.children, (dotChild) => {
        if (!isValidElement(dotChild)) return;
        if (dotChild.type === Dot) {
          dotVariant = (dotChild.props as DotProps).variant ?? "default";
          dotIndices = (dotChild.props as DotProps).indices;
        } else if (dotChild.type === ActiveDot) {
          activeDotVariant = (dotChild.props as DotProps).variant ?? "default";
        }
      });
      areas.push({
        dotIndices,
        dataKey: props.dataKey,
        variant: props.variant ?? "gradient",
        strokeVariant: props.strokeVariant ?? "dashed",
        strokeWidth: props.strokeWidth ?? STROKE_WIDTH,
        fillAlpha: props.fillAlpha ?? DEFAULT_FILL_ALPHA,
        curveType: props.curveType,
        animationType: props.animationType,
        connectNulls: props.connectNulls ?? false,
        isClickable: props.isClickable ?? false,
        enableBufferLine: props.enableBufferLine ?? false,
        gapMissing: props.gapMissing ?? false,
        visible: props.visible ?? true,
        dotVariant,
        activeDotVariant,
      });
    } else if (type === XAxis) {
      const props = child.props as XAxisProps;
      xAxis = {
        present: true,
        dataKey: props.dataKey,
        tickFormatter: props.tickFormatter,
        label: props.label,
        hideDots: props.hideDots ?? false,
      };
    } else if (type === YAxis) {
      const props = child.props as YAxisProps;
      yAxis = {
        present: true,
        min: props.min,
        max: props.max,
        interval: props.interval,
        dataKey: props.dataKey,
        tickFormatter: props.tickFormatter,
        label: props.label,
        hideDots: props.hideDots ?? false,
        scale: props.scale ?? false,
      };
    } else if (type === Grid) {
      showGrid = true;
      const props = child.props as GridProps;
      gridVariant = props.lineType ?? props.variant ?? "dashed";
      gridOpacity = props.opacity ?? 1;
    } else if (type === Tooltip) {
      const props = child.props as TooltipProps;
      tooltip = {
        present: true,
        variant: props.variant ?? "default",
        roundness: props.roundness ?? "lg",
        cursor: props.cursor ?? true,
        crosshair: props.crosshair ?? false,
        scrub: props.scrub ?? false,
        position: props.position ?? "variable",
        layout: props.layout ?? "rows",
        valueFormatter: props.valueFormatter,
        labelKey: props.labelKey,
        labelFormatter: props.labelFormatter,
        barMax: props.barMax,
        confine: props.confine ?? true,
        rowKeys: props.rowKeys,
        rowGroups: props.rowGroups,
        hideZeros:
          props.hideZeros ?? Boolean(props.rowKeys || props.rowGroups),
        maxRows: props.maxRows,
        moreLabel: props.moreLabel,
        excludeKeys: props.excludeKeys ?? [],
        emptyLabel: props.emptyLabel,
      };
    } else if (type === Legend) {
      const props = child.props as LegendProps;
      legend = {
        present: true,
        variant: props.variant ?? "rounded-square",
        align: props.align ?? "right",
        verticalAlign: props.verticalAlign ?? "top",
        isClickable: props.isClickable ?? false,
      };
    } else if (type === Brush) {
      const props = child.props as BrushProps;
      brush = {
        present: true,
        height: props.height,
        formatLabel: props.formatLabel,
        onChange: props.onChange,
      };
    }
  });

  return {
    areas,
    xAxis,
    yAxis,
    showGrid,
    gridVariant,
    gridOpacity,
    tooltip,
    legend,
    brush,
  };
}



function patternFill(
  kind: "dotted" | "lines" | "hatched" | "stripe",
  color: string
): ImagePatternObject | null {
  if (typeof document === "undefined") return null;
  const dpr = Math.max(window.devicePixelRatio || 1, 1);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const size = (width: number, height: number) => {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
  };
  const pattern = (rotation = 0): ImagePatternObject => ({
    image: canvas,
    repeat: "repeat",
    rotation,
    scaleX: 1 / dpr,
    scaleY: 1 / dpr,
  });

  if (kind === "dotted") {
    size(6, 6);
    ctx.fillStyle = withAlpha(color, 0.7);
    ctx.beginPath();
    ctx.arc(3, 3, 0.85, 0, Math.PI * 2);
    ctx.fill();
    return pattern();
  }

  if (kind === "lines" || kind === "stripe") {
    size(5, 5);
    ctx.strokeStyle = withAlpha(color, 0.3);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(2.5, -1);
    ctx.lineTo(2.5, 6);
    ctx.stroke();
    return pattern(-Math.PI / 4);
  }

  size(20, 20);
  ctx.fillStyle = withAlpha(color, 0.06);
  ctx.fillRect(0, 0, 10, 20);
  ctx.fillStyle = withAlpha(color, 0.22);
  ctx.fillRect(10, 0, 10, 20);
  return pattern((20 * Math.PI) / 180);
}

// Canvas can't express "multi-stop color horizontally × alpha fade vertically"
// as one gradient, so multi-color fills composite the two on an offscreen canvas
// sized to the chart: paint the horizontal color run, then mask it with a
// vertical alpha ramp via destination-in. Regenerated on resize (patterns anchor
// to the renderer's origin at natural pixel size).
function gradientFillTexture(
  slots: string[],
  width: number,
  height: number,
  reverse: boolean,
  alpha: number
): HTMLCanvasElement | null {
  if (typeof document === "undefined" || width < 1 || height < 1) return null;

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const colors = ctx.createLinearGradient(0, 0, canvas.width, 0);
  slots.forEach((color, i) =>
    colors.addColorStop(i / (slots.length - 1), color)
  );
  ctx.fillStyle = colors;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const fade = ctx.createLinearGradient(0, 0, 0, canvas.height);
  fade.addColorStop(0, `rgba(0, 0, 0, ${reverse ? 0 : alpha})`);
  fade.addColorStop(1, `rgba(0, 0, 0, ${reverse ? alpha : 0})`);
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  return canvas;
}

// A pattern fill (dotted/lines/hatched) faded vertically — opaque at the top
// (near the line), transparent toward the baseline — so it reads like the
// gradient variant instead of a flat wall of pattern. The tiling pattern can't
// itself carry an alpha ramp, so bake it into a plot-sized texture: tile the
// pattern (reusing patternFill's tile + rotation), then mask it with a vertical
// alpha ramp via destination-in.
function patternFadeTexture(
  kind: "dotted" | "lines" | "hatched",
  color: string,
  width: number,
  height: number
): HTMLCanvasElement | null {
  const patternObj = patternFill(kind, color);
  if (!patternObj || typeof document === "undefined" || width < 1 || height < 1)
    return null;
  const tile = patternObj.image;
  if (!(tile instanceof HTMLCanvasElement)) return null;
  const rotation = patternObj.rotation ?? 0;
  const tileScale = patternObj.scaleX ?? 1;

  const w = Math.ceil(width);
  const h = Math.ceil(height);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const pat = ctx.createPattern(tile, "repeat");
  if (!pat) return null;
  // Replicate the ECharts ImagePattern transform (rotate the tiling, scale the
  // dpr tile back to CSS size) so the baked texture matches the plain pattern.
  if (typeof pat.setTransform === "function") {
    const m = new DOMMatrix();
    m.rotateSelf((rotation * 180) / Math.PI);
    m.scaleSelf(tileScale, tileScale);
    pat.setTransform(m);
  }
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, w, h);

  const fade = ctx.createLinearGradient(0, 0, 0, h);
  fade.addColorStop(0, "rgba(0, 0, 0, 1)");
  fade.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, w, h);

  return canvas;
}

function fillPaint(
  variant: AreaVariant,
  showUnselected: boolean,
  slots: string[],
  size: { width: number; height: number },
  alpha: number
): string | echarts.graphic.LinearGradient | ImagePatternObject {
  const base = slots[0] ?? "rgba(120, 120, 120, 1)";
  const multi = slots.length > 1;

  if (variant === "none") return "transparent";

  if (showUnselected) {
    return patternFill("stripe", base) ?? withAlpha(base, 0.1);
  }

  switch (variant) {
    case "gradient":
    case "gradient-reverse": {
      const reverse = variant === "gradient-reverse";
      if (multi) {
        const texture = gradientFillTexture(
          slots,
          size.width,
          size.height,
          reverse,
          alpha
        );
        if (texture) return { image: texture, repeat: "no-repeat" };
      }
      return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: withAlpha(base, reverse ? 0 : alpha) },
        { offset: 1, color: withAlpha(base, reverse ? alpha : 0) },
      ]);
    }
    case "solid": {
      if (multi) {
        return new echarts.graphic.LinearGradient(
          0,
          0,
          1,
          0,
          slots.map((color, i) => ({
            offset: i / (slots.length - 1),
            color: withAlpha(color, alpha),
          }))
        );
      }
      return withAlpha(base, alpha);
    }
    case "dotted":
    case "lines":
    case "hatched": {
      const texture = patternFadeTexture(
        variant,
        base,
        size.width,
        size.height
      );
      if (texture) return { image: texture, repeat: "no-repeat" };
      return patternFill(variant, base) ?? withAlpha(base, 0.1);
    }
    default:
      return withAlpha(base, 0.1);
  }
}


function curveConfig(curveType: CurveType): {
  smooth: boolean;
  step: "middle" | false;
  smoothMonotone?: "x" | "y";
} {
  if (curveType === "step") return { smooth: false, step: "middle" };
  if (curveType === "linear") return { smooth: false, step: false };
  if (curveType === "monotone" || curveType === "monotoneX") return { smooth: true, step: false, smoothMonotone: "x" };
  if (curveType === "monotoneY") return { smooth: true, step: false, smoothMonotone: "y" };
  return { smooth: true, step: false };
}


function getOpacity(selected: string | null, key: string) {
  if (selected === null || selected === key)
    return { fill: 0.8, stroke: 1, dot: 1 };
  return { fill: 0.1, stroke: 0.3, dot: 0.3 };
}


function getLoadingData(points: number): number[] {
  const rows: number[] = [];
  let value = 30 + Math.random() * 20;
  for (let i = 0; i < points; i++) {
    value = Math.min(58, Math.max(16, value + (Math.random() - 0.5) * 16));
    rows.push(Math.round(value));
  }
  return rows;
}

function shimmerWindowStops(center: number, color: string, peak: number) {
  const half = LOADING_SHIMMER_BAND;
  const feather = LOADING_SHIMMER_FEATHER;

  const alphaAt = (x: number) => {
    const dist = Math.abs(x - center);
    if (dist <= half - feather) return peak;
    if (dist >= half) return 0;
    return (
      peak * Math.sin(((1 - (dist - (half - feather)) / feather) * Math.PI) / 2)
    );
  };

  const offsets = [
    0,
    center - half,
    center - half + feather,
    center,
    center + half - feather,
    center + half,
    1,
  ]
    .filter((x) => x >= 0 && x <= 1)
    .sort((a, b) => a - b);

  const stops: { offset: number; color: string }[] = [];
  for (const offset of offsets) {
    const last = stops[stops.length - 1];
    if (last === undefined || offset - last.offset > 1e-4) {
      stops.push({ offset, color: withAlpha(color, alphaAt(offset)) });
    }
  }
  return stops;
}

const BUFFER_PREFIX = "__buffer-";
const BUFFERFILL_PREFIX = "__bufferfill-";
const SELECTION_Z = 105;
const SELECTION_FILL_ALPHA = 0.08;
const SELECTION_STROKE_ALPHA = 0.22;
const REVEAL_PREFIX = "__reveal-";
const REVEAL_MUTE_OPACITY = 0.3;
const SCRUB_SKIP_PREFIXES = [REVEAL_PREFIX, "__mini-", "__loading"] as const;
const SCRUB_LERP = 0.18;
const SCRUB_DOT_HALO_ALPHA = 0.25;


type OptionBuildContext = {
  data: Record<string, unknown>[];
  config: ChartConfig;
  areas: AreaSeriesConfig[];
  seriesKeys: string[];
  curveType: CurveType;
  isStacked: boolean;
  isExpanded: boolean;
  selectedDataKey: string | null;
  hasSelection: boolean;
  showGrid: boolean;
  gridVariant: GridLineVariant;
  gridOpacity: number;
  xAxisSlot: XAxisSlot;
  yAxisSlot: YAxisSlot;
  tooltipSlot: TooltipSlot;
  legendSlot: LegendSlot;
  isLoading: boolean;
  loadingData: () => number[];
  showBrush: boolean;
  brushHeight: number;
  enableHoverHighlight: boolean;
  enableHoverReveal: boolean;
  revealSink: Record<string, unknown[]>;
  resolved: ResolvedColors;
  rendererSize: { width: number; height: number };
  categories: string[];
  brushRange: BrushRange;
  getHoveredKey: () => string | null;
};

// Grid insets plus the footer band reserved for the brush. ECharts 6 contains
// axis labels automatically (the legacy `containLabel` flag now only triggers a
// deprecation warning).
function buildChartLayout({
  legendSlot,
  xAxisSlot,
  showBrush,
  brushHeight,
}: OptionBuildContext): {
  grid: GridComponentOption;
  brushBottom: number;
} {
  const legendTop = legendSlot.present && legendSlot.verticalAlign === "top";
  const legendBottom =
    legendSlot.present && legendSlot.verticalAlign === "bottom";
  const brushGap = showBrush
    ? brushHeight + 30 + (xAxisSlot.label ? 22 : 0)
    : 0;

  return {
    grid: {
      left: 20,
      right: 20,
      top: legendTop ? 42 : 16,
      bottom: 8 + brushGap + (legendBottom ? 34 : 0),
    },
    brushBottom: legendBottom ? 34 : 6,
  };
}

function buildMainAxes(ctx: OptionBuildContext): {
  xAxis: XAxisOption;
  yAxis: YAxisOption;
} {
  const {
    xAxisSlot,
    yAxisSlot,
    showGrid,
    gridVariant,
    gridOpacity,
    isLoading,
    isExpanded,
    categories,
    loadingData,
  } = ctx;
  const { tokens } = ctx.resolved;

  const axisLabelColor = tokens.mutedForeground;
  const splitLineColor = withAlpha(tokens.border, GRID_LINE_OPACITY * gridOpacity);
  const tickDotColor = flattenColor(splitLineColor, tokens.background);

  const xTickFormatter = xAxisSlot.tickFormatter;
  const yTickFormatter = yAxisSlot.tickFormatter;

  const xAxis: XAxisOption = {
    type: "category",
    boundaryGap: false,
    show: true,
    data: isLoading ? loadingData().map((_, i) => i) : categories,
    name: isLoading ? undefined : xAxisSlot.label,
    nameLocation: "middle",
    nameGap: 30,
    nameTextStyle: { color: axisLabelColor, fontSize: 10 },
    axisLine: buildZeroBaselineAxisLine(
      ctx.data,
      isLoading
        ? []
        : ctx.areas
            .filter((area) => area.visible !== false)
            .map((area) => area.dataKey),
      axisLabelColor
    ),
    axisTick: {
      show: !isLoading && xAxisSlot.present && !xAxisSlot.hideDots,
      length: 0.5,
      lineStyle: { color: tickDotColor, width: 3, cap: "round" },
    },
    splitLine: { show: false },
    axisLabel: {
      show: !isLoading && xAxisSlot.present,
      color: axisLabelColor,
      fontSize: 10,
      margin: 8,
      formatter: xTickFormatter
        ? (value: string, index: number) => xTickFormatter(value, index)
        : undefined,
    },
  };

  // An ECharts axis with `show: false` hides its splitLines too, but Recharts'
  // <CartesianGrid> draws with or without a visible <YAxis>. Keep the axis on
  // whenever <Grid/> is present and gate the LABELS on <YAxis/> instead.
  const yAxis: YAxisOption = {
    type: "value",
    show: yAxisSlot.present || showGrid,
    min: isExpanded ? 0 : yAxisSlot.min,
    max: isExpanded ? 1 : yAxisSlot.max,
    interval: isExpanded ? undefined : yAxisSlot.interval,
    scale: !isExpanded && yAxisSlot.scale,
    name: isLoading ? undefined : yAxisSlot.label,
    nameLocation: "middle",
    nameGap: 38,
    nameTextStyle: { color: axisLabelColor, fontSize: 10 },
    axisLine: { show: false },
    axisTick: {
      show: yAxisSlot.present && !isLoading && !yAxisSlot.hideDots,
      length: 0.5,
      lineStyle: { color: tickDotColor, width: 3, cap: "round" },
    },
    splitLine: {
      show: showGrid && !isLoading,
      lineStyle: {
        color: splitLineColor,
        type: gridVariant === "solid" ? "solid" : ([3, 3] as [number, number]),
        width: 1,
      },
    },
    axisLabel: {
      show: yAxisSlot.present && !isLoading,
      color: axisLabelColor,
      fontSize: 10,
      margin: 8,
      formatter: isExpanded
        ? (value: number) => `${Math.round(value * 100)}%`
        : yTickFormatter
          ? (value: number, index: number) => yTickFormatter(value, index)
          : undefined,
    },
  };

  return { xAxis, yAxis };
}

function tooltipBodyHtml(
  items: readonly TooltipBodyItem[],
  tooltipSlot: TooltipSlot,
  row: Record<string, unknown> | undefined
): string {
  if (items.length > 0) {
    return composeTooltipBody(items, tooltipSlot.layout, tooltipSlot.barMax);
  }
  const emptyLabel =
    typeof tooltipSlot.emptyLabel === "function"
      ? tooltipSlot.emptyLabel(row)
      : (tooltipSlot.emptyLabel ?? "");
  return emptyLabel.length > 0 ? tooltipEmptyBody(emptyLabel) : "";
}

function createTooltipFormatter(ctx: OptionBuildContext) {
  const { config, data, selectedDataKey, tooltipSlot, getHoveredKey, resolved } =
    ctx;

  return (params: unknown): string => {
    const rows = Array.isArray(params) ? params : [params];
    if (!rows.length) return "";

    const first = rows[0] as {
      axisValue?: string | number;
      name?: string;
      dataIndex?: number;
    };
    const hoveredRow =
      typeof first.dataIndex === "number" ? data[first.dataIndex] : undefined;
    const axisValue = first.axisValue ?? first.name ?? "";
    const labelValue =
      tooltipSlot.labelKey && hoveredRow?.[tooltipSlot.labelKey] != null
        ? hoveredRow[tooltipSlot.labelKey]
        : axisValue;
    const rawLabel = String(labelValue);
    const label = tooltipSlot.labelFormatter
      ? tooltipSlot.labelFormatter(rawLabel)
      : rawLabel;
    const rowGroups = tooltipSlot.rowGroups;
    if (rowGroups && rowGroups.length > 0 && typeof first.dataIndex === "number") {
      const groups: TooltipBodyGroup[] = [];
      for (const group of rowGroups) {
        const [heading] = tooltipItemsFromRow(
          hoveredRow,
          [group.headingKey],
          config,
          tooltipSlot.valueFormatter,
          resolved.series,
          tooltipSlot.hideZeros
        );
        if (heading === undefined) {
          continue;
        }
        groups.push({
          heading,
          items: tooltipItemsFromRow(
            hoveredRow,
            group.rowKeys,
            config,
            tooltipSlot.valueFormatter,
            resolved.series,
            tooltipSlot.hideZeros
          ),
        });
      }
      const cappedGroups = capTooltipGroups(
        groups,
        tooltipSlot.maxRows,
        tooltipSlot.moreLabel ?? defaultMoreLabel,
        tooltipSlot.valueFormatter
      );
      return tooltipShell({
        label,
        body:
          groups.length > 0
            ? tooltipSlot.layout === "rows"
              ? composeTooltipSectionedRows(cappedGroups)
              : composeTooltipGroupedBody(cappedGroups)
            : tooltipBodyHtml([], tooltipSlot, hoveredRow),
        roundness: tooltipSlot.roundness,
        variant: tooltipSlot.variant,
        layout: tooltipSlot.layout === "rows" ? "rows" : "activity",
      });
    }
    const rowKeys = tooltipSlot.rowKeys;
    if (rowKeys && rowKeys.length > 0 && typeof first.dataIndex === "number") {
      const items = capTooltipItems(
        tooltipItemsFromRow(
          hoveredRow,
          rowKeys,
          config,
          tooltipSlot.valueFormatter,
          resolved.series,
          tooltipSlot.hideZeros
        ),
        tooltipSlot.maxRows,
        tooltipSlot.moreLabel ?? defaultMoreLabel,
        tooltipSlot.valueFormatter
      );
      return tooltipShell({
        label,
        body: tooltipBodyHtml(items, tooltipSlot, hoveredRow),
        roundness: tooltipSlot.roundness,
        variant: tooltipSlot.variant,
        layout: tooltipSlot.layout,
      });
    }

    const excludedKeys = new Set(tooltipSlot.excludeKeys);
    const seen = new Set<string>();
    const items: TooltipBodyItem[] = [];
    for (const param of rows) {
      const p = param as {
        seriesId?: string;
        seriesName?: string;
        value?: number | string | null;
      };
      const rawId = String(p.seriesId ?? "");
      const key = rawId.startsWith(BUFFER_PREFIX)
        ? rawId.slice(BUFFER_PREFIX.length)
        : rawId.startsWith("__")
          ? ""
          : (p.seriesId ?? p.seriesName ?? "");
      if (!key || excludedKeys.has(key)) continue;
      if (p.value === null || p.value === undefined) continue;
      const formatted = formatTooltipValue(
        p.value,
        tooltipSlot.valueFormatter
      );
      if (
        tooltipSlot.hideZeros &&
        (formatted.numeric === null || formatted.numeric <= 0)
      ) {
        continue;
      }
      if (seen.has(key)) continue;
      seen.add(key);

      const item = config[key];
      const colorsCount = item ? getColorsCount(item) : 1;
      const labelText =
        typeof item?.label === "string" ? item.label : (p.seriesName ?? key);
      const hovered = getHoveredKey();
      const dimmed =
        selectedDataKey != null && selectedDataKey !== key
          ? " opacity-30"
          : tooltipSlot.layout === "bars"
            ? ""
            : hovered != null && hovered !== key
              ? " opacity-30"
              : "";
      items.push({
        key,
        colorsCount,
        labelText,
        value: formatted.numeric,
        valueText: formatted.text,
        dimmed,
        indicatorHtml: configIndicatorHtml(item),
        paint: resolvedIndicatorBackground(
          resolved.series[key] ?? ["rgba(120, 120, 120, 1)"]
        ),
      });
    }

    return tooltipShell({
      label,
      body: tooltipBodyHtml(
        capTooltipItems(
          items,
          tooltipSlot.maxRows,
          tooltipSlot.moreLabel ?? defaultMoreLabel,
          tooltipSlot.valueFormatter
        ),
        tooltipSlot,
        hoveredRow
      ),
      roundness: tooltipSlot.roundness,
      variant: tooltipSlot.variant,
      layout: tooltipSlot.layout,
    });
  };
}

function buildTooltipOption(ctx: OptionBuildContext): TooltipComponentOption {
  const { tooltipSlot, isLoading } = ctx;
  const { tokens } = ctx.resolved;

  return {
    ...tooltipBaseOption({
      present: tooltipSlot.present && !isLoading,
      cursor: tooltipSlot.scrub ? false : tooltipSlot.cursor,
      crosshair: tooltipSlot.crosshair,
      tokens,
      position: tooltipSlot.position,
      axisPointerColor: withAlpha(tokens.mutedForeground, AXIS_POINTER_OPACITY),
      strokeWidth: AXIS_POINTER_WIDTH,
      confine: tooltipSlot.confine,
      scrub: tooltipSlot.scrub,
    }),
    ...(tooltipSlot.scrub ? { triggerOn: "none" as const } : {}),
    formatter: withTooltipSizeMotion(createTooltipFormatter(ctx)),
  };
}

function buildBrushOption(
  ctx: OptionBuildContext,
  brushBottom: number
): {
  miniGrid: GridComponentOption;
  miniXAxis: XAxisOption;
  miniYAxis: YAxisOption;
  miniSeries: LineSeriesOption[];
  dataZoom: DataZoomComponentOption[];
} {
  const {
    data,
    areas,
    curveType,
    isStacked,
    selectedDataKey,
    brushHeight,
    categories,
  } = ctx;
  const { tokens } = ctx.resolved;

  const miniGrid: GridComponentOption = {
    left: 8,
    right: 8,
    bottom: brushBottom,
    height: brushHeight,
    outerBoundsMode: "none",
  };

  const miniXAxis: XAxisOption = {
    type: "category",
    gridIndex: 1,
    boundaryGap: false,
    show: false,
    data: categories,
    axisPointer: { show: false },
  };

  const miniYAxis: YAxisOption = { type: "value", gridIndex: 1, show: false };

  const miniSeries: LineSeriesOption[] = areas.map((area) => {
    const key = area.dataKey;
    const base =
      (ctx.resolved.series[key] ?? [])[0] ?? "rgba(120, 120, 120, 1)";
    const curve = curveConfig(area.curveType ?? curveType);

    const opacity = getOpacity(selectedDataKey, key);
    const strokeDim = opacity.stroke;
    const fillDim = opacity.fill / 0.8;

    return {
      id: `__mini-${key}`,
      type: "line",
      xAxisIndex: 1,
      yAxisIndex: 1,
      data: data.map((row) => areaPointValue(row, key, area.gapMissing)),
      stack: isStacked ? "__mini-total" : undefined,
      smooth: curve.smooth,
      smoothMonotone: curve.smoothMonotone,
      step: curve.step,
      connectNulls: area.connectNulls,
      silent: true,
      showSymbol: false,
      emphasis: { disabled: true },
      tooltip: { show: false },
      lineStyle: {
        color: base,
        width: 1,
        opacity: BRUSH_STROKE_OPACITY * strokeDim,
      },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: withAlpha(base, BRUSH_FILL_OPACITY * fillDim) },
          { offset: 1, color: withAlpha(base, 0) },
        ]),
      },
      z: 0,
    };
  });

  const dataZoom = buildBrushDataZoom({
    brushBottom,
    brushHeight,
    brushRange: ctx.brushRange,
    fillerColor: withAlpha(tokens.foreground, BRUSH_FILLER_OPACITY),
  });

  return { miniGrid, miniXAxis, miniYAxis, miniSeries, dataZoom };
}

function buildLoadingOption(
  ctx: OptionBuildContext,
  frame: { grid: GridComponentOption; xAxis: XAxisOption; yAxis: YAxisOption }
): EChartsOption {
  const { tokens } = ctx.resolved;
  const curve = curveConfig(ctx.curveType);

  return {
    animation: false,
    grid: frame.grid,
    xAxis: frame.xAxis,
    yAxis: frame.yAxis,
    tooltip: { show: false },
    series: [
      {
        id: "__loading",
        type: "line",
        data: ctx.loadingData(),
        smooth: curve.smooth,
        smoothMonotone: curve.smoothMonotone,
        step: curve.step,
        showSymbol: false,
        silent: true,
        lineStyle: { color: withAlpha(tokens.foreground, 0), width: 1 },
        areaStyle: { color: withAlpha(tokens.foreground, 0) },
        z: 1,
      },
    ],
  };
}

function buildAreaSeries(ctx: OptionBuildContext): LineSeriesOption[] {
  const {
    data,
    config,
    areas,
    seriesKeys,
    curveType,
    isStacked,
    isExpanded,
    selectedDataKey,
    hasSelection,
    enableHoverHighlight,
    enableHoverReveal,
    revealSink,
    resolved,
    rendererSize,
    tooltipSlot,
  } = ctx;

  const rowTotals = isExpanded
    ? data.map((row) =>
        seriesKeys.reduce((sum, key) => sum + (Number(row[key]) || 0), 0)
      )
    : [];

  return areas.flatMap((area): LineSeriesOption[] => {
    const key = area.dataKey;
    const slots = resolved.series[key] ?? ["rgba(120, 120, 120, 1)"];
    const paint = seriesPaint(slots);
    const isSelected = selectedDataKey === key;
    const showUnselected = hasSelection && !isSelected;
    const opacity = getOpacity(selectedDataKey, key);
    const curve = curveConfig(area.curveType ?? curveType);

    const values = data.map((row, i) => {
      const value = areaPointValue(row, key, area.gapMissing);
      if (!isExpanded) return value;
      if (value === null) return null;
      const total = rowTotals[i];
      return total ? value / total : 0;
    });
    const lastPresent = lastPresentIndex(values);
    const scrub = tooltipSlot.scrub;
    const reveal = enableHoverReveal || scrub;
    const buffer = area.enableBufferLine && lastPresent >= 1 && !reveal;

    const restingDot = dotStyle(
      area.dotVariant,
      paint,
      resolved.tokens.background
    );
    const activeDot = dotStyle(
      area.activeDotVariant,
      paint,
      resolved.tokens.background
    );
    const restingVisible = area.dotVariant !== "none";
    const hoverSymbol = area.activeDotVariant !== "none";
    const dotOpacity = opacity.dot;
    const multiColor = slots.length > 1;

    const strokePaint =
      reveal && multiColor
        ? new echarts.graphic.LinearGradient(
            8,
            0,
            Math.max(rendererSize.width - 8, 9),
            0,
            slots.map((color, i) => ({
              offset: i / (slots.length - 1),
              color,
            })),
            true
          )
        : paint;

    type AreaPoint =
      | number
      | null
      | {
          value: number;
          itemStyle: Record<string, unknown>;
          emphasis: { itemStyle: Record<string, unknown> };
        };
    const toPoints = (vals: (number | null)[]): AreaPoint[] =>
      multiColor
        ? vals.map((value, i): AreaPoint => {
            if (value === null) return null;
            const t = vals.length > 1 ? i / (vals.length - 1) : 0;
            const pointColor = sampleGradient(slots, t);
            return {
              value,
              itemStyle: {
                ...dotItemStyle(
                  restingVisible ? area.dotVariant : area.activeDotVariant,
                  pointColor,
                  resolved.tokens.background
                ),
                opacity: dotOpacity,
              },
              emphasis: {
                itemStyle: {
                  ...dotItemStyle(
                    area.activeDotVariant === "none"
                      ? "default"
                      : area.activeDotVariant,
                    pointColor,
                    resolved.tokens.background
                  ),
                  opacity: 1,
                },
              },
            };
          })
        : vals;

    if (reveal) revealSink[key] = toPoints(values);

    const mainValues: (number | null)[] = buffer
      ? values.map((v, i) => (i === lastPresent ? null : v))
      : values;

    const mainDash: "solid" | [number, number] =
      buffer || area.strokeVariant === "solid"
        ? "solid"
        : ([3, 3] as [number, number]);

    const z = isSelected ? 3 : hasSelection ? 1 : 2;

    const isHidden = area.visible === false;
    const strokeOpacity = isHidden ? 0 : opacity.stroke;
    const fillOpacity = isHidden ? 0 : opacity.fill;
    const dotVisibleOpacity = isHidden ? 0 : dotOpacity;

    const mainSeries: LineSeriesOption = {
      id: key,
      name: typeof config[key]?.label === "string" ? config[key]?.label : key,
      type: "line",
      data: toPoints(mainValues),
      stack: isStacked ? "total" : undefined,
      smooth: curve.smooth,
      smoothMonotone: curve.smoothMonotone,
      step: curve.step,
      connectNulls: area.connectNulls,
      cursor: scrub
        ? "crosshair"
        : area.isClickable && !isHidden
          ? "pointer"
          : "default",
      // By default ECharts only fires mouse events on the symbols — this makes
      // the line AND the filled area clickable, like the Recharts <Area>.
      // (`true` covers both; the deprecated `triggerLineEvent` did the same.)
      triggerEvent: area.isClickable && !isHidden,
      showSymbol:
        (!scrub || area.dotIndices !== undefined) &&
        !isHidden &&
        (restingVisible || hoverSymbol),
      symbol: "circle",
      symbolSize: area.dotIndices
        ? (_value, params) => area.dotIndices?.includes(params.dataIndex) ? restingDot.size : 0
        : restingVisible ? restingDot.size : activeDot.size,
      z,
      lineStyle: {
        color: strokePaint,
        width: area.strokeWidth,
        opacity: strokeOpacity,
        type: mainDash,
        dashOffset: 0,
        ...(scrub
          ? { cap: "round" as const, join: "round" as const, shadowBlur: 0 }
          : {}),
      },
      itemStyle: multiColor
        ? {
            opacity: isHidden
              ? 0
              : restingVisible
                ? dotVisibleOpacity
                : hoverSymbol
                  ? 0
                  : dotVisibleOpacity,
          }
        : {
            ...(restingVisible ? restingDot.itemStyle : activeDot.itemStyle),
            opacity: isHidden
              ? 0
              : restingVisible
                ? dotVisibleOpacity
                : hoverSymbol
                  ? 0
                  : dotVisibleOpacity,
          },
      areaStyle: {
        color: fillPaint(
          area.variant,
          showUnselected,
          slots,
          rendererSize,
          area.fillAlpha
        ),
        opacity: fillOpacity,
      },
      emphasis: isHidden || scrub
        ? { disabled: true }
        : {
        focus:
          enableHoverHighlight && !enableHoverReveal && !hasSelection
            ? "series"
            : "none",
        scale: restingVisible
          ? activeDot.size / Math.max(restingDot.size, 1)
          : 1,
        ...(multiColor
          ? {}
          : { itemStyle: { ...activeDot.itemStyle, opacity: 1 } }),
      },
      blur: isHidden
        ? {
            lineStyle: { opacity: 0 },
            areaStyle: { opacity: 0 },
            itemStyle: { opacity: 0 },
          }
        : {
        lineStyle: { opacity: 0.3 },
        areaStyle: { opacity: 0.1 },
        itemStyle: { opacity: 0.3 },
      },
      ...(isHidden ? { tooltip: { show: false } } : {}),
    };

    if (isHidden) return [mainSeries];

    if (reveal) {
      const revealBase: LineSeriesOption = {
        id: `${REVEAL_PREFIX}${key}`,
        type: "line",
        data: values,
        stack: isStacked ? "__reveal-total" : undefined,
        smooth: curve.smooth,
        smoothMonotone: curve.smoothMonotone,
        step: curve.step,
        connectNulls: area.connectNulls,
        silent: true,
        showSymbol: area.dotIndices !== undefined && restingVisible,
        symbol: "circle",
        symbolSize: (_value, params) =>
          area.dotIndices?.includes(params.dataIndex) ? restingDot.size : 0,
        itemStyle: { ...restingDot.itemStyle, opacity: 0 },
        z: z - 1,
        lineStyle: {
          color: strokePaint,
          width: area.strokeWidth,
          type: mainDash,
          opacity: 0,
        },
        emphasis: { disabled: true },
        blur: { lineStyle: { opacity: 0 } },
        tooltip: { show: false },
      };
      return [revealBase, mainSeries];
    }

    if (!buffer) return [mainSeries];

    const bufferValues: (number | null)[] = values.map((v, i) =>
      i >= lastPresent - 1 && i <= lastPresent ? v : null
    );
    const bufferSeries: LineSeriesOption = {
      id: `${BUFFER_PREFIX}${key}`,
      type: "line",
      data: toPoints(bufferValues),
      stack: isStacked ? "__buffer-total" : undefined,
      smooth: curve.smooth,
      smoothMonotone: curve.smoothMonotone,
      step: curve.step,
      connectNulls: true,
      silent: true,
      showSymbol: restingVisible,
      symbol: "circle",
      symbolSize: area.dotIndices
        ? (_value, params) => area.dotIndices?.includes(params.dataIndex) ? restingDot.size : 0
        : restingVisible ? restingDot.size : activeDot.size,
      z,
      lineStyle: {
        color: paint,
        width: area.strokeWidth,
        opacity: opacity.stroke,
        type: BUFFER_DASH,
      },
      itemStyle: multiColor
        ? { opacity: dotOpacity }
        : {
            ...(restingVisible ? restingDot.itemStyle : activeDot.itemStyle),
            opacity: dotOpacity,
          },
      emphasis: {
        focus: "none",
        scale: false,
        lineStyle: { opacity: opacity.stroke },
        itemStyle: { opacity: dotOpacity },
      },
      blur: {
        lineStyle: { opacity: opacity.stroke },
        itemStyle: { opacity: dotOpacity },
      },
    };

    const bufferFillSeries: LineSeriesOption = {
      id: `${BUFFERFILL_PREFIX}${key}`,
      type: "line",
      data: toPoints(bufferValues),
      stack: isStacked ? "__bufferfill-total" : undefined,
      smooth: curve.smooth,
      smoothMonotone: curve.smoothMonotone,
      step: curve.step,
      connectNulls: true,
      silent: true,
      showSymbol: false,
      z: z - 1,
      lineStyle: { opacity: 0 },
      areaStyle: {
        color: fillPaint(
          area.variant,
          showUnselected,
          slots,
          rendererSize,
          area.fillAlpha
        ),
        opacity: opacity.fill,
      },
      emphasis: { disabled: true },
      blur: { areaStyle: { opacity: 0.1 } },
      tooltip: { show: false },
    };

    return [mainSeries, bufferSeries, bufferFillSeries];
  });
}

function areaPointValue(
  row: Record<string, unknown>,
  key: string,
  gapMissing: boolean
): number | null {
  if (gapMissing && (!(key in row) || row[key] === null)) return null;
  return Number(row[key]) || 0;
}

function lastPresentIndex(values: readonly (number | null)[]): number {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] !== null) return index;
  }
  return -1;
}

function computePlottedTops(ctx: OptionBuildContext): Record<string, number[]> {
  const { data, areas, seriesKeys, isStacked, isExpanded } = ctx;
  const rowTotals = isExpanded
    ? data.map((row) =>
        seriesKeys.reduce((sum, key) => sum + (Number(row[key]) || 0), 0)
      )
    : [];
  const running = new Array(data.length).fill(0);
  const tops: Record<string, number[]> = {};
  for (const area of areas) {
    const key = area.dataKey;
    tops[key] = data.map((row, i) => {
      let value = areaPointValue(row, key, area.gapMissing) ?? 0;
      if (isExpanded) value = rowTotals[i] ? value / rowTotals[i] : 0;
      return isStacked ? (running[i] += value) : value;
    });
  }
  return tops;
}

// Overlapping area polygons all contain the same pixel, so ECharts' native hit
// test lands on whichever series drew topmost — not the band the user SEES.
// Resolve the intended series geometrically: a plotted line within grab
// distance of the pointer wins outright; otherwise the point belongs to the
// nearest line ABOVE it (the boundary of the band the pointer is inside).
// Returns null when the pointer is outside the grid or above every line.
function resolveAreaAtPixel(
  chart: EChartsInstance,
  tops: Record<string, number[]>,
  keys: string[],
  x: number,
  y: number
): string | null {
  if (keys.length < 2) return null;
  if (!chart.containPixel({ gridIndex: 0 }, [x, y])) return null;
  const [rawIndex] = chart.convertFromPixel({ gridIndex: 0 }, [x, y]);
  const index = Math.round(rawIndex ?? 0);

  let nearest: string | null = null;
  let nearestDist = Number.POSITIVE_INFINITY;
  let above: string | null = null;
  let abovePixelY = Number.NEGATIVE_INFINITY;
  for (const key of keys) {
    const value = tops[key]?.[index];
    if (value === undefined) continue;
    const pixelY =
      chart.convertToPixel({ gridIndex: 0 }, [index, value])[1] ?? 0;
    const dist = Math.abs(pixelY - y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = key;
    }
    if (pixelY <= y && pixelY > abovePixelY) {
      abovePixelY = pixelY;
      above = key;
    }
  }
  return nearestDist <= 10 ? nearest : above;
}


type LiveState = {
  resolved: ResolvedColors | null;
  hoveredKey: string | null;
  hasRevealed: boolean;
  revealEndsAt: number;
  loadingRows: number[] | null;
  categories: string[];
  dataLength: number;
  plottedTops: Record<string, number[]>;
  seriesKeyByIndex: (string | undefined)[];
  companionIdsByKey: Map<string, string[]>;
  revealIndex: number | null;
  revealValues: Record<string, unknown[]>;
  brushRange: BrushRange;
  brushGeom: BrushGeometry | null;
  brushOverlay: BrushOverlayElements | null;
  brushHover: { inside: boolean; left: boolean; right: boolean };
  scrubStore: ScrubOverlayStore;
  scrubIndex: number | null;
  scrubX: number | null;
  scrubY: number;
  scrubOpacity: number;
  scrubTarget: number;
  scrubRaf: number;
  scrubDotKeys: string[];
  paintScrub: () => void;
  drag: { startIndex: number; endIndex: number; x: number; y: number } | null;
  selectionRect: InstanceType<typeof echarts.graphic.Rect> | null;
  paintSelection: () => void;
  handlers: {
    onBrushChange?: (range: { startIndex: number; endIndex: number }) => void;
    onSelectionChange?: (key: string | null) => void;
    onRangeSelect?: (selection: ChartRangeSelection) => void;
    tooltipOn: boolean;
    clickableKeys: Set<string>;
    selectedDataKey: string | null;
    brushFormatLabel?: (value: string, index: number) => string;
    seriesKeys: string[];
    enableHoverHighlight: boolean;
    enableHoverReveal: boolean;
    enableScrub: boolean;
  };
  repush: () => void;
};

function createLiveState(): LiveState {
  return {
    resolved: null,
    hoveredKey: null,
    hasRevealed: false,
    revealEndsAt: 0,
    loadingRows: null,
    categories: [],
    dataLength: 0,
    plottedTops: {},
    seriesKeyByIndex: [],
    companionIdsByKey: new Map<string, string[]>(),
    revealIndex: null,
    revealValues: {},
    brushRange: { start: 0, end: 100 },
    brushGeom: null,
    brushOverlay: null,
    brushHover: { inside: false, left: false, right: false },
    scrubStore: emptyScrubStore(),
    scrubIndex: null,
    scrubX: null,
    scrubY: 0,
    scrubOpacity: 0,
    scrubTarget: 0,
    scrubRaf: 0,
    scrubDotKeys: [],
    paintScrub: () => {},
    drag: null,
    selectionRect: null,
    paintSelection: () => {},
    handlers: {
      onBrushChange: undefined,
      onSelectionChange: undefined,
      onRangeSelect: undefined,
      tooltipOn: false,
      clickableKeys: new Set<string>(),
      selectedDataKey: null,
      brushFormatLabel: undefined,
      seriesKeys: [],
      enableHoverHighlight: false,
      enableHoverReveal: false,
      enableScrub: false,
    },
    repush: () => {},
  };
}


/**
 * Apache ECharts port of the EvilCharts area chart, exposing a compound-as-config
 * API so its JSX reads identically to the Recharts twin. The root owns the data,
 * config, selection state, loading skeleton, intro reveal, and optional zoom
 * brush; every visual part — `<Area>`, `<XAxis>`, `<YAxis>`, `<Grid>`,
 * `<Tooltip>`, `<Legend>` — is composed as a declarative child that renders
 * nothing. The root walks those children by reference and drives a single
 * imperative ECharts instance. Fully self-contained: its only dependencies are
 * `react` and `echarts`.
 */
export function EChartsAreaChart<TData extends Record<string, unknown>>({
  renderer = "canvas",
  data,
  config,
  xDataKey,
  className,
  curveType = "linear",
  stackType = "default",
  animation = true,
  animationType = "left-to-right",
  enableHoverHighlight = false,
  enableHoverReveal = false,
  defaultSelectedDataKey = null,
  selectedDataKey: selectedDataKeyProp,
  onSelectionChange,
  isLoading = false,
  loadingPoints = LOADING_DEFAULT_POINTS,
  chartOptions,
  markers,
  onRangeSelect,
  children,
}: EChartsAreaChartProps<TData>) {
  const rawId = useId();
  const chartId = `chart-${rawId.replace(/:/g, "")}`;

  const containerRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const echartsRef = useRef<EChartsInstance | null>(null);

  const liveRef = useRef<LiveState | null>(null);
  // react-doctor-disable-next-line react-hooks-js/refs -- bag is for ECharts event handlers, not render output
  if (liveRef.current === null) {
    liveRef.current = createLiveState();
  }
  // react-doctor-disable-next-line react-hooks-js/refs -- bag is for ECharts event handlers, not render output
  const live = liveRef.current;

  const loadingData = useCallback(
    () => (live.loadingRows ??= getLoadingData(loadingPoints)),
    [live, loadingPoints]
  );
  const shouldReduceMotion = useReducedMotion();

  const [internalSelectedKey, setSelectedDataKey] = useState<string | null>(
    defaultSelectedDataKey
  );
  const selectedDataKey =
    selectedDataKeyProp !== undefined
      ? selectedDataKeyProp
      : internalSelectedKey;

  const [hoveredDataKey, setHoveredDataKey] = useState<string | null>(null);

  const locale = useLocale();
  const collected = useMemo(
    () => withLocaleValueAxis(withLocaleTooltip(collectConfig(children), locale), locale),
    [children, locale]
  );
  const {
    areas,
    xAxis: xAxisSlot,
    yAxis: yAxisSlot,
    showGrid,
    gridVariant,
    gridOpacity,
    tooltip: tooltipSlot,
    legend: legendSlot,
    brush: brushSlot,
  } = collected;
  const showBrush = brushSlot.present;
  const brushHeight = brushSlot.height ?? 56;

  const seriesKeys = useMemo(() => areas.map((area) => area.dataKey), [areas]);

  const xCategoryKey = useMemo(() => {
    if (xAxisSlot.dataKey) return xAxisSlot.dataKey;
    if (xDataKey) return xDataKey as string;
    const firstRow = data[0];
    if (firstRow) {
      const claimed = new Set(seriesKeys);
      const found = Object.keys(firstRow).find((key) => !claimed.has(key));
      if (found) return found;
    }
    return "";
  }, [xAxisSlot.dataKey, xDataKey, data, seriesKeys]);

  const effectiveAnimation = areas[0]?.animationType ?? animationType;

  const css = useMemo(() => {
    const base = buildChartCss(chartId, config);
    if (!tooltipSlot.scrub) return base;
    return `${base}\n[data-chart="${chartId}"] canvas{cursor:crosshair!important;}`;
  }, [chartId, config, tooltipSlot.scrub]);

  const hasSelection = selectedDataKey !== null;
  const isExpanded = stackType === "expanded";
  const isStacked = stackType === "stacked" || isExpanded;

  const clickableKeys = useMemo(
    () =>
      new Set(
        areas.filter((area) => area.isClickable).map((area) => area.dataKey)
      ),
    [areas]
  );

  useLayoutEffect(() => {
    live.handlers.onRangeSelect = onRangeSelect;
    live.handlers.tooltipOn = tooltipSlot.present;
  }, [live, onRangeSelect, tooltipSlot.present]);

  useLayoutEffect(() => {
    live.handlers = {
      ...live.handlers,
      onBrushChange: brushSlot.onChange,
      onSelectionChange,
      clickableKeys,
      selectedDataKey,
      brushFormatLabel: brushSlot.formatLabel,
      seriesKeys,
      enableHoverHighlight,
      enableHoverReveal,
      enableScrub: tooltipSlot.scrub,
    };
    live.dataLength = data.length;
    if (live.scrubIndex !== null && live.scrubIndex >= data.length) {
      live.scrubIndex = data.length <= 0 ? null : data.length - 1;
    }
    const chart = echartsRef.current;
    if (!chart) return;
    if (tooltipSlot.scrub && !isLoading && data.length > 0) return;
    const hadScrub =
      live.scrubRaf !== 0 ||
      live.scrubIndex !== null ||
      live.scrubX !== null ||
      live.scrubTarget !== 0 ||
      live.scrubOpacity !== 0;
    if (!hadScrub) return;
    if (live.scrubRaf) cancelAnimationFrame(live.scrubRaf);
    live.scrubRaf = 0;
    live.scrubIndex = null;
    live.scrubX = null;
    live.scrubOpacity = 0;
    live.scrubTarget = 0;
    clearScrub(chart, live.scrubStore, SCRUB_SKIP_PREFIXES, seriesKeys);
    const zrDom = chart.getZr()?.dom as HTMLElement | undefined;
    if (zrDom) zrDom.style.cursor = "";
    chart.dispatchAction({ type: "hideTip" });
  }, [
    live,
    brushSlot.onChange,
    brushSlot.formatLabel,
    onSelectionChange,
    clickableKeys,
    selectedDataKey,
    seriesKeys,
    enableHoverHighlight,
    enableHoverReveal,
    tooltipSlot.scrub,
    data.length,
    isLoading,
  ]);

  const toggleSelection = useCallback(
    (key: string) => {
      const next = live.handlers.selectedDataKey === key ? null : key;
      if (next !== null && live.hoveredKey !== null) {
        const previous = live.hoveredKey;
        live.hoveredKey = null;
        setHoveredDataKey(null);
        echartsRef.current?.dispatchAction({
          type: "downplay",
          seriesIndex: live.handlers.seriesKeys.indexOf(previous),
        });
      }
      setSelectedDataKey(next);
      live.handlers.onSelectionChange?.(next);
    },
    [live]
  );

  const syncBrushOverlayNow = useCallback(() => {
    const chart = echartsRef.current;
    if (!chart) return;

    const geom = live.brushGeom;
    const tokens = live.resolved?.tokens;
    if (!geom || !tokens) {
      syncBrushOverlay(chart, live, null);
      return;
    }

    const range = live.brushRange;
    const categories = live.categories;
    const format = live.handlers.brushFormatLabel;
    const lastIndex = Math.max(categories.length - 1, 0);
    const startIndex = Math.round((range.start / 100) * lastIndex);
    const endIndex = Math.round((range.end / 100) * lastIndex);
    const labels =
      format && categories.length
        ? {
            start: format(categories[startIndex] ?? "", startIndex),
            end: format(categories[endIndex] ?? "", endIndex),
          }
        : null;

    syncBrushOverlay(chart, live, {
      range,
      geom,
      size: { width: chart.getWidth(), height: chart.getHeight() },
      tokens,
      labels,
      showLabels: live.brushHover.inside,
      hover: live.brushHover,
    });
  }, [live]);

  const buildOption = useCallback((): EChartsOption => {
    const resolved = live.resolved;
    if (!resolved) return {};

    const categories = data.map((row) => String(row[xCategoryKey]));
    live.categories = categories;

    const revealSink: Record<string, unknown[]> = {};

    const ctx: OptionBuildContext = {
      data,
      config,
      areas,
      seriesKeys,
      curveType,
      isStacked,
      isExpanded,
      selectedDataKey,
      hasSelection,
      showGrid,
      gridVariant,
      gridOpacity,
      xAxisSlot,
      yAxisSlot,
      tooltipSlot,
      legendSlot,
      isLoading,
      loadingData,
      showBrush,
      brushHeight,
      enableHoverHighlight,
      enableHoverReveal,
      resolved,
      rendererSize: {
        width:
          echartsRef.current?.getWidth() ?? mountRef.current?.clientWidth ?? 0,
        height:
          echartsRef.current?.getHeight() ??
          mountRef.current?.clientHeight ??
          0,
      },
      categories,
      brushRange: live.brushRange,
      getHoveredKey: () => live.hoveredKey,
      revealSink,
    };

    live.plottedTops = computePlottedTops(ctx);

    const { grid, brushBottom } = buildChartLayout(ctx);
    live.brushGeom = showBrush
      ? { bottom: brushBottom, height: brushHeight }
      : null;

    const { xAxis, yAxis } = buildMainAxes(ctx);

    if (isLoading) return buildLoadingOption(ctx, { grid, xAxis, yAxis });

    const brush = showBrush ? buildBrushOption(ctx, brushBottom) : null;

    const areaSeries = buildAreaSeries(ctx);
    const series = [
      ...(tooltipSlot.scrub
        ? areaSeries.map((entry) => ({ ...entry, zlevel: SCRUB_ZLEVEL }))
        : areaSeries),
      ...(brush?.miniSeries ?? []),
    ];
    if (enableHoverReveal || tooltipSlot.scrub) live.revealValues = revealSink;
    if (tooltipSlot.scrub) {
      live.scrubDotKeys = areas
        .filter(
          (area) => area.visible !== false && area.strokeVariant !== "dashed"
        )
        .map((area) => area.dataKey);
    }
    live.seriesKeyByIndex = series.map((s) => {
      const id = String(s.id ?? "");
      return id && !id.startsWith("__") ? id : undefined;
    });
    const companionIdsByKey = new Map<string, string[]>();
    for (const area of areas) {
      const ids: string[] = [];
      if (area.enableBufferLine && data.length >= 2) {
        ids.push(
          `${BUFFER_PREFIX}${area.dataKey}`,
          `${BUFFERFILL_PREFIX}${area.dataKey}`
        );
      }
      if (enableHoverReveal || tooltipSlot.scrub)
        ids.push(`${REVEAL_PREFIX}${area.dataKey}`);
      if (ids.length) companionIdsByKey.set(area.dataKey, ids);
    }
    live.companionIdsByKey = companionIdsByKey;

    return {
      animation: false,
      grid: brush ? [grid, brush.miniGrid] : grid,
      xAxis: brush ? [xAxis, brush.miniXAxis] : xAxis,
      yAxis: brush ? [yAxis, brush.miniYAxis] : yAxis,
      tooltip: buildTooltipOption(ctx),
      dataZoom: brush?.dataZoom,
      series,
    };
  }, [
    live,
    data,
    config,
    areas,
    seriesKeys,
    xCategoryKey,
    curveType,
    isStacked,
    isExpanded,
    selectedDataKey,
    hasSelection,
    showGrid,
    gridVariant,
    gridOpacity,
    xAxisSlot,
    yAxisSlot,
    tooltipSlot,
    legendSlot,
    isLoading,
    loadingData,
    showBrush,
    brushHeight,
    enableHoverHighlight,
    enableHoverReveal,
  ]);

  useEffect(() => {
    const mount = mountRef.current;
    const container = containerRef.current;
    if (!mount || !container) return;

    const chart = echarts.init(mount, undefined, { renderer });
    echartsRef.current = chart;

    const stopResizeObserver = observeChartResize(mount, chart, {
      onResized: () => {
        syncBrushOverlayNow();
        live.scrubX = null;
        live.paintScrub();
      },
      onSettled: () => live.repush(),
    });

    const themeObserver = new MutationObserver(() => {
      live.repush();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    chart.on("click", (params) => {
      const { clickableKeys: clickable, seriesKeys: keys } = live.handlers;
      const p = params as {
        seriesId?: string;
        seriesIndex?: number;
        event?: { offsetX?: number; offsetY?: number };
      };
      // Symbol clicks carry seriesId; area-polygon clicks (triggerEvent)
      // only carry seriesIndex — recover the key from the last build's index map,
      // which accounts for the extra `__buffer-`/`__reveal-`/`__mini-` series
      // interleaved between the main ones (a raw seriesKeys lookup would miss).
      let id =
        p.seriesId ??
        (typeof p.seriesIndex === "number"
          ? live.seriesKeyByIndex[p.seriesIndex]
          : undefined);
      if (
        typeof p.event?.offsetX === "number" &&
        typeof p.event?.offsetY === "number"
      ) {
        const resolved = resolveAreaAtPixel(
          chart,
          live.plottedTops,
          keys,
          p.event.offsetX,
          p.event.offsetY
        );
        if (resolved) id = resolved;
      }
      if (typeof id === "string" && clickable.has(id)) toggleSelection(id);
    });

    // Hover-highlight is POINTER-driven, not series-mouseover-driven:
    // overlapping polygons would pin the native hover on the topmost series and
    // never re-fire while the pointer moves within it. A zrender mousemove
    // tracker resolves the visually-hovered band, drives the canvas emphasis
    // via dispatchAction, and mirrors into the HTML legend (React state) and
    // tooltip (live.hoveredKey — its formatter runs per pointer move).
    const applyHoverKey = (key: string | null) => {
      if (live.hoveredKey === key) return;
      const previous = live.hoveredKey;
      live.hoveredKey = key;
      setHoveredDataKey(key);
      if (previous) {
        chart.dispatchAction({ type: "downplay", seriesId: previous });
        for (const id of live.companionIdsByKey.get(previous) ?? [])
          chart.dispatchAction({ type: "downplay", seriesId: id });
      }
      if (key) {
        chart.dispatchAction({ type: "highlight", seriesId: key });
        for (const id of live.companionIdsByKey.get(key) ?? [])
          chart.dispatchAction({ type: "highlight", seriesId: id });
      }
    };

    let revealMuted = false;
    const pushReveal = (idx: number | null) => {
      const keys = live.handlers.seriesKeys;
      const on = idx !== null;
      if (on !== revealMuted) {
        revealMuted = on;
        setMutedOpacity(on ? REVEAL_MUTE_OPACITY : 0);
      }
      const cutX = on ? chart.convertToPixel({ xAxisIndex: 0 }, idx) : null;
      clipSeriesToX(
        chart,
        live.scrubStore,
        typeof cutX === "number" && Number.isFinite(cutX) ? cutX : null,
        SCRUB_SKIP_PREFIXES,
        keys
      );
      for (const key of keys) {
        chart.dispatchAction(
          on
            ? { type: "highlight", seriesId: key, dataIndex: idx as number }
            : { type: "downplay", seriesId: key }
        );
      }
    };
    const applyReveal = (event: { offsetX?: number; offsetY?: number }) => {
      const len = live.dataLength;
      if (len < 1) return;
      const x = event.offsetX ?? -1;
      const y = event.offsetY ?? -1;
      if (!chart.containPixel({ gridIndex: 0 }, [x, y])) {
        clearReveal();
        return;
      }
      const raw = chart.convertFromPixel({ gridIndex: 0 }, [x, y])[0] ?? 0;
      const idx = Math.max(0, Math.min(len - 1, Math.round(raw)));
      if (idx === live.revealIndex) return;
      live.revealIndex = idx;
      pushReveal(idx);
    };
    const clearReveal = () => {
      if (live.revealIndex === null) return;
      live.revealIndex = null;
      pushReveal(null);
    };

    const setMutedOpacity = (opacity: number) => {
      const keys = live.handlers.seriesKeys;
      if (keys.length === 0) return;
      chart.setOption(
        {
          series: keys.map((key) => ({
            id: `${REVEAL_PREFIX}${key}`,
            lineStyle: { opacity },
            itemStyle: { opacity },
          })),
        },
        { silent: true }
      );
    };

    const paintScrub = () => {
      const grid = readScrubGrid(chart);
      const index = live.scrubIndex;
      if (index === null || !grid || live.dataLength <= 0) {
        syncScrubOverlay(chart, live.scrubStore, null);
        clipSeriesToX(
          chart,
          live.scrubStore,
          null,
          SCRUB_SKIP_PREFIXES,
          live.handlers.seriesKeys
        );
        return;
      }
      const snapX = chart.convertToPixel({ xAxisIndex: 0 }, index);
      if (typeof snapX !== "number" || !Number.isFinite(snapX)) return;
      const displayX = live.scrubX ?? snapX;
      live.scrubX = displayX;
      clipSeriesToX(
        chart,
        live.scrubStore,
        displayX,
        SCRUB_SKIP_PREFIXES,
        live.handlers.seriesKeys
      );
      if (live.scrubOpacity < 0.01) {
        syncScrubOverlay(chart, live.scrubStore, null);
        return;
      }
      const resolved = live.resolved;
      const dots: ScrubDot[] = [];
      if (resolved && live.scrubTarget === 1) {
        for (const key of live.scrubDotKeys) {
          const point = pointOnSeriesAtX(chart, key, displayX);
          if (!point) continue;
          const color =
            (resolved.series[key] ?? [])[0] ?? "rgba(120, 120, 120, 1)";
          dots.push({
            x: point[0],
            y: point[1],
            color,
            halo: withAlpha(color, SCRUB_DOT_HALO_ALPHA),
          });
        }
      }
      const lineColor = withAlpha(
        resolved?.tokens.mutedForeground ?? "rgba(120, 120, 120, 1)",
        AXIS_POINTER_OPACITY
      );
      syncScrubOverlay(chart, live.scrubStore, {
        x: displayX,
        grid,
        lineColor,
        opacity: live.scrubOpacity,
        dots,
      });
    };
    live.paintScrub = paintScrub;

    const tickScrub = () => {
      if (live.scrubTarget === 1 && live.scrubX !== null) {
        live.scrubRaf = 0;
        live.scrubOpacity = 1;
        chart.dispatchAction({
          type: "showTip",
          x: live.scrubX,
          y: live.scrubY,
        });
        paintScrub();
        return;
      }
      live.scrubOpacity += (live.scrubTarget - live.scrubOpacity) * SCRUB_LERP;
      const grid = live.scrubTarget === 0 ? readScrubGrid(chart) : null;
      const snapX =
        live.scrubTarget === 1 && live.scrubIndex !== null
          ? chart.convertToPixel({ xAxisIndex: 0 }, live.scrubIndex)
          : grid
            ? grid.x + grid.width
            : null;
      const validSnapX =
        typeof snapX === "number" && Number.isFinite(snapX) ? snapX : null;
      if (validSnapX !== null && live.scrubX !== null) {
        live.scrubX += (validSnapX - live.scrubX) * CHART_SCRUB_POSITION_LERP;
        if (Math.abs(validSnapX - live.scrubX) < 0.5) live.scrubX = validSnapX;
      }
      if (Math.abs(live.scrubTarget - live.scrubOpacity) < 0.01) {
        live.scrubOpacity = live.scrubTarget;
      }
      const settled =
        live.scrubOpacity === live.scrubTarget &&
        (validSnapX === null || live.scrubX === validSnapX);
      if (settled) {
        live.scrubRaf = 0;
        if (live.scrubTarget === 0) {
          setMutedOpacity(0);
          live.scrubIndex = null;
          live.scrubX = null;
          chart.dispatchAction({ type: "hideTip" });
        }
      }
      paintScrub();
      if (!settled) live.scrubRaf = requestAnimationFrame(tickScrub);
    };

    const leaveScrub = () => {
      if (live.scrubTarget === 0 && live.scrubOpacity === 0) return;
      live.scrubTarget = 0;
      chart.dispatchAction({ type: "hideTip" });
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const grid = readScrubGrid(chart);
        if (grid) live.scrubX = grid.x + grid.width;
      }
      if (!live.scrubRaf) live.scrubRaf = requestAnimationFrame(tickScrub);
    };

    const applyScrub = (event: { offsetX?: number; offsetY?: number }) => {
      const x = event.offsetX ?? -1;
      const y = event.offsetY ?? -1;
      if (live.dataLength <= 0 || !chart.containPixel({ gridIndex: 0 }, [x, y])) {
        leaveScrub();
        return;
      }
      const raw = chart.convertFromPixel({ gridIndex: 0 }, [x, y])[0] ?? 0;
      const idx = nearestCategoryIndex(raw, live.dataLength);
      if (idx === null) {
        leaveScrub();
        return;
      }
      const entering = live.scrubTarget === 0;
      live.scrubIndex = idx;
      live.scrubX = x;
      live.scrubY = y;
      live.scrubTarget = 1;
      if (entering) setMutedOpacity(SCRUB_MUTE_OPACITY);
      const zrDom = chart.getZr()?.dom as HTMLElement | undefined;
      if (zrDom) zrDom.style.cursor = "crosshair";
      if (!live.scrubRaf) live.scrubRaf = requestAnimationFrame(tickScrub);
    };

    const zrHover = chart.getZr();
    const onZrHoverMove = (event: { offsetX?: number; offsetY?: number }) => {
      if (live.drag) {
        dragTo(event);
        return;
      }
      if (live.handlers.enableScrub) {
        applyScrub(event);
        return;
      }
      if (live.handlers.enableHoverReveal) {
        applyReveal(event);
        return;
      }
      if (!live.handlers.enableHoverHighlight) return;
      if (live.handlers.selectedDataKey !== null) return;
      applyHoverKey(
        resolveAreaAtPixel(
          chart,
          live.plottedTops,
          live.handlers.seriesKeys,
          event.offsetX ?? -1,
          event.offsetY ?? -1
        )
      );
    };
    const onZrHoverOut = () => {
      if (live.handlers.enableScrub) leaveScrub();
      else if (live.handlers.enableHoverReveal) clearReveal();
      else if (live.handlers.enableHoverHighlight) applyHoverKey(null);
    };
    const paintSelection = () => {
      const range = live.drag;
      const zr = chart.getZr();
      const grid = range ? readScrubGrid(chart) : null;
      if (!range || !grid || !zr || live.dataLength <= 0) {
        if (live.selectionRect && zr) zr.remove(live.selectionRect);
        live.selectionRect = null;
        return;
      }
      const low = Math.min(range.startIndex, range.endIndex);
      const high = Math.max(range.startIndex, range.endIndex);
      const x0 = chart.convertToPixel({ xAxisIndex: 0 }, low);
      const x1 = chart.convertToPixel({ xAxisIndex: 0 }, high);
      if (typeof x0 !== "number" || typeof x1 !== "number") return;
      if (!Number.isFinite(x0) || !Number.isFinite(x1)) return;
      if (!live.selectionRect) {
        live.selectionRect = new echarts.graphic.Rect({
          silent: true,
          zlevel: live.handlers.enableScrub ? SCRUB_ZLEVEL : 0,
          z: SELECTION_Z,
          shape: { x: 0, y: 0, width: 0, height: 0 },
        });
        zr.add(live.selectionRect);
      }
      const foreground =
        live.resolved?.tokens.foreground ?? "rgba(120, 120, 120, 1)";
      live.selectionRect.setShape({
        x: x0,
        y: grid.y,
        width: Math.max(x1 - x0, 1),
        height: grid.height,
      });
      live.selectionRect.setStyle({
        fill: withAlpha(foreground, SELECTION_FILL_ALPHA),
        stroke: withAlpha(foreground, SELECTION_STROKE_ALPHA),
        lineWidth: 1,
      });
    };
    live.paintSelection = paintSelection;
    const repaintSelection = () => {
      if (live.drag || live.selectionRect) paintSelection();
    };
    chart.on("finished", repaintSelection);

    const indexAtX = (x: number): number | null => {
      const grid = readScrubGrid(chart);
      if (!grid || live.dataLength <= 0) return null;
      const clampedX = Math.max(grid.x, Math.min(grid.x + grid.width, x));
      const raw =
        chart.convertFromPixel({ gridIndex: 0 }, [
          clampedX,
          grid.y + grid.height / 2,
        ])[0] ?? 0;
      return nearestCategoryIndex(raw, live.dataLength);
    };

    const endDrag = () => {
      live.drag = null;
      chart.setOption(
        { tooltip: { show: live.handlers.tooltipOn } },
        { silent: true }
      );
      paintSelection();
    };
    const onDragKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !live.drag) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      endDrag();
    };
    const finishDrag = () => {
      const drag = live.drag;
      if (!drag) return;
      endDrag();
      const low = Math.min(drag.startIndex, drag.endIndex);
      const high = Math.max(drag.startIndex, drag.endIndex);
      if (high - low < 1) return;
      live.handlers.onRangeSelect?.({ startIndex: low, endIndex: high });
    };

    const onZrDown = (event: {
      offsetX?: number;
      offsetY?: number;
      event?: MouseEvent;
    }) => {
      if (!live.handlers.onRangeSelect || live.dataLength < 3) return;
      if (event.event && event.event.button !== 0) return;
      const x = event.offsetX ?? -1;
      const y = event.offsetY ?? -1;
      if (!chart.containPixel({ gridIndex: 0 }, [x, y])) return;
      const index = indexAtX(x);
      if (index === null) return;
      event.event?.preventDefault();
      live.drag = { startIndex: index, endIndex: index, x, y };
      leaveScrub();
      chart.setOption({ tooltip: { show: false } }, { silent: true });
      chart.dispatchAction({ type: "hideTip" });
      paintSelection();
    };
    const dragTo = (event: { offsetX?: number; offsetY?: number }) => {
      const drag = live.drag;
      if (!drag) return;
      const x = event.offsetX ?? drag.x;
      const index = indexAtX(x);
      if (index === null) return;
      drag.endIndex = index;
      drag.x = x;
      drag.y = event.offsetY ?? drag.y;
      paintSelection();
    };
    zrHover.on("mousedown", onZrDown);
    zrHover.on("mouseup", finishDrag);
    window.addEventListener("mouseup", finishDrag);
    window.addEventListener("keydown", onDragKey, true);

    zrHover.on("mousemove", onZrHoverMove);
    zrHover.on("globalout", onZrHoverOut);

    chart.on("mouseover", (params) => {
      const { enableHoverHighlight: hoverOn, enableHoverReveal: revealOn, enableScrub: scrubOn } =
        live.handlers;
      if (!hoverOn || revealOn || scrubOn) return;
      if (live.handlers.selectedDataKey !== null) return;
      const p = params as { seriesIndex?: number; componentType?: string };
      if (p.componentType !== "series" || typeof p.seriesIndex !== "number")
        return;
      const key = live.seriesKeyByIndex[p.seriesIndex];
      if (!key || key.startsWith("__")) return;
      if (key !== live.hoveredKey) {
        chart.dispatchAction({ type: "downplay", seriesIndex: p.seriesIndex });
        if (live.hoveredKey) {
          chart.dispatchAction({
            type: "highlight",
            seriesId: live.hoveredKey,
          });
        }
      }
    });

    chart.on("datazoom", () => {
      const option = chart.getOption() as {
        dataZoom?: { start?: number; end?: number }[];
      };
      const zoom = option.dataZoom?.[0];
      if (!zoom) return;

      live.brushRange = { start: zoom.start ?? 0, end: zoom.end ?? 100 };
      syncBrushOverlayNow();

      const { onBrushChange: onChange } = live.handlers;
      if (!onChange) return;
      const len = live.dataLength;
      const startIndex = Math.round(((zoom.start ?? 0) / 100) * (len - 1));
      const endIndex = Math.round(((zoom.end ?? 100) / 100) * (len - 1));
      onChange({ startIndex, endIndex });
    });

    const zr = chart.getZr();
    const applyHover = (next: {
      inside: boolean;
      left: boolean;
      right: boolean;
    }) => {
      const prev = live.brushHover;
      if (
        prev.inside === next.inside &&
        prev.left === next.left &&
        prev.right === next.right
      ) {
        return;
      }
      live.brushHover = next;
      syncBrushOverlayNow();
    };
    const onZrMove = (event: { offsetX?: number; offsetY?: number }) => {
      const geom = live.brushGeom;
      if (!geom) return;
      const x = event.offsetX ?? -1;
      const y = event.offsetY ?? -1;
      const top = chart.getHeight() - geom.bottom - geom.height;
      const inside = y >= top - 4 && y <= top + geom.height + 4;
      const trackLeft = 8;
      const trackWidth = Math.max(chart.getWidth() - 16, 1);
      const { start, end } = live.brushRange;
      const selectionLeft = trackLeft + (trackWidth * start) / 100;
      const selectionRight = trackLeft + (trackWidth * end) / 100;
      applyHover({
        inside,
        left: inside && Math.abs(x - selectionLeft) <= 8,
        right: inside && Math.abs(x - selectionRight) <= 8,
      });
    };
    const onZrOut = () =>
      applyHover({ inside: false, left: false, right: false });
    zr.on("mousemove", onZrMove);
    zr.on("globalout", onZrOut);

    return () => {
      zrHover.off("mousemove", onZrHoverMove);
      zrHover.off("globalout", onZrHoverOut);
      zrHover.off("mousedown", onZrDown);
      zrHover.off("mouseup", finishDrag);
      window.removeEventListener("mouseup", finishDrag);
      window.removeEventListener("keydown", onDragKey, true);
      chart.off("finished", repaintSelection);
      live.drag = null;
      live.selectionRect = null;
      zr.off("mousemove", onZrMove);
      zr.off("globalout", onZrOut);
      if (live.scrubRaf) cancelAnimationFrame(live.scrubRaf);
      live.scrubRaf = 0;
      live.scrubStore = emptyScrubStore();
      live.scrubIndex = null;
      live.scrubX = null;
      live.scrubOpacity = 0;
      live.scrubTarget = 0;
      stopResizeObserver();
      themeObserver.disconnect();
      chart.dispose();
      echartsRef.current = null;
      live.brushOverlay = null;
      // The reveal guard belongs to the chart instance it guarded. Without this
      // reset, StrictMode's dev-only mount→unmount→remount plays the entrance on
      // the throwaway instance and the surviving one renders without it.
      live.hasRevealed = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderer]);

  useEffect(() => {
    const chart = echartsRef.current;
    const container = containerRef.current;
    if (!chart || !container) return;

    live.resolved = resolveColors(container, config, seriesKeys);

    const push = (withEntrance: boolean, withUpdate = true) => {
      const option = buildOption();
      const merged = chartOptions ? { ...option, ...chartOptions } : option;
      applyChartMarkers(
        merged,
        markers,
        live.resolved?.tokens.foreground ?? "rgba(60, 60, 60, 1)",
        live.resolved?.tokens.background ?? "rgba(255, 255, 255, 1)"
      );
      Object.assign(merged, {
        animation: withEntrance || withUpdate,
        animationDuration: withEntrance ? REVEAL_DURATION : 0,
        animationDurationUpdate:
          withEntrance || !withUpdate ? 0 : CHART_UPDATE_MS,
        animationEasingUpdate: "cubicInOut",
        stateAnimation: { duration: HOVER_DOT_STATE_MS, easing: "cubicOut" },
      });
      chart.setOption(merged as EChartsOption, { notMerge: true });
      keepTooltipContentMounted(chart);
      syncBrushOverlayNow();
      if (live.scrubIndex !== null && live.scrubTarget === 1) {
        chart.setOption(
          {
            series: seriesKeys.map((key) => ({
              id: `${REVEAL_PREFIX}${key}`,
              lineStyle: { opacity: SCRUB_MUTE_OPACITY },
              itemStyle: { opacity: SCRUB_MUTE_OPACITY },
            })),
          },
          { silent: true }
        );
        live.paintScrub();
      }
    };

    if (isLoading) live.hasRevealed = false;
    const shouldReveal = !live.hasRevealed && !isLoading;
    if (shouldReveal) live.hasRevealed = true;
    const revealEnabled =
      animation &&
      shouldReveal &&
      effectiveAnimation !== "none" &&
      !shouldReduceMotion;
    if (revealEnabled) live.revealEndsAt = performance.now() + REVEAL_DURATION;
    push(revealEnabled);

    live.repush = () => {
      live.resolved = resolveColors(container, config, seriesKeys);
      push(false, false);
    };
  }, [
    live,
    buildOption,
    chartOptions,
    markers,
    isLoading,
    animation,
    effectiveAnimation,
    shouldReduceMotion,
    config,
    seriesKeys,
    syncBrushOverlayNow,
    renderer,
  ]);

  useEffect(() => {
    const chart = echartsRef.current;
    if (!chart || isLoading) return;
    const animatedKeys = areas
      .filter(
        (area) =>
          area.strokeVariant === "animated-dashed" && !area.enableBufferLine
      )
      .map((area) => area.dataKey);
    if (animatedKeys.length === 0 || hasSelection) return;

    let raf = 0;
    let delayTimer: ReturnType<typeof setTimeout> | undefined;
    const begin = () => {
      const loopStart = performance.now();
      const tick = (now: number) => {
        const offset = -(((now - loopStart) / 1000) % 1) * 6;
        chart.setOption(
          {
            series: animatedKeys.map((id) => ({
              id,
              lineStyle: { dashOffset: offset },
            })),
          },
          { silent: true, lazyUpdate: true }
        );
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    const delay = Math.max(0, live.revealEndsAt - performance.now());
    if (delay > 0) delayTimer = setTimeout(begin, delay + 50);
    else begin();

    return () => {
      if (delayTimer !== undefined) clearTimeout(delayTimer);
      cancelAnimationFrame(raf);
    };
  }, [live, areas, hasSelection, isLoading, renderer]);

  useEffect(() => {
    const chart = echartsRef.current;
    if (!chart || !isLoading) return;

    let raf = 0;
    let lastPhase = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const phase =
        ((((now - start) / LOADING_ANIMATION_DURATION) % 1) + 1) % 1;
      if (phase < lastPhase) live.loadingRows = getLoadingData(loadingPoints);
      lastPhase = phase;

      const foreground =
        live.resolved?.tokens.foreground ?? "rgba(120, 120, 120, 1)";
      const w = chart.getWidth();
      const h = chart.getHeight();
      if (!w || !h) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const maxT = (w + h) / (2 * w);
      const center =
        phase * (maxT + 2 * LOADING_SHIMMER_BAND) - LOADING_SHIMMER_BAND;
      const clip = (peak: number) =>
        new echarts.graphic.LinearGradient(
          0,
          0,
          w,
          w,
          shimmerWindowStops(center, foreground, peak),
          true
        );
      chart.setOption(
        {
          series: [
            {
              id: "__loading",
              data: loadingData(),
              lineStyle: { color: clip(LOADING_STROKE_OPACITY), width: 1 },
              areaStyle: { color: clip(LOADING_SHIMMER_MAX_OPACITY) },
            },
          ],
        },
        { silent: true, lazyUpdate: true }
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [live, isLoading, loadingPoints, loadingData, renderer]);

  const legendStyle: CSSProperties = {
    position: "absolute",
    left: 16,
    right: 16,
    pointerEvents: "auto",
    ...(legendSlot.verticalAlign === "top"
      ? { top: 12 }
      : legendSlot.verticalAlign === "bottom"
        ? { bottom: showBrush ? brushHeight + 16 : 12 }
        : { top: "50%", transform: "translateY(-50%)" }),
  };

  return (
    <EChartsPlotFrame
      chartId={chartId}
      className={className}
      containerRef={containerRef}
      css={css}
      isLoading={isLoading}
      mountRef={mountRef}
    >
      {legendSlot.present && !isLoading ? (
        <LegendOverlay
          align={legendSlot.align}
          config={config}
          hoveredKey={hoveredDataKey}
          isClickable={legendSlot.isClickable}
          onToggle={toggleSelection}
          selectedKey={selectedDataKey}
          seriesKeys={seriesKeys}
          style={legendStyle}
          variant={legendSlot.variant}
          verticalAlign={legendSlot.verticalAlign}
        />
      ) : null}
    </EChartsPlotFrame>
  );
}

EChartsAreaChart.Area = Area;
EChartsAreaChart.Dot = Dot;
EChartsAreaChart.ActiveDot = ActiveDot;
EChartsAreaChart.XAxis = XAxis;
EChartsAreaChart.YAxis = YAxis;
EChartsAreaChart.Grid = Grid;
EChartsAreaChart.Tooltip = Tooltip;
EChartsAreaChart.Legend = Legend;
EChartsAreaChart.Brush = Brush;
