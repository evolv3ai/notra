"use client";

import { BarChart, type BarSeriesOption } from "echarts/charts";
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
import { CanvasRenderer } from "echarts/renderers";
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
import { withLocaleTooltip } from "@/utils/chart-locale";
import { EChartsPlotFrame } from "@/components/charts/echarts-plot-frame";
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
  withAlpha,
} from "@/components/evilcharts/ui/echarts-chart";
import { sampleGradient } from "@/components/evilcharts/ui/echarts-dot";
import {
  LegendOverlay,
  type LegendVariant,
} from "@/components/evilcharts/ui/echarts-legend";
import { applyChartMarkers } from "@/components/evilcharts/ui/echarts-marker";
import {
  type TooltipAxisPointer,
  type TooltipPosition,
  type TooltipRoundness,
  type TooltipVariant,
  composeTooltipBody,
  configIndicatorHtml,
  formatTooltipValue,
  tooltipBaseOption,
  tooltipShell,
} from "@/components/evilcharts/ui/echarts-tooltip";
import {
  keepTooltipContentMounted,
  withTooltipSizeMotion,
} from "@/utils/chart-tooltip-size";
import type {
  ChartConfig,
  ChartMarker,
  TooltipBodyItem,
  TooltipLayout,
  TooltipValueFormatter,
} from "@/types/charts";
import { stackSegmentGapValues } from "@/utils/chart-stack-gap";
import { echartsDatumValue } from "@/utils/echarts-datum";
import { observeChartResize } from "@/components/evilcharts/ui/echarts-resize";

echarts.use([
  BarChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  MarkLineComponent,
  CanvasRenderer,
]);

type EChartsInstance = ReturnType<typeof echarts.init>;

type EChartsOption = ComposeOption<
  | BarSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | DataZoomComponentOption
>;

type ArrayItem<T> = T extends readonly (infer U)[] ? U : T;
type XAxisOption = ArrayItem<NonNullable<EChartsOption["xAxis"]>>;
type YAxisOption = ArrayItem<NonNullable<EChartsOption["yAxis"]>>;


const DEFAULT_BAR_RADIUS = 2;
const STROKE_WIDTH = 1;
const LOADING_ANIMATION_DURATION = 2000;
const BAR_GROW_DURATION = 500;
const BAR_STAGGER = 50;
const LOADING_DEFAULT_BARS = 12;
const SELECTION_DIM = 0.3;
const HOVER_BLUR = 0.3;
const AXIS_POINTER_SHADOW_OPACITY = 0.06;
const GLOW_BLUR = 18;
const GLOW_OPACITY = 0.65;

const EXPAND_COLLAPSED = 0.12;
const EXPAND_TAU = 70;

const BLOCK_SIZE = 8;
const BLOCK_GAP = 4;
const BLOCK_TRACK_OPACITY = 0.22;
const STACK_SEGMENT_GAP = 2;
const MAX_HIGHLIGHT_DIM = 0.16;

const STRIPPED_CAP_HEIGHT = 4;
const STRIPPED_BODY_ALPHA = 0.2;
const STRIPPED_CAP_MAX_FRACTION = 0.85;
const STRIPPED_FALLBACK_FRACTION = 0.12;

const GRID_LINE_OPACITY = 1;
const LOADING_SHIMMER_MAX_OPACITY = 0.22;
const LOADING_SHIMMER_BAND = 0.2;
const LOADING_SHIMMER_FEATHER = 0.2;
const BRUSH_FILL_OPACITY = 0.5;
const BRUSH_FILLER_OPACITY = 0;


export type BarVariant =
  | "default"
  | "hatched"
  | "duotone"
  | "duotone-reverse"
  | "gradient"
  | "stripped"
  | "blocks"
  | "expandable";
export type StackType = "default" | "stacked" | "percent";
export type BarLayout = "vertical" | "horizontal";
export type BarAnimationType =
  | "none"
  | "left-to-right"
  | "right-to-left"
  | "center-out"
  | "edges-in";

export interface EChartsBarChartProps<TData extends Record<string, unknown>> {
  data: TData[]; // rows rendered by the chart
  config: ChartConfig; // series colors + labels
  xDataKey?: keyof TData & string; // category key — falls back to the axis dataKey / first free column
  className?: string; // extra classes for the chart container
  stackType?: StackType; // how multiple bars combine
  layout?: BarLayout; // orientation of the bars
  barRadius?: number; // default corner radius every <Bar> inherits
  animation?: boolean; // master switch for the intro grow-in — false renders instantly
  animationType?: BarAnimationType; // default grow-in order each <Bar> inherits
  barGap?: number; // gap between bars within the same category, in pixels
  barCategoryGap?: number; // gap between categories of bars, in pixels
  barMaxWidth?: number; // caps each bar's width, in pixels — keeps sparse ranges from drawing slabs
  defaultSelectedDataKey?: string | null; // series selected on first render
  onSelectionChange?: (key: string | null) => void; // fires when the selected series changes
  hoverDataKey?: string | null; // controlled hover from a legend or other sibling UI
  onHoverChange?: (key: string | null) => void; // fires when the hovered series changes
  // Colors ONLY the tallest column and mutes the rest. With several series the
  // comparison is per COLUMN — the totals across every series at that category —
  // so a whole stack or group lights up together, not one bar inside it.
  enableMaxValueHighlight?: boolean;
  isLoading?: boolean; // shows the animated loading skeleton
  loadingBars?: number; // number of bars in the loading skeleton
  chartOptions?: Record<string, unknown>; // escape hatch merged over the built ECharts option
  markers?: readonly ChartMarker[]; // vertical annotation lines pinned to x-axis categories
  children?: ReactNode; // declarative config — <Bar>, <XAxis>, <YAxis>, <Grid>, <Tooltip>, <Legend>, <Brush>
}


export interface BarProps {
  dataKey: string; // series key — must exist on the data + config
  variant?: BarVariant; // fill style for this bar only
  radius?: number; // corner radius — falls back to the root barRadius
  animationType?: BarAnimationType; // grow-in order — falls back to the root animationType
  isClickable?: boolean; // lets this bar be selected by clicking it
  enableHoverHighlight?: boolean; // dims the other bars while one is hovered
  glowing?: boolean; // applies a soft outer glow to this bar
  bufferBar?: boolean; // renders the last data point as a hatched "buffer" bar
}

const Bar: FC<BarProps> = () => null;

export interface XAxisProps {
  dataKey?: string; // category key — overrides the root xDataKey (vertical layout)
  // Category values are stringified, so the formatter always sees a string —
  // letting examples share `(value) => value.substring(0, 3)` with the Recharts twin.
  tickFormatter?: (value: string, index: number) => string; // formats x tick labels
  label?: string; // axis title, centered below the x-position tick labels
  hideDots?: boolean; // hides the tick dots beside this axis's labels
}

const XAxis: FC<XAxisProps> = () => null;

export interface YAxisProps {
  dataKey?: string; // category key — overrides the root xDataKey (horizontal layout)
  tickFormatter?: (value: string, index: number) => string; // formats y tick labels
  label?: string; // axis title, rotated alongside the y-position tick labels
  hideDots?: boolean; // hides the tick dots beside this axis's labels
}

const YAxis: FC<YAxisProps> = () => null;

const Grid: FC = () => null;

export interface TooltipProps {
  variant?: TooltipVariant; // visual style of the tooltip surface
  roundness?: TooltipRoundness; // border-radius of the tooltip
  defaultIndex?: number; // data index the tooltip shows by default, with no hover
  position?: TooltipPosition; // "variable" follows the pointer (default); "fixed" pins the tooltip near the top and only tracks the pointer's X
  layout?: TooltipLayout; // "rows" is the default swatch list; "bars" ranks series as a mini bar chart
  valueFormatter?: TooltipValueFormatter;
  barMax?: number; // bar layout: scale tracks to this ceiling (e.g. 100 for percents); omit to scale to the hovered max
  pointer?: TooltipAxisPointer; // "shadow" lights the hovered column; default is none
}

const Tooltip: FC<TooltipProps> = () => null;

export interface LegendProps {
  variant?: LegendVariant; // visual style of the legend indicators
  align?: "left" | "center" | "right"; // horizontal placement
  verticalAlign?: "top" | "middle" | "bottom"; // vertical placement
  isClickable?: boolean; // lets each entry toggle selection of its series
}

const Legend: FC<LegendProps> = () => null;


type BarSeriesConfig = {
  dataKey: string;
  variant: BarVariant;
  radius?: number;
  animationType?: BarAnimationType;
  isClickable: boolean;
  enableHoverHighlight: boolean;
  glowing: boolean;
  bufferBar: boolean;
};

type AxisSlot = {
  present: boolean;
  dataKey?: string;
  tickFormatter?: (value: string, index: number) => string;
  label?: string;
  hideDots: boolean;
};
type TooltipSlot = {
  present: boolean;
  variant: TooltipVariant;
  roundness: TooltipRoundness;
  defaultIndex?: number;
  position: TooltipPosition;
  layout: TooltipLayout;
  valueFormatter?: TooltipValueFormatter;
  barMax?: number;
  pointer: TooltipAxisPointer;
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
  bars: BarSeriesConfig[];
  xAxis: AxisSlot;
  yAxis: AxisSlot;
  showGrid: boolean;
  tooltip: TooltipSlot;
  legend: LegendSlot;
  brush: BrushSlot;
};

function collectConfig(children: ReactNode): CollectedConfig {
  const bars: BarSeriesConfig[] = [];
  let xAxis: AxisSlot = { present: false, hideDots: false };
  let yAxis: AxisSlot = { present: false, hideDots: false };
  let showGrid = false;
  let tooltip: TooltipSlot = {
    present: false,
    variant: "default",
    roundness: "lg",
    position: "variable",
    layout: "rows",
    pointer: "none",
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

    if (type === Bar) {
      const props = child.props as BarProps;
      bars.push({
        dataKey: props.dataKey,
        variant: props.variant ?? "default",
        radius: props.radius,
        animationType: props.animationType,
        isClickable: props.isClickable ?? false,
        enableHoverHighlight: props.enableHoverHighlight ?? false,
        glowing: props.glowing ?? false,
        bufferBar: props.bufferBar ?? false,
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
        dataKey: props.dataKey,
        tickFormatter: props.tickFormatter,
        label: props.label,
        hideDots: props.hideDots ?? false,
      };
    } else if (type === Grid) {
      showGrid = true;
    } else if (type === Tooltip) {
      const props = child.props as TooltipProps;
      tooltip = {
        present: true,
        variant: props.variant ?? "default",
        roundness: props.roundness ?? "lg",
        defaultIndex: props.defaultIndex,
        position: props.position ?? "variable",
        layout: props.layout ?? "rows",
        valueFormatter: props.valueFormatter,
        barMax: props.barMax,
        pointer: props.pointer ?? "none",
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

  return { bars, xAxis, yAxis, showGrid, tooltip, legend, brush };
}



const GRAY = "rgba(120, 120, 120, 1)";


function solidVerticalPaint(
  slots: string[],
  alpha: number
): string | echarts.graphic.LinearGradient {
  if (slots.length <= 1) {
    const base = slots[0] ?? GRAY;
    return alpha === 1 ? base : withAlpha(base, alpha);
  }
  const stops = slots.map((color, i) => ({
    offset: i / (slots.length - 1),
    color: withAlpha(color, alpha),
  }));
  return new echarts.graphic.LinearGradient(0, 0, 0, 1, stops);
}

function verticalFadePaint(slots: string[]): echarts.graphic.LinearGradient {
  const offsets = [0, 0.2, 0.45, 0.7, 0.9, 1];
  const alphaAt = (t: number) =>
    t <= 0.2 ? 1 : t >= 0.9 ? 0 : 1 - (t - 0.2) / 0.7;
  const stops = offsets.map((t) => ({
    offset: t,
    color: withAlpha(sampleGradient(slots, t), alphaAt(t)),
  }));
  return new echarts.graphic.LinearGradient(0, 0, 0, 1, stops);
}

function duotoneSplitPaint(
  base: string,
  leftAlpha: number,
  rightAlpha: number,
  isHorizontal: boolean
): echarts.graphic.LinearGradient {
  const stops = [
    { offset: 0, color: withAlpha(base, leftAlpha) },
    { offset: 0.5, color: withAlpha(base, leftAlpha) },
    { offset: 0.5, color: withAlpha(base, rightAlpha) },
    { offset: 1, color: withAlpha(base, rightAlpha) },
  ];
  return isHorizontal
    ? new echarts.graphic.LinearGradient(0, 0, 0, 1, stops)
    : new echarts.graphic.LinearGradient(1, 0, 0, 0, stops);
}

function strippedDatumPaint(
  slots: string[],
  isHorizontal: boolean,
  capFraction: number
): echarts.graphic.LinearGradient {
  const f = Math.min(Math.max(capFraction, 0), 1);
  const cap = withAlpha(sampleGradient(slots, 0), 1);
  const bodyTop = withAlpha(sampleGradient(slots, f), STRIPPED_BODY_ALPHA);
  const bodyEnd = withAlpha(sampleGradient(slots, 1), STRIPPED_BODY_ALPHA);
  const stops = [
    { offset: 0, color: cap },
    { offset: f, color: cap },
    { offset: f, color: bodyTop },
    { offset: 1, color: bodyEnd },
  ];
  return isHorizontal
    ? new echarts.graphic.LinearGradient(1, 0, 0, 0, stops)
    : new echarts.graphic.LinearGradient(0, 0, 0, 1, stops);
}

function strippedCapFraction(
  value: number,
  valuePxPerUnit: number | null
): number {
  if (valuePxPerUnit == null) return STRIPPED_FALLBACK_FRACTION;
  const barPx = Math.abs(value) * valuePxPerUnit;
  if (!(barPx > 0)) return STRIPPED_FALLBACK_FRACTION;
  return Math.min(STRIPPED_CAP_HEIGHT / barPx, STRIPPED_CAP_MAX_FRACTION);
}

function measureValuePxPerUnit(
  chart: EChartsInstance,
  isHorizontal: boolean
): number | null {
  const finder = isHorizontal ? { xAxisIndex: 0 } : { yAxisIndex: 0 };
  try {
    const p0 = chart.convertToPixel(finder, 0);
    const p1 = chart.convertToPixel(finder, 1);
    if (typeof p0 !== "number" || typeof p1 !== "number") return null;
    const delta = Math.abs(p1 - p0);
    return Number.isFinite(delta) && delta > 0 ? delta : null;
  } catch {
    return null;
  }
}

function measureBarWidthPx(
  chart: EChartsInstance,
  isHorizontal: boolean,
  barCategoryGap: number | undefined
): number | null {
  const finder = isHorizontal ? { yAxisIndex: 0 } : { xAxisIndex: 0 };
  try {
    const p0 = chart.convertToPixel(finder, 0);
    const p1 = chart.convertToPixel(finder, 1);
    if (typeof p0 !== "number" || typeof p1 !== "number") return null;
    const pitch = Math.abs(p1 - p0);
    if (!Number.isFinite(pitch) || pitch <= 0) return null;
    const width = barCategoryGap != null ? pitch - barCategoryGap : pitch * 0.8;
    return width > 1 ? width : null;
  } catch {
    return null;
  }
}

function patternFill(
  kind: "hatched" | "buffer" | "blocks",
  color: string,
  blockSize = BLOCK_SIZE
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

  if (kind === "blocks") {
    size(1, blockSize + BLOCK_GAP);
    ctx.fillStyle = withAlpha(color, 1);
    ctx.fillRect(0, 0, 1, blockSize);
    return pattern();
  }

  if (kind === "hatched") {
    size(5, 5);
    ctx.fillStyle = withAlpha(color, 0.3);
    ctx.fillRect(0, 0, 5, 5);
    ctx.fillStyle = withAlpha(color, 1);
    ctx.fillRect(0, 0, 1.5, 5);
    return pattern(-Math.PI / 4);
  }

  size(5, 5);
  ctx.fillStyle = withAlpha(color, 1);
  ctx.fillRect(0, 0, 1, 5);
  return pattern(-Math.PI / 4);
}

function expandableDatumPaint(
  slots: string[],
  fraction: number
): echarts.graphic.LinearGradient {
  const base = slots[0] ?? GRAY;
  const half = Math.max(0, Math.min(1, fraction)) / 2;
  const left = 0.5 - half;
  const right = 0.5 + half;
  const clear = withAlpha(base, 0);
  return new echarts.graphic.LinearGradient(0, 0, 1, 0, [
    { offset: 0, color: clear },
    { offset: left, color: clear },
    { offset: left, color: base },
    { offset: right, color: base },
    { offset: right, color: clear },
    { offset: 1, color: clear },
  ]);
}

function barFillPaint(
  variant: BarVariant,
  slots: string[],
  isHorizontal: boolean,
  blockSize = BLOCK_SIZE
): string | echarts.graphic.LinearGradient | ImagePatternObject {
  const base = slots[0] ?? GRAY;
  switch (variant) {
    case "gradient":
      return verticalFadePaint(slots);
    case "duotone":
      return duotoneSplitPaint(base, 0.4, 1, isHorizontal);
    case "duotone-reverse":
      return duotoneSplitPaint(base, 1, 0.4, isHorizontal);
    case "hatched":
      return patternFill("hatched", base) ?? solidVerticalPaint(slots, 1);
    case "blocks":
      return (
        patternFill("blocks", base, blockSize) ?? solidVerticalPaint(slots, 1)
      );
    case "expandable":
      return expandableDatumPaint(slots, EXPAND_COLLAPSED);
    case "stripped":
      return strippedDatumPaint(
        slots,
        isHorizontal,
        STRIPPED_FALLBACK_FRACTION
      );
    default:
      return solidVerticalPaint(slots, 1);
  }
}

function barBorderRadius(
  radius: number,
  variant: BarVariant,
  isHorizontal: boolean
): number | number[] {
  if (variant === "blocks" || variant === "expandable") return 0;
  if (variant !== "stripped") return radius;
  return isHorizontal ? [0, radius, radius, 0] : [radius, radius, 0, 0];
}


function selectionOpacity(selected: string | null, key: string): number {
  return selected === null || selected === key ? 1 : SELECTION_DIM;
}

function barStaggerDelay(
  type: BarAnimationType,
  index: number,
  count: number
): number {
  if (type === "none" || count <= 0) return 0;
  const last = count - 1;
  const center = last / 2;
  let step: number;
  switch (type) {
    case "right-to-left":
      step = last - index;
      break;
    case "center-out":
      step = Math.abs(index - center);
      break;
    case "edges-in":
      step = center - Math.abs(index - center);
      break;
    default:
      step = index;
  }
  return step * BAR_STAGGER;
}



type OptionBuildContext = {
  data: Record<string, unknown>[];
  config: ChartConfig;
  bars: BarSeriesConfig[];
  seriesKeys: string[];
  animationType: BarAnimationType;
  barRadius: number;
  isHorizontal: boolean;
  isStacked: boolean;
  isPercent: boolean;
  selectedDataKey: string | null;
  hasSelection: boolean;
  showGrid: boolean;
  categorySlot: AxisSlot;
  valueSlot: AxisSlot;
  tooltipSlot: TooltipSlot;
  legendSlot: LegendSlot;
  isLoading: boolean;
  loadingData: () => number[];
  showBrush: boolean;
  brushHeight: number;
  barGap?: number;
  barCategoryGap?: number;
  barMaxWidth?: number;
  resolved: ResolvedColors;
  categories: string[];
  brushRange: BrushRange;
  valuePxPerUnit: number | null;
  barWidthPx: number | null;
  expand: {
    key: string | null;
    hovered: number | null;
    progress: Map<number, number>;
  };
  maxHighlightIndex: number | null;
  getHoveredKey: () => string | null;
};

// Grid insets plus the footer band reserved for the brush. ECharts 6 contains
// axis labels automatically (the legacy `containLabel` flag now only triggers a
// deprecation warning).
function buildChartLayout({
  legendSlot,
  showBrush,
  brushHeight,
  isHorizontal,
  categorySlot,
  valueSlot,
}: OptionBuildContext): {
  grid: GridComponentOption;
  brushBottom: number;
} {
  const legendTop = legendSlot.present && legendSlot.verticalAlign === "top";
  const legendBottom =
    legendSlot.present && legendSlot.verticalAlign === "bottom";
  const bottomAxisLabel = isHorizontal ? valueSlot.label : categorySlot.label;
  const brushGap = showBrush
    ? brushHeight + 30 + (bottomAxisLabel ? 22 : 0)
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
    isHorizontal,
    showGrid,
    isLoading,
    isPercent,
    categories,
    loadingData,
    categorySlot,
    valueSlot,
  } = ctx;
  const { tokens } = ctx.resolved;

  const axisLabelColor = tokens.mutedForeground;
  const splitLineColor = withAlpha(tokens.border, GRID_LINE_OPACITY);
  const tickDotColor = flattenColor(splitLineColor, tokens.background);
  const catData = isLoading ? loadingData().map((_, i) => i) : categories;
  const catFormatter = categorySlot.tickFormatter;
  const valFormatter = valueSlot.tickFormatter;

  const categoryNameGap = isHorizontal ? 38 : 30;
  const valueNameGap = isHorizontal ? 30 : 38;

  const categoryAxis = {
    type: "category" as const,
    boundaryGap: true,
    show: true,
    inverse: isHorizontal,
    data: catData,
    name: isLoading ? undefined : categorySlot.label,
    nameLocation: "middle" as const,
    nameGap: categoryNameGap,
    nameTextStyle: { color: axisLabelColor, fontSize: 10 },
    axisLine: { show: false },
    axisTick: {
      show: !isLoading && categorySlot.present && !categorySlot.hideDots,
      length: 0.5,
      alignWithLabel: true,
      lineStyle: { color: tickDotColor, width: 3, cap: "round" as const },
    },
    splitLine: { show: false },
    axisLabel: {
      show: !isLoading && categorySlot.present,
      color: axisLabelColor,
      fontSize: 10,
      margin: 8,
      formatter: catFormatter
        ? (value: string, index: number) => catFormatter(value, index)
        : undefined,
    },
  };

  // An ECharts axis with `show: false` hides its splitLines too, but Recharts'
  // <CartesianGrid> draws with or without a visible value axis. Keep the axis on
  // whenever <Grid/> is present and gate the LABELS on the slot instead.
  const valueAxis = {
    type: "value" as const,
    show: valueSlot.present || showGrid,
    max: isPercent ? 1 : undefined,
    name: isLoading ? undefined : valueSlot.label,
    nameLocation: "middle" as const,
    nameGap: valueNameGap,
    nameTextStyle: { color: axisLabelColor, fontSize: 10 },
    axisLine: { show: false },
    axisTick: {
      show: valueSlot.present && !isLoading && !valueSlot.hideDots,
      length: 0.5,
      lineStyle: { color: tickDotColor, width: 3, cap: "round" as const },
    },
    splitLine: {
      show: showGrid && !isLoading,
      lineStyle: {
        color: splitLineColor,
        type: [3, 3] as [number, number],
        width: 1,
      },
    },
    minInterval: isPercent ? undefined : 1,
    axisLabel: {
      show: valueSlot.present && !isLoading,
      color: axisLabelColor,
      fontSize: 10,
      margin: 8,
      formatter: isPercent
        ? (value: number) => `${Math.round(value * 100)}%`
        : valFormatter
          ? (value: number, index: number) => valFormatter(String(value), index)
          : undefined,
    },
  };

  return isHorizontal
    ? { xAxis: valueAxis, yAxis: categoryAxis }
    : { xAxis: categoryAxis, yAxis: valueAxis };
}

function createTooltipFormatter(ctx: OptionBuildContext) {
  const { config, selectedDataKey, tooltipSlot, getHoveredKey } = ctx;

  return (params: unknown): string => {
    const rows = Array.isArray(params) ? params : [params];
    if (!rows.length) return "";

    const first = rows[0] as { axisValue?: string | number; name?: string };
    const axisValue = first.axisValue ?? first.name ?? "";
    const label = String(axisValue);

    const items: TooltipBodyItem[] = [];
    const zeroItems: TooltipBodyItem[] = [];
    for (const param of rows) {
      const p = param as {
        seriesId?: string;
        seriesName?: string;
        value?: number | string;
      };
      if (String(p.seriesId ?? "").startsWith("__")) continue;
      const key = p.seriesId ?? p.seriesName ?? "";
      if (!key) continue;
      const item = config[key];
      const colorsCount = item ? getColorsCount(item) : 1;
      const labelText =
        typeof item?.label === "string" ? item.label : (p.seriesName ?? key);
      const hovered = getHoveredKey();
      const dimmed =
        selectedDataKey != null && selectedDataKey !== key
          ? " opacity-30"
          : hovered != null && hovered !== key
            ? " opacity-30"
            : "";
      const numeric = echartsDatumValue(p.value);
      if (numeric === null) {
        continue;
      }
      const formatted = formatTooltipValue(
        numeric,
        tooltipSlot.valueFormatter
      );
      (numeric > 0 ? items : zeroItems).push({
        key,
        colorsCount,
        labelText,
        value: formatted.numeric,
        valueText: formatted.text,
        dimmed,
        indicatorHtml: configIndicatorHtml(item),
      });
    }

    return tooltipShell({
      label,
      body: composeTooltipBody(
        items.length > 0 ? items : zeroItems,
        tooltipSlot.layout,
        tooltipSlot.barMax
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
      cursor: tooltipSlot.pointer !== "none",
      tokens,
      position: tooltipSlot.position,
      axisPointerColor:
        tooltipSlot.pointer === "shadow"
          ? withAlpha(tokens.foreground, AXIS_POINTER_SHADOW_OPACITY)
          : tokens.border,
      strokeWidth: STROKE_WIDTH,
      pointer: tooltipSlot.pointer,
    }),
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
  miniSeries: BarSeriesOption[];
  dataZoom: DataZoomComponentOption[];
} {
  const {
    data,
    bars,
    isStacked,
    selectedDataKey,
    hasSelection,
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
    boundaryGap: true,
    show: false,
    data: categories,
    axisPointer: { show: false },
  };

  const miniYAxis: YAxisOption = { type: "value", gridIndex: 1, show: false };

  const miniSeries: BarSeriesOption[] = bars.map((bar) => {
    const key = bar.dataKey;
    const base = (ctx.resolved.series[key] ?? [])[0] ?? GRAY;
    const dim = hasSelection && selectedDataKey !== key ? SELECTION_DIM : 1;

    return {
      id: `__mini-${key}`,
      type: "bar",
      xAxisIndex: 1,
      yAxisIndex: 1,
      data: data.map((row) => Number(row[key]) || 0),
      stack: isStacked ? "__mini-total" : undefined,
      silent: true,
      barCategoryGap: "20%",
      emphasis: { disabled: true },
      tooltip: { show: false },
      itemStyle: {
        color: base,
        opacity: BRUSH_FILL_OPACITY * dim,
        borderRadius: 1,
      },
      z: 0,
      animation: false,
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

  return {
    animation: false,
    grid: frame.grid,
    xAxis: frame.xAxis,
    yAxis: frame.yAxis,
    tooltip: { show: false },
    series: [
      {
        id: "__loading",
        type: "bar",
        data: ctx.loadingData(),
        barCategoryGap: "30%",
        silent: true,
        itemStyle: {
          color: withAlpha(tokens.foreground, 0),
          borderRadius: barBorderRadius(
            DEFAULT_BAR_RADIUS,
            "default",
            ctx.isHorizontal
          ),
        },
        z: 1,
      },
    ],
  };
}

function buildBarSeries(ctx: OptionBuildContext): BarSeriesOption[] {
  const {
    data,
    config,
    bars,
    seriesKeys,
    animationType,
    isHorizontal,
    isStacked,
    isPercent,
    selectedDataKey,
    hasSelection,
    barGap,
    barCategoryGap,
    barMaxWidth,
    resolved,
  } = ctx;

  const lastIndex = data.length - 1;

  const rowTotals = isPercent
    ? data.map((row) =>
        seriesKeys.reduce((sum, key) => sum + (Number(row[key]) || 0), 0)
      )
    : [];

  const series: BarSeriesOption[] = bars.map((bar) => {
    const key = bar.dataKey;
    const slots = resolved.series[key] ?? [GRAY];
    const base = slots[0] ?? GRAY;
    const isSelected = selectedDataKey === key;
    const dim = selectionOpacity(selectedDataKey, key);
    const resolvedRadius = bar.radius ?? ctx.barRadius;
    const borderRadius = barBorderRadius(
      resolvedRadius,
      bar.variant,
      isHorizontal
    );
    const blockSize = ctx.barWidthPx ?? BLOCK_SIZE;
    const fill = barFillPaint(bar.variant, slots, isHorizontal, blockSize);
    const barAnim = bar.animationType ?? animationType;
    const isStripped = bar.variant === "stripped";
    const isExpandable = bar.variant === "expandable";
    const mutedFill = withAlpha(
      resolved.tokens.mutedForeground,
      MAX_HIGHLIGHT_DIM
    );
    const isMuted = (i: number) =>
      ctx.maxHighlightIndex != null && i !== ctx.maxHighlightIndex;

    const expandOf = (i: number) =>
      ctx.expand.key === key
        ? (ctx.expand.progress.get(i) ?? EXPAND_COLLAPSED)
        : EXPAND_COLLAPSED;
    const expandHovered = ctx.expand.key === key ? ctx.expand.hovered : null;
    const isBlocks = bar.variant === "blocks";
    const blockTrack = isBlocks
      ? patternFill(
          "blocks",
          withAlpha(resolved.tokens.mutedForeground, BLOCK_TRACK_OPACITY),
          blockSize
        )
      : null;

    const values = data.map((row, i) => {
      const value = Number(row[key]) || 0;
      if (!isPercent) return value;
      const total = rowTotals[i];
      return total ? value / total : 0;
    });

    const bufferStyle = bar.bufferBar
      ? {
          color: patternFill("buffer", base) ?? "transparent",
          borderColor: base,
          borderWidth: STROKE_WIDTH,
          borderRadius,
        }
      : null;

    const glowAt = (i: number) => ({
      shadowBlur: GLOW_BLUR,
      shadowColor: withAlpha(
        sampleGradient(slots, values.length > 1 ? i / (values.length - 1) : 0),
        GLOW_OPACITY
      ),
    });
    const glowFor = bar.glowing
      ? glowAt
      : ctx.maxHighlightIndex != null
        ? (i: number) => (i === ctx.maxHighlightIndex ? glowAt(i) : {})
        : null;

    const dataPoints =
      isStripped ||
      isExpandable ||
      glowFor ||
      ctx.maxHighlightIndex != null ||
      (bufferStyle && lastIndex >= 0)
        ? values.map((value, i) => {
            const isBuffer = !!bufferStyle && i === lastIndex;
            if (
              !isBuffer &&
              !glowFor &&
              !isStripped &&
              !isExpandable &&
              !isMuted(i)
            )
              return value;
            return {
              value,
              ...(isExpandable ? { label: { show: i === expandHovered } } : {}),
              itemStyle: {
                ...(isStripped && !isBuffer
                  ? {
                      color: strippedDatumPaint(
                        slots,
                        isHorizontal,
                        strippedCapFraction(value, ctx.valuePxPerUnit)
                      ),
                    }
                  : {}),
                ...(isExpandable && !isBuffer
                  ? { color: expandableDatumPaint(slots, expandOf(i)) }
                  : {}),
                ...(isBuffer && bufferStyle ? bufferStyle : {}),
                ...(glowFor ? glowFor(i) : {}),
                ...(isMuted(i) ? { color: mutedFill } : {}),
              },
            };
          })
        : values;

    return {
      id: key,
      name: typeof config[key]?.label === "string" ? config[key]?.label : key,
      type: "bar",
      data: dataPoints,
      stack: isStacked ? "total" : undefined,
      barGap,
      barCategoryGap,
      barMaxWidth,
      cursor: bar.isClickable ? "pointer" : "default",
      z: isSelected ? 3 : hasSelection ? 1 : 2,
      label: isExpandable
        ? {
            show: false,
            position: "top",
            color: resolved.tokens.foreground,
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 11,
          }
        : undefined,
      showBackground: isBlocks,
      backgroundStyle: blockTrack
        ? { color: blockTrack, borderRadius }
        : undefined,
      itemStyle: {
        color: fill,
        borderRadius,
        opacity: dim,
      },
      emphasis:
        bar.enableHoverHighlight && !hasSelection
          ? {
              focus: (isStacked ? "series" : "self") as "series" | "self",
              blurScope: "coordinateSystem" as const,
            }
          : { disabled: true },
      blur:
        bar.enableHoverHighlight && !hasSelection
          ? { itemStyle: { opacity: HOVER_BLUR } }
          : undefined,
      animationDuration: BAR_GROW_DURATION,
      animationEasing: "cubicOut",
      animationDelay: (idx: number) =>
        barStaggerDelay(barAnim, idx, data.length),
    };
  });

  const gapUnits =
    (isStacked || isPercent) && series.length > 1 && ctx.valuePxPerUnit
      ? STACK_SEGMENT_GAP / ctx.valuePxPerUnit
      : 0;
  if (!gapUnits) return series;

  const seriesValues = bars.map((bar) =>
    data.map((row) => Number(row[bar.dataKey]) || 0)
  );
  const gapSeries = stackSegmentGapValues(seriesValues, gapUnits);

  const spaced: BarSeriesOption[] = [];
  series.forEach((entry, i) => {
    spaced.push(entry);
    const gapData = gapSeries[i];
    if (!gapData) return;
    spaced.push({
      id: `__stackgap-${i}`,
      type: "bar",
      stack: isStacked ? "total" : undefined,
      data: gapData,
      itemStyle: { color: "transparent" },
      silent: true,
      tooltip: { show: false },
      legendHoverLink: false,
      emphasis: { disabled: true },
      animation: false,
      z: 1,
    });
  });
  return spaced;
}


type LiveState = {
  resolved: ResolvedColors | null;
  hasRevealed: boolean;
  revealEndsAt: number;
  valuePxPerUnit: number | null;
  barWidthPx: number | null;
  expand: {
    key: string | null;
    hovered: number | null;
    progress: Map<number, number>;
  };
  expandRaf: number;
  animateExpand: (key: string | null, index: number | null) => void;
  loadingRows: number[] | null;
  categories: string[];
  dataLength: number;
  brushRange: BrushRange;
  brushGeom: BrushGeometry | null;
  brushOverlay: BrushOverlayElements | null;
  brushHover: { inside: boolean; left: boolean; right: boolean };
  handlers: {
    onBrushChange?: (range: { startIndex: number; endIndex: number }) => void;
    clickableKeys: Set<string>;
    brushFormatLabel?: (value: string, index: number) => string;
    seriesKeys: string[];
    hasStripped: boolean;
    hasBlocks: boolean;
    hasStackGap: boolean;
    expandableKey: string | null;
    barCategoryGap?: number;
    isHorizontal: boolean;
    enableHoverHighlight: boolean;
    selectedDataKey: string | null;
    onHoverChange?: (key: string | null) => void;
    onSelectionChange?: (key: string | null) => void;
  };
  applyHoverKey: (key: string | null) => void;
  hoveredKey: string | null;
  hoverClearRaf: number;
  repush: () => void;
  patchStrippedCaps: () => void;
};

function createInitialLiveState(): LiveState {
  return ({
    resolved: null,
    hasRevealed: false,
    revealEndsAt: 0,
    valuePxPerUnit: null,
    barWidthPx: null,
    expand: { key: null, hovered: null, progress: new Map<number, number>() },
    expandRaf: 0,
    animateExpand: () => {},
    loadingRows: null,
    categories: [],
    dataLength: 0,
    brushRange: { start: 0, end: 100 },
    brushGeom: null,
    brushOverlay: null,
    brushHover: { inside: false, left: false, right: false },
    handlers: {
      onBrushChange: undefined,
      clickableKeys: new Set<string>(),
      brushFormatLabel: undefined,
      seriesKeys: [],
      hasStripped: false,
      hasBlocks: false,
      hasStackGap: false,
      expandableKey: null,
      isHorizontal: false,
      enableHoverHighlight: false,
      selectedDataKey: null,
    },
    applyHoverKey: () => {},
    hoveredKey: null,
    hoverClearRaf: 0,
    repush: () => {},
    patchStrippedCaps: () => {},
  });
}


function legendOverlayStyle(
  verticalAlign: string | undefined,
  brushEnabled: boolean,
  brushHeight: number
): CSSProperties {
  const base: CSSProperties = {
    position: "absolute",
    left: 16,
    right: 16,
    pointerEvents: "auto",
  };
  if (verticalAlign === "top") {
    return { ...base, top: 12 };
  }
  if (verticalAlign === "bottom") {
    return {
      ...base,
      bottom: brushEnabled ? brushHeight + 16 : 12,
    };
  }
  return { ...base, top: "50%", transform: "translateY(-50%)" };
}

function resolveBarCategoryKey(
  categorySlotDataKey: string | undefined,
  xDataKey: string | undefined,
  data: readonly Record<string, unknown>[],
  seriesKeys: readonly string[]
): string {
  if (categorySlotDataKey) {
    return categorySlotDataKey;
  }
  if (xDataKey) {
    return xDataKey;
  }
  const firstRow = data[0];
  if (!firstRow) {
    return "";
  }
  const claimed = new Set(seriesKeys);
  return Object.keys(firstRow).find((key) => !claimed.has(key)) ?? "";
}

function resolveMaxHighlightIndex(
  enabled: boolean,
  data: readonly Record<string, unknown>[],
  seriesKeys: readonly string[]
): number | null {
  if (!enabled || data.length === 0 || seriesKeys.length === 0) {
    return null;
  }
  let best = 0;
  let bestTotal = Number.NEGATIVE_INFINITY;
  data.forEach((row, i) => {
    const total = seriesKeys.reduce(
      (sum, key) => sum + (Number(row[key]) || 0),
      0
    );
    if (total > bestTotal) {
      bestTotal = total;
      best = i;
    }
  });
  return best;
}

function bindBarChartInstance({
  mount,
  live,
  echartsRef,
  setHoveredDataKey,
  toggleSelection,
  syncBrushOverlayNow,
}: {
  mount: HTMLDivElement;
  live: LiveState;
  echartsRef: { current: EChartsInstance | null };
  setHoveredDataKey: (key: string | null) => void;
  toggleSelection: (key: string) => void;
  syncBrushOverlayNow: () => void;
}): () => void {
  const chart = echarts.init(mount);
  echartsRef.current = chart;

  live.applyHoverKey = (key) => {
    if (live.hoverClearRaf) {
      cancelAnimationFrame(live.hoverClearRaf);
      live.hoverClearRaf = 0;
    }
    if (live.hoveredKey === key) {
      return;
    }
    live.hoveredKey = key;
    setHoveredDataKey(key);
    live.handlers.onHoverChange?.(key);
    chart.dispatchAction({ type: "downplay" });
    if (key) {
      chart.dispatchAction({ type: "highlight", seriesId: key });
    }
  };

  const stopResizeObserver = observeChartResize(mount, chart, {
    onResized: () => syncBrushOverlayNow(),
    onSettled: () => live.repush(),
  });

  const themeObserver = new MutationObserver(() => {
    live.repush();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  const onExpandMove = (event: { offsetX: number; offsetY: number }) => {
    const { expandableKey } = live.handlers;
    if (!expandableKey) {
      return;
    }
    const point = [event.offsetX, event.offsetY];
    if (!chart.containPixel({ gridIndex: 0 }, point)) {
      live.animateExpand(expandableKey, null);
      return;
    }
    const converted = chart.convertFromPixel({ gridIndex: 0 }, point);
    const index = Array.isArray(converted) ? converted[0] : converted;
    live.animateExpand(
      expandableKey,
      typeof index === "number" ? Math.round(index) : null
    );
  };
  const onExpandOut = () => {
    const { expandableKey } = live.handlers;
    if (expandableKey) {
      live.animateExpand(expandableKey, null);
    }
    if (live.handlers.enableHoverHighlight) {
      live.applyHoverKey(null);
    }
  };
  chart.getZr().on("mousemove", onExpandMove);
  chart.getZr().on("globalout", onExpandOut);

  chart.on("mouseover", (params) => {
    if (!live.handlers.enableHoverHighlight) {
      return;
    }
    if (live.handlers.selectedDataKey !== null) {
      return;
    }
    const p = params as { seriesId?: string; componentType?: string };
    if (p.componentType !== "series") {
      return;
    }
    const key = String(p.seriesId ?? "");
    if (!key || key.startsWith("__")) {
      return;
    }
    live.applyHoverKey(key);
  });
  chart.on("mouseout", (params) => {
    if (!live.handlers.enableHoverHighlight) {
      return;
    }
    if (live.handlers.selectedDataKey !== null) {
      return;
    }
    const p = params as { seriesId?: string; componentType?: string };
    if (p.componentType !== "series") {
      return;
    }
    const key = String(p.seriesId ?? "");
    if (!key || key.startsWith("__")) {
      return;
    }
    if (live.hoverClearRaf) {
      cancelAnimationFrame(live.hoverClearRaf);
    }
    live.hoverClearRaf = requestAnimationFrame(() => {
      live.hoverClearRaf = 0;
      live.applyHoverKey(null);
    });
  });

  chart.on("click", (params) => {
    const { clickableKeys: clickable, seriesKeys: keys } = live.handlers;
    const p = params as { seriesId?: string; seriesIndex?: number };
    const id =
      p.seriesId ??
      (typeof p.seriesIndex === "number" ? keys[p.seriesIndex] : undefined);
    if (typeof id === "string" && clickable.has(id)) {
      toggleSelection(id);
    }
  });

  chart.on("datazoom", () => {
    const option = chart.getOption() as {
      dataZoom?: { start?: number; end?: number }[];
    };
    const zoom = option.dataZoom?.[0];
    if (!zoom) {
      return;
    }

    live.brushRange = { start: zoom.start ?? 0, end: zoom.end ?? 100 };
    syncBrushOverlayNow();

    const { onBrushChange: onChange } = live.handlers;
    if (!onChange) {
      return;
    }
    const len = live.dataLength;
    const startIndex = Math.round(((zoom.start ?? 0) / 100) * (len - 1));
    const endIndex = Math.round(((zoom.end ?? 100) / 100) * (len - 1));
    onChange({ startIndex, endIndex });
  });

  chart.on("finished", () => {
    const { hasStripped, isHorizontal: horiz } = live.handlers;
    if (!hasStripped || performance.now() < live.revealEndsAt) {
      return;
    }
    const measured = measureValuePxPerUnit(chart, horiz);
    if (measured == null) {
      return;
    }
    if (
      live.valuePxPerUnit != null &&
      Math.abs(measured - live.valuePxPerUnit) < 0.5
    ) {
      return;
    }
    live.valuePxPerUnit = measured;
    live.patchStrippedCaps();
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
    if (!geom) {
      return;
    }
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
    zr.off("mousemove", onExpandMove);
    zr.off("globalout", onExpandOut);
    zr.off("mousemove", onZrMove);
    zr.off("globalout", onZrOut);
    chart.off("mouseover");
    chart.off("mouseout");
    chart.off("click");
    chart.off("datazoom");
    chart.off("finished");
    stopResizeObserver();
    themeObserver.disconnect();
    chart.dispose();
    echartsRef.current = null;
    live.brushOverlay = null;
    live.hasRevealed = false;
    live.hoveredKey = null;
    if (live.hoverClearRaf) {
      cancelAnimationFrame(live.hoverClearRaf);
      live.hoverClearRaf = 0;
    }
    live.applyHoverKey = () => {};
  };
}


/**
 * Apache ECharts port of the EvilCharts bar chart, exposing a compound-as-config
 * API so its JSX reads identically to the Recharts twin. The root owns the data,
 * config, selection state, loading skeleton, intro grow-in, and optional zoom
 * brush; every visual part — `<Bar>`, `<XAxis>`, `<YAxis>`, `<Grid>`,
 * `<Tooltip>`, `<Legend>` — is composed as a declarative child that renders
 * nothing. The root walks those children by reference and drives a single
 * imperative ECharts instance. Fully self-contained: its only dependencies are
 * `react`, `echarts`, and `motion`.
 */
export function EChartsBarChart<TData extends Record<string, unknown>>({
  data,
  config,
  xDataKey,
  className,
  stackType = "default",
  layout = "vertical",
  barRadius = DEFAULT_BAR_RADIUS,
  animation = true,
  animationType = "left-to-right",
  barGap,
  barCategoryGap,
  barMaxWidth,
  defaultSelectedDataKey = null,
  onSelectionChange,
  hoverDataKey,
  onHoverChange,
  enableMaxValueHighlight = false,
  isLoading = false,
  loadingBars = LOADING_DEFAULT_BARS,
  chartOptions,
  markers,
  children,
}: EChartsBarChartProps<TData>) {
  const rawId = useId();
  const chartId = `chart-${rawId.replace(/:/g, "")}`;

  const containerRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const echartsRef = useRef<EChartsInstance | null>(null);

  const liveRef = useRef<LiveState | null>(null);
  if (liveRef.current === null) {
    liveRef.current = createInitialLiveState();
  }
  const live = liveRef.current;

  const loadingData = useCallback(
    () => (live.loadingRows ??= getLoadingBarData(loadingBars)),
    [live, loadingBars]
  );
  const shouldReduceMotion = useReducedMotion();

  const [selectedDataKey, setSelectedDataKey] = useState<string | null>(
    defaultSelectedDataKey
  );
  const [hoveredDataKey, setHoveredDataKey] = useState<string | null>(null);

  const locale = useLocale();
  const collected = useMemo(
    () => withLocaleTooltip(collectConfig(children), locale),
    [children, locale]
  );
  const {
    bars,
    xAxis: xAxisSlot,
    yAxis: yAxisSlot,
    showGrid,
    tooltip: tooltipSlot,
    legend: legendSlot,
    brush: brushSlot,
  } = collected;
  const showBrush = brushSlot.present;
  const brushHeight = brushSlot.height ?? 56;

  const isHorizontal = layout === "horizontal";
  const isPercent = stackType === "percent";
  const isStacked = stackType === "stacked" || isPercent;

  const categorySlot = isHorizontal ? yAxisSlot : xAxisSlot;
  const valueSlot = useMemo(() => {
    const slot = isHorizontal ? xAxisSlot : yAxisSlot;
    return {
      ...slot,
      tickFormatter:
        slot.tickFormatter ??
        ((value: string) => Number(value).toLocaleString(locale)),
    };
  }, [isHorizontal, xAxisSlot, yAxisSlot, locale]);

  const seriesKeys = useMemo(() => bars.map((bar) => bar.dataKey), [bars]);

  const categoryKey = useMemo(
    () =>
      resolveBarCategoryKey(
        categorySlot.dataKey,
        xDataKey as string | undefined,
        data,
        seriesKeys
      ),
    [categorySlot.dataKey, xDataKey, data, seriesKeys]
  );

  const effectiveAnimation = bars[0]?.animationType ?? animationType;

  const maxHighlightIndex = useMemo(
    () => resolveMaxHighlightIndex(enableMaxValueHighlight, data, seriesKeys),
    [enableMaxValueHighlight, data, seriesKeys]
  );

  const css = useMemo(() => buildChartCss(chartId, config), [chartId, config]);

  const hasSelection = selectedDataKey !== null;

  const clickableKeys = useMemo(
    () =>
      new Set(bars.filter((bar) => bar.isClickable).map((bar) => bar.dataKey)),
    [bars]
  );

  const hasStrippedBars =
    !isLoading && bars.some((bar) => bar.variant === "stripped");

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally runs after every render to snapshot the latest values.
  useLayoutEffect(() => {
    live.handlers = {
      onBrushChange: brushSlot.onChange,
      clickableKeys,
      brushFormatLabel: brushSlot.formatLabel,
      seriesKeys,
      hasStripped: hasStrippedBars,
      hasBlocks: bars.some((bar) => bar.variant === "blocks"),
      hasStackGap:
        (stackType === "stacked" || stackType === "percent") && bars.length > 1,
      expandableKey:
        bars.find((bar) => bar.variant === "expandable")?.dataKey ?? null,
      barCategoryGap,
      isHorizontal,
      enableHoverHighlight: bars.some((bar) => bar.enableHoverHighlight),
      selectedDataKey,
      onHoverChange,
      onSelectionChange,
    };
    live.dataLength = data.length;
  });

  const toggleSelection = useCallback(
    (key: string) => {
      const next = live.handlers.selectedDataKey === key ? null : key;
      live.handlers.selectedDataKey = next;
      setSelectedDataKey(next);
      live.handlers.onSelectionChange?.(next);
    },
    [live]
  );

  const brushEnabled = showBrush && !isHorizontal;

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

    const categories = data.map((row) => String(row[categoryKey]));
    live.categories = categories;

    const ctx: OptionBuildContext = {
      data,
      config,
      bars,
      seriesKeys,
      animationType,
      barRadius,
      isHorizontal,
      isStacked,
      isPercent,
      selectedDataKey,
      hasSelection,
      showGrid,
      categorySlot,
      valueSlot,
      tooltipSlot,
      legendSlot,
      isLoading,
      loadingData,
      showBrush: brushEnabled,
      brushHeight,
      barGap,
      barCategoryGap,
      barMaxWidth,
      resolved,
      categories,
      brushRange: live.brushRange,
      valuePxPerUnit: live.valuePxPerUnit,
      barWidthPx: live.barWidthPx,
      expand: live.expand,
      maxHighlightIndex,
      getHoveredKey: () => live.hoveredKey,
    };

    const { grid, brushBottom } = buildChartLayout(ctx);
    live.brushGeom = brushEnabled
      ? { bottom: brushBottom, height: brushHeight }
      : null;

    const { xAxis, yAxis } = buildMainAxes(ctx);

    if (isLoading) return buildLoadingOption(ctx, { grid, xAxis, yAxis });

    const brush = brushEnabled ? buildBrushOption(ctx, brushBottom) : null;

    return {
      animation: false,
      grid: brush ? [grid, brush.miniGrid] : grid,
      xAxis: brush ? [xAxis, brush.miniXAxis] : xAxis,
      yAxis: brush ? [yAxis, brush.miniYAxis] : yAxis,
      tooltip: buildTooltipOption(ctx),
      dataZoom: brush?.dataZoom,
      series: [...buildBarSeries(ctx), ...(brush?.miniSeries ?? [])],
    };
  }, [
    live,
    data,
    config,
    bars,
    seriesKeys,
    categoryKey,
    animationType,
    barRadius,
    isHorizontal,
    isStacked,
    isPercent,
    selectedDataKey,
    hasSelection,
    showGrid,
    categorySlot,
    valueSlot,
    tooltipSlot,
    legendSlot,
    isLoading,
    loadingData,
    brushEnabled,
    brushHeight,
    barGap,
    barCategoryGap,
    barMaxWidth,
    maxHighlightIndex,
  ]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }
    return bindBarChartInstance({
      echartsRef,
      live,
      mount,
      setHoveredDataKey,
      syncBrushOverlayNow,
      toggleSelection,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hoverDataKey === undefined) {
      return;
    }
    live.applyHoverKey(hoverDataKey);
  }, [hoverDataKey, live]);

  useEffect(() => {
    const chart = echartsRef.current;
    const container = containerRef.current;
    if (!chart || !container) return;

    live.resolved = resolveColors(container, config, seriesKeys);

    const push = (withEntrance: boolean) => {
      const measured = measureValuePxPerUnit(chart, isHorizontal);
      if (measured != null) live.valuePxPerUnit = measured;

      const apply = () => {
        const option = buildOption();
        const merged = chartOptions ? { ...option, ...chartOptions } : option;
        applyChartMarkers(
          merged,
          markers,
          live.resolved?.tokens.foreground ?? "rgba(60, 60, 60, 1)",
          live.resolved?.tokens.background ?? "rgba(255, 255, 255, 1)"
        );
        Object.assign(merged, {
          animation: withEntrance,
          animationDuration: BAR_GROW_DURATION,
          animationDurationUpdate: 0,
        });
        chart.setOption(merged as EChartsOption, { notMerge: true });
        keepTooltipContentMounted(chart);
      };

      apply();

      let needsRebuild = false;
      if (live.handlers.hasBlocks) {
        const width = measureBarWidthPx(chart, isHorizontal, barCategoryGap);
        if (
          width != null &&
          (live.barWidthPx == null || Math.abs(width - live.barWidthPx) > 0.5)
        ) {
          live.barWidthPx = width;
          needsRebuild = true;
        }
      }
      if (live.handlers.hasStackGap || live.handlers.hasStripped) {
        const scale = measureValuePxPerUnit(chart, isHorizontal);
        if (
          scale != null &&
          (live.valuePxPerUnit == null || live.valuePxPerUnit !== scale)
        ) {
          live.valuePxPerUnit = scale;
          needsRebuild = true;
        }
      }
      if (needsRebuild) apply();
      const maxStagger = data.length > 1 ? (data.length - 1) * BAR_STAGGER : 0;
      live.revealEndsAt = withEntrance
        ? performance.now() + BAR_GROW_DURATION + maxStagger
        : 0;
      syncBrushOverlayNow();
      chart.dispatchAction({ type: "downplay" });
      if (live.hoveredKey) {
        chart.dispatchAction({
          type: "highlight",
          seriesId: live.hoveredKey,
        });
      }
    };

    live.animateExpand = (key: string | null, index: number | null) => {
      const expandKeys = new Set(
        bars
          .filter((bar) => bar.variant === "expandable")
          .map((bar) => bar.dataKey)
      );
      if (!expandKeys.size) return;

      const next = index != null && key != null ? index : null;
      if (
        live.expand.hovered === next &&
        (key == null || live.expand.key === key)
      )
        return;
      if (key != null) live.expand.key = key;
      live.expand.hovered = next;
      if (next != null && !live.expand.progress.has(next)) {
        live.expand.progress.set(next, EXPAND_COLLAPSED);
      }
      if (live.expandRaf) return;

      const patchOnce = () => {
        const option = buildOption();
        const series = Array.isArray(option.series)
          ? option.series
          : option.series
            ? [option.series]
            : [];
        const patch = series.filter(
          (s): s is BarSeriesOption =>
            typeof s?.id === "string" && expandKeys.has(s.id)
        );
        if (patch.length)
          chart.setOption(
            { series: patch },
            { silent: true, lazyUpdate: true }
          );
      };

      let last = performance.now();
      const step = () => {
        const now = performance.now();
        const dt = Math.min(64, now - last);
        last = now;
        const k = 1 - Math.exp(-dt / EXPAND_TAU);
        let moving = false;
        for (const [i, value] of live.expand.progress) {
          const target = i === live.expand.hovered ? 1 : EXPAND_COLLAPSED;
          const eased = value + (target - value) * k;
          if (Math.abs(target - eased) < 0.004) {
            if (target === EXPAND_COLLAPSED) live.expand.progress.delete(i);
            else live.expand.progress.set(i, target);
          } else {
            live.expand.progress.set(i, eased);
            moving = true;
          }
        }
        patchOnce();
        live.expandRaf = moving ? requestAnimationFrame(step) : 0;
      };
      live.expandRaf = requestAnimationFrame(step);
    };

    live.patchStrippedCaps = () => {
      const option = buildOption();
      const series = Array.isArray(option.series)
        ? option.series
        : option.series
          ? [option.series]
          : [];
      const strippedKeys = new Set(
        bars
          .filter((bar) => bar.variant === "stripped")
          .map((bar) => bar.dataKey)
      );
      const patch = series.filter(
        (s): s is BarSeriesOption =>
          typeof s?.id === "string" && strippedKeys.has(s.id)
      );
      if (patch.length)
        chart.setOption({ series: patch }, { silent: true, lazyUpdate: true });
    };

    if (isLoading) live.hasRevealed = false;
    const shouldReveal = !live.hasRevealed && !isLoading;
    if (shouldReveal) live.hasRevealed = true;
    const revealEnabled =
      animation &&
      shouldReveal &&
      effectiveAnimation !== "none" &&
      !shouldReduceMotion;
    push(revealEnabled);

    live.repush = () => {
      live.resolved = resolveColors(container, config, seriesKeys);
      push(false);
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
    data.length,
    bars,
    isHorizontal,
    barCategoryGap,
    syncBrushOverlayNow,
  ]);

  useEffect(() => {
    const chart = echartsRef.current;
    const index = tooltipSlot.defaultIndex;
    if (!chart || isLoading || !tooltipSlot.present || index == null) return;
    const timer = setTimeout(() => {
      chart.dispatchAction({
        type: "showTip",
        seriesIndex: 0,
        dataIndex: index,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [
    tooltipSlot.present,
    tooltipSlot.defaultIndex,
    isLoading,
    data.length,
    seriesKeys.length,
  ]);

  useEffect(() => {
    const chart = echartsRef.current;
    if (!chart || !isLoading) return;

    let raf = 0;
    let lastPhase = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const phase =
        ((((now - start) / LOADING_ANIMATION_DURATION) % 1) + 1) % 1;
      if (phase < lastPhase) live.loadingRows = getLoadingBarData(loadingBars);
      lastPhase = phase;

      const foreground = live.resolved?.tokens.foreground ?? GRAY;
      const w = chart.getWidth();
      const h = chart.getHeight();
      if (!w || !h) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const maxT = (w + h) / (2 * w);
      const center =
        phase * (maxT + 2 * LOADING_SHIMMER_BAND) - LOADING_SHIMMER_BAND;
      const fill = new echarts.graphic.LinearGradient(
        0,
        0,
        w,
        w,
        shimmerWindowStops(center, foreground, LOADING_SHIMMER_MAX_OPACITY),
        true
      );
      chart.setOption(
        {
          series: [
            {
              id: "__loading",
              data: loadingData(),
              itemStyle: { color: fill },
            },
          ],
        },
        { silent: true, lazyUpdate: true }
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [live, isLoading, loadingBars, loadingData]);

  const legendStyle = legendOverlayStyle(
    legendSlot.verticalAlign,
    brushEnabled,
    brushHeight
  );

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


function getLoadingBarData(bars: number): number[] {
  const rows: number[] = [];
  let value = 40 + Math.random() * 25;
  for (let i = 0; i < bars; i++) {
    value = Math.min(85, Math.max(20, value + (Math.random() - 0.5) * 30));
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

EChartsBarChart.Bar = Bar;
EChartsBarChart.XAxis = XAxis;
EChartsBarChart.YAxis = YAxis;
EChartsBarChart.Grid = Grid;
EChartsBarChart.Tooltip = Tooltip;
EChartsBarChart.Legend = Legend;
EChartsBarChart.Brush = Brush;
