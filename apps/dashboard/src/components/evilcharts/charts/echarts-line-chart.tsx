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
import type { ComposeOption } from "echarts/core";
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
import { withLocaleTooltip, withLocaleValueAxis } from "@/utils/chart-locale";
import { buildZeroBaselineAxisLine } from "@/utils/chart-zero-baseline";
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
  seriesPaint,
  withAlpha,
} from "@/components/evilcharts/ui/echarts-chart";
import {
  type DotItemStyleOption,
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
import { observeChartResize } from "@/components/evilcharts/ui/echarts-resize";

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  MarkLineComponent,
  CanvasRenderer,
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



const STROKE_WIDTH = 0.8;
const LOADING_ANIMATION_DURATION = 2000;
const REVEAL_DURATION = 1000;
const LOADING_DEFAULT_POINTS = 14;
const BUFFER_DASH: [number, number] = [4, 3];

const GLOW_LAYERS: {
  width: number;
  opacity: number;
  blur: number;
  symbolPad: number;
}[] = [
  { width: 2, opacity: 0.9, blur: 5, symbolPad: 2 },
  { width: 2, opacity: 0.6, blur: 12, symbolPad: 6 },
  { width: 2, opacity: 0.38, blur: 24, symbolPad: 11 },
  { width: 2, opacity: 0.22, blur: 42, symbolPad: 16 },
];

const GRID_LINE_OPACITY = 1;
const AXIS_POINTER_OPACITY = 0.45;
const AXIS_POINTER_WIDTH = 1;
const LOADING_STROKE_OPACITY = 0.5;
const LOADING_SHIMMER_BAND = 0.2;
const LOADING_SHIMMER_FEATHER = 0.2;
const BRUSH_STROKE_OPACITY = 0.5;
const BRUSH_FILLER_OPACITY = 0;


export type StrokeVariant = "solid" | "dashed" | "animated-dashed";
export type LineAnimationType =
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

export interface EChartsLineChartProps<TData extends Record<string, unknown>> {
  data: TData[]; // rows rendered by the chart
  config: ChartConfig; // series colors + labels
  xDataKey?: keyof TData & string; // x category key — falls back to the <XAxis> dataKey / first free column
  className?: string; // extra classes for the chart container
  curveType?: CurveType; // default curve interpolation each <Line> inherits
  animation?: boolean; // master switch for the intro draw-in — false renders instantly
  animationType?: LineAnimationType; // default intro reveal (first <Line> overrides)
  enableHoverHighlight?: boolean; // hovering a series dims the others, like a temporary selection
  enableHoverReveal?: boolean; // hovering colors each line up to the pointer's x and mutes the rest
  defaultSelectedDataKey?: string | null; // series selected on first render
  onSelectionChange?: (key: string | null) => void; // fires when the selected series changes
  isLoading?: boolean; // shows the animated loading skeleton
  loadingPoints?: number; // number of points in the loading skeleton
  chartOptions?: Record<string, unknown>; // escape hatch merged over the built ECharts option
  markers?: readonly ChartMarker[]; // vertical annotation lines pinned to x-axis categories
  children?: ReactNode; // declarative config — <Line>, <XAxis>, <Grid>, <Tooltip>, <Legend>, <Brush>, …
}


export interface LineProps {
  dataKey: string; // series key — must exist on the data + config
  strokeVariant?: StrokeVariant; // stroke style for this line
  strokeWidth?: number; // stroke thickness in pixels for this line
  curveType?: CurveType; // curve interpolation — falls back to the root curveType
  animationType?: LineAnimationType; // intro reveal — first line drives the wrapper wipe
  connectNulls?: boolean; // join segments across null/missing values
  isClickable?: boolean; // lets this line be selected by clicking it
  glowing?: boolean; // applies a soft outer glow to this line
  enableBufferLine?: boolean; // renders this line's last segment as a dashed buffer
  children?: ReactNode; // optional <Dot> and <ActiveDot> config
}

/**
 * A single line series. Declares its own stroke/curve/glow/clickability and,
 * optionally, resting/active point markers via composed <Dot> / <ActiveDot>.
 * Renders nothing — the root reads these props to build the ECharts series.
 */
const Line: FC<LineProps> = () => null;

export interface DotProps {
  variant?: DotVariant; // visual style of the point marker
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
  dataKey?: string; // reserved for parity with the Recharts twin
  tickFormatter?: (value: number, index: number) => string; // formats y tick labels
  label?: string; // axis title, rotated alongside the tick labels
  hideDots?: boolean; // hides the tick dots beside this axis's labels
}

const YAxis: FC<YAxisProps> = () => null;

const Grid: FC = () => null;

export interface TooltipProps {
  variant?: TooltipVariant; // visual style of the tooltip surface
  roundness?: TooltipRoundness; // border-radius of the tooltip
  cursor?: boolean; // whether the vertical cursor line follows the pointer
  crosshair?: boolean; // also draw the horizontal line to the value axis
  position?: TooltipPosition; // "variable" follows both axes (default); "fixed" pins the tooltip near the top and tracks the pointer's X
  layout?: TooltipLayout; // "rows" is the default swatch list; "bars" ranks series as a mini bar chart
  valueFormatter?: TooltipValueFormatter;
  barMax?: number; // bar layout: scale tracks to this ceiling (e.g. 100 for percents); omit to scale to the hovered max
}

const Tooltip: FC<TooltipProps> = () => null;

export interface LegendProps {
  variant?: LegendVariant; // visual style of the legend indicators
  align?: "left" | "center" | "right"; // horizontal placement
  verticalAlign?: "top" | "middle" | "bottom"; // vertical placement
  isClickable?: boolean; // lets each entry toggle selection of its series
}

const Legend: FC<LegendProps> = () => null;


type LineSeriesConfig = {
  dataKey: string;
  strokeVariant: StrokeVariant;
  strokeWidth: number;
  curveType?: CurveType;
  animationType?: LineAnimationType;
  connectNulls: boolean;
  isClickable: boolean;
  glowing: boolean;
  enableBufferLine: boolean;
  dotVariant: DotVariant;
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
  present: boolean;
  dataKey?: string;
  tickFormatter?: (value: number, index: number) => string;
  label?: string;
  hideDots: boolean;
};
type TooltipSlot = {
  present: boolean;
  variant: TooltipVariant;
  roundness: TooltipRoundness;
  cursor: boolean;
  crosshair?: boolean;
  position: TooltipPosition;
  layout: TooltipLayout;
  valueFormatter?: TooltipValueFormatter;
  barMax?: number;
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
  lines: LineSeriesConfig[];
  xAxis: XAxisSlot;
  yAxis: YAxisSlot;
  showGrid: boolean;
  tooltip: TooltipSlot;
  legend: LegendSlot;
  brush: BrushSlot;
};

function collectConfig(children: ReactNode): CollectedConfig {
  const lines: LineSeriesConfig[] = [];
  let xAxis: XAxisSlot = { present: false, hideDots: false };
  let yAxis: YAxisSlot = { present: false, hideDots: false };
  let showGrid = false;
  let tooltip: TooltipSlot = {
    present: false,
    variant: "default",
    roundness: "lg",
    cursor: true,
    position: "variable",
    layout: "rows",
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

    if (type === Line) {
      const props = child.props as LineProps;
      let dotVariant: DotVariant = "none";
      let activeDotVariant: DotVariant = "none";
      Children.forEach(props.children, (dotChild) => {
        if (!isValidElement(dotChild)) return;
        if (dotChild.type === Dot) {
          dotVariant = (dotChild.props as DotProps).variant ?? "default";
        } else if (dotChild.type === ActiveDot) {
          activeDotVariant = (dotChild.props as DotProps).variant ?? "default";
        }
      });
      lines.push({
        dataKey: props.dataKey,
        strokeVariant: props.strokeVariant ?? "solid",
        strokeWidth: props.strokeWidth ?? STROKE_WIDTH,
        curveType: props.curveType,
        animationType: props.animationType,
        connectNulls: props.connectNulls ?? false,
        isClickable: props.isClickable ?? false,
        glowing: props.glowing ?? false,
        enableBufferLine: props.enableBufferLine ?? false,
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
        cursor: props.cursor ?? true,
        crosshair: props.crosshair ?? false,
        position: props.position ?? "variable",
        layout: props.layout ?? "rows",
        valueFormatter: props.valueFormatter,
        barMax: props.barMax,
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

  return { lines, xAxis, yAxis, showGrid, tooltip, legend, brush };
}


function buildGlowSeries(params: {
  key: string;
  paint: string | echarts.graphic.LinearGradient;
  slots: string[];
  values: (number | null)[];
  curve: { smooth: boolean; step: "middle" | false; smoothMonotone?: "x" };
  connectNulls: boolean;
  z: number;
  selectionDim: number;
  dotSize: number;
}): LineSeriesOption[] {
  const {
    key,
    paint,
    slots,
    values,
    curve,
    connectNulls,
    z,
    selectionDim,
    dotSize,
  } = params;
  const multiColor = slots.length > 1;
  const base = slots[0] ?? "rgba(120, 120, 120, 1)";
  const showDots = dotSize > 0;

  return GLOW_LAYERS.map((layer, i): LineSeriesOption => {
    const glowOpacity = layer.opacity * selectionDim;
    const blurOpacity = glowOpacity * 0.3;
    const glowData: LinePoint[] =
      !multiColor || !showDots
        ? values
        : values.map((value, idx): LinePoint => {
            if (value === null) return null;
            const t = values.length > 1 ? idx / (values.length - 1) : 0;
            const color = sampleGradient(slots, t);
            return {
              value,
              itemStyle: { color, opacity: glowOpacity },
              emphasis: { itemStyle: { color, opacity: glowOpacity } },
            };
          });

    return {
      id: `__glow-${i}-${key}`,
      type: "line",
      data: glowData,
      smooth: curve.smooth,
      smoothMonotone: curve.smoothMonotone,
      step: curve.step,
      connectNulls,
      silent: true,
      showSymbol: showDots,
      symbol: "circle",
      symbolSize: showDots ? dotSize + layer.symbolPad : 0,
      tooltip: { show: false },
      z,
      lineStyle: {
        color: paint,
        width: layer.width,
        opacity: glowOpacity,
        shadowBlur: layer.blur,
        shadowColor: sampleGradient(slots, 0.5),
        cap: "round",
        join: "round",
      },
      itemStyle: multiColor
        ? { opacity: glowOpacity }
        : { color: base, opacity: glowOpacity },
      emphasis: {
        focus: "none",
        scale: false,
        lineStyle: { opacity: glowOpacity },
        itemStyle: { opacity: glowOpacity },
      },
      blur: {
        lineStyle: { opacity: blurOpacity },
        itemStyle: { opacity: blurOpacity },
      },
    };
  });
}



function curveConfig(curveType: CurveType): {
  smooth: boolean;
  step: "middle" | false;
  smoothMonotone?: "x";
} {
  if (curveType === "step") return { smooth: false, step: "middle" };
  if (curveType === "linear") return { smooth: false, step: false };
  if (curveType === "monotone" || curveType === "monotoneX") {
    return { smooth: true, step: false, smoothMonotone: "x" };
  }
  return { smooth: true, step: false };
}


function getOpacity(selected: string | null, key: string) {
  if (selected === null || selected === key) return { stroke: 1, dot: 1 };
  return { stroke: 0.3, dot: 0.3 };
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
const REVEAL_PREFIX = "__reveal-";



type OptionBuildContext = {
  data: Record<string, unknown>[];
  config: ChartConfig;
  lines: LineSeriesConfig[];
  curveType: CurveType;
  selectedDataKey: string | null;
  hasSelection: boolean;
  showGrid: boolean;
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
  revealIndex: number | null;
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
  const { xAxisSlot, yAxisSlot, showGrid, isLoading, categories, loadingData } =
    ctx;
  const { tokens } = ctx.resolved;

  const axisLabelColor = tokens.mutedForeground;
  const splitLineColor = withAlpha(tokens.border, GRID_LINE_OPACITY);
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
      isLoading ? [] : ctx.lines.map((line) => line.dataKey),
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
        type: [3, 3] as [number, number],
        width: 1,
      },
    },
    axisLabel: {
      show: yAxisSlot.present && !isLoading,
      color: axisLabelColor,
      fontSize: 10,
      margin: 8,
      formatter: yTickFormatter
        ? (value: number, index: number) => yTickFormatter(value, index)
        : undefined,
    },
  };

  return { xAxis, yAxis };
}

function createTooltipFormatter(ctx: OptionBuildContext) {
  const { config, selectedDataKey, tooltipSlot, getHoveredKey } = ctx;

  return (params: unknown): string => {
    const rows = Array.isArray(params) ? params : [params];
    if (!rows.length) return "";

    const first = rows[0] as { axisValue?: string | number; name?: string };
    const axisValue = first.axisValue ?? first.name ?? "";
    const label = String(axisValue);

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
      if (!key) continue;
      if (p.value === null || p.value === undefined) continue;
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
      const formatted = formatTooltipValue(
        p.value,
        tooltipSlot.valueFormatter
      );
      items.push({
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
        items,
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
      cursor: tooltipSlot.cursor,
      crosshair: tooltipSlot.crosshair,
      tokens,
      position: tooltipSlot.position,
      axisPointerColor: withAlpha(tokens.mutedForeground, AXIS_POINTER_OPACITY),
      strokeWidth: AXIS_POINTER_WIDTH,
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
  miniSeries: LineSeriesOption[];
  dataZoom: DataZoomComponentOption[];
} {
  const { data, lines, curveType, selectedDataKey, brushHeight, categories } =
    ctx;
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

  const miniSeries: LineSeriesOption[] = lines.map((line) => {
    const key = line.dataKey;
    const base =
      (ctx.resolved.series[key] ?? [])[0] ?? "rgba(120, 120, 120, 1)";
    const curve = curveConfig(line.curveType ?? curveType);

    const strokeDim = getOpacity(selectedDataKey, key).stroke;

    return {
      id: `__mini-${key}`,
      type: "line",
      xAxisIndex: 1,
      yAxisIndex: 1,
      data: data.map((row) => Number(row[key]) || 0),
      smooth: curve.smooth,
      smoothMonotone: curve.smoothMonotone,
      step: curve.step,
      connectNulls: line.connectNulls,
      silent: true,
      showSymbol: false,
      emphasis: { disabled: true },
      tooltip: { show: false },
      lineStyle: {
        color: base,
        width: 1,
        opacity: BRUSH_STROKE_OPACITY * strokeDim,
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
        z: 1,
      },
    ],
  };
}

type LinePoint =
  | number
  | null
  | {
      value: number | null;
      itemStyle: DotItemStyleOption;
      emphasis: { itemStyle: DotItemStyleOption };
    };

function buildLineSeries(ctx: OptionBuildContext): LineSeriesOption[] {
  const {
    data,
    config,
    lines,
    curveType,
    selectedDataKey,
    hasSelection,
    enableHoverHighlight,
    enableHoverReveal,
    revealIndex,
    revealSink,
    resolved,
    rendererSize,
  } = ctx;
  const background = resolved.tokens.background;

  return lines.flatMap((line): LineSeriesOption[] => {
    const key = line.dataKey;
    const slots = resolved.series[key] ?? ["rgba(120, 120, 120, 1)"];
    const paint = seriesPaint(slots);
    const isSelected = selectedDataKey === key;
    const opacity = getOpacity(selectedDataKey, key);
    const curve = curveConfig(line.curveType ?? curveType);
    const multiColor = slots.length > 1;

    const restingDot = dotStyle(line.dotVariant, paint, background);
    const activeDot = dotStyle(line.activeDotVariant, paint, background);
    const restingVisible = line.dotVariant !== "none";
    const dotOpacity = opacity.dot;

    const values = data.map((row) => Number(row[key]) || 0);
    const n = values.length;
    const reveal = enableHoverReveal;
    const buffer = !reveal && line.enableBufferLine && n >= 2;
    const revealActive = reveal && revealIndex !== null;

    const mainDash: "solid" | [number, number] =
      buffer || line.strokeVariant === "solid" ? "solid" : [3, 3];

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

    const toPoints = (vals: (number | null)[]): LinePoint[] =>
      multiColor
        ? vals.map((value, i): LinePoint => {
            if (value === null) return null;
            const t = vals.length > 1 ? i / (vals.length - 1) : 0;
            const pointColor = sampleGradient(slots, t);
            return {
              value,
              itemStyle: {
                ...dotItemStyle(
                  restingVisible ? line.dotVariant : line.activeDotVariant,
                  pointColor,
                  background
                ),
                opacity: dotOpacity,
              },
              emphasis: {
                itemStyle: {
                  ...dotItemStyle(
                    line.activeDotVariant === "none"
                      ? "default"
                      : line.activeDotVariant,
                    pointColor,
                    background
                  ),
                  opacity: 1,
                },
              },
            };
          })
        : vals;

    if (reveal) revealSink[key] = toPoints(values);

    const mainValues: (number | null)[] = buffer
      ? values.map((v, i) => (i === n - 1 ? null : v))
      : revealActive
        ? sliceToNull(values, revealIndex as number)
        : values;

    const z = isSelected ? 3 : hasSelection ? 1 : 2;

    const glowSeries =
      line.glowing && !reveal
        ? buildGlowSeries({
            key,
            paint,
            slots,
            values,
            curve,
            connectNulls: line.connectNulls,
            z,
            selectionDim: opacity.stroke,
            dotSize: restingVisible ? restingDot.size : 0,
          })
        : [];

    const mainSeries: LineSeriesOption = {
      id: key,
      name: typeof config[key]?.label === "string" ? config[key]?.label : key,
      type: "line",
      data: toPoints(mainValues),
      smooth: curve.smooth,
      smoothMonotone: curve.smoothMonotone,
      step: curve.step,
      connectNulls: line.connectNulls,
      cursor: line.isClickable ? "pointer" : "default",
      // By default ECharts only fires mouse events on the symbols — this makes
      // the line itself clickable too, like the Recharts <Line>.
      // (`true` covers both; the deprecated `triggerLineEvent` did the same.)
      triggerEvent: line.isClickable,
      showSymbol: restingVisible,
      symbol: "circle",
      symbolSize: restingVisible ? restingDot.size : activeDot.size,
      z,
      lineStyle: {
        color: strokePaint,
        width: line.strokeWidth,
        opacity: opacity.stroke,
        type: mainDash,
        dashOffset: 0,
      },
      itemStyle: multiColor
        ? { opacity: dotOpacity }
        : {
            ...(restingVisible ? restingDot.itemStyle : activeDot.itemStyle),
            opacity: dotOpacity,
          },
      emphasis: {
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
      blur: {
        lineStyle: { opacity: 0.3 },
        itemStyle: { opacity: 0.3 },
      },
    };

    if (reveal) {
      const revealBase: LineSeriesOption = {
        id: `${REVEAL_PREFIX}${key}`,
        type: "line",
        data: revealActive ? sliceFrom(values, revealIndex as number) : values,
        smooth: curve.smooth,
        smoothMonotone: curve.smoothMonotone,
        step: curve.step,
        connectNulls: false,
        silent: true,
        showSymbol: false,
        symbol: "circle",
        z: z - 1,
        lineStyle: {
          color: strokePaint,
          width: line.strokeWidth,
          type: mainDash,
          opacity: revealActive ? 0.3 : 0,
        },
        emphasis: { disabled: true },
        blur: { lineStyle: { opacity: revealActive ? 0.3 : 0 } },
        tooltip: { show: false },
      };
      return [revealBase, mainSeries];
    }

    if (!buffer) return [...glowSeries, mainSeries];

    const bufferValues: (number | null)[] = values.map((v, i) =>
      i >= n - 2 ? v : null
    );
    const bufferSeries: LineSeriesOption = {
      id: `${BUFFER_PREFIX}${key}`,
      type: "line",
      data: toPoints(bufferValues),
      smooth: curve.smooth,
      smoothMonotone: curve.smoothMonotone,
      step: curve.step,
      connectNulls: true,
      silent: true,
      showSymbol: restingVisible,
      symbol: "circle",
      symbolSize: restingVisible ? restingDot.size : activeDot.size,
      z,
      lineStyle: {
        color: paint,
        width: line.strokeWidth,
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

    return [...glowSeries, mainSeries, bufferSeries];
  });
}

function sliceToNull<T>(vals: readonly T[], idx: number): (T | null)[] {
  return vals.map((v, i) => (i > idx ? null : v));
}

function sliceFrom<T>(vals: readonly T[], idx: number): (T | null)[] {
  return vals.map((v, i) => (i < idx ? null : v));
}


type LiveState = {
  resolved: ResolvedColors | null;
  hoveredKey: string | null;
  hasRevealed: boolean;
  revealEndsAt: number;
  loadingRows: number[] | null;
  categories: string[];
  dataLength: number;
  brushRange: BrushRange;
  brushGeom: BrushGeometry | null;
  brushOverlay: BrushOverlayElements | null;
  brushHover: { inside: boolean; left: boolean; right: boolean };
  seriesKeyByIndex: (string | undefined)[];
  companionIdsByKey: Map<string, string[]>;
  revealIndex: number | null;
  revealValues: Record<string, unknown[]>;
  handlers: {
    onBrushChange?: (range: { startIndex: number; endIndex: number }) => void;
    onSelectionChange?: (key: string | null) => void;
    clickableKeys: Set<string>;
    selectedDataKey: string | null;
    brushFormatLabel?: (value: string, index: number) => string;
    seriesKeys: string[];
    enableHoverHighlight: boolean;
    enableHoverReveal: boolean;
  };
  repush: () => void;
};


/**
 * Apache ECharts port of the EvilCharts line chart, exposing a compound-as-config
 * API so its JSX reads identically to the Recharts twin. The root owns the data,
 * config, selection state, loading skeleton, intro reveal, and optional zoom
 * brush; every visual part — `<Line>`, `<XAxis>`, `<YAxis>`, `<Grid>`,
 * `<Tooltip>`, `<Legend>` — is composed as a declarative child that renders
 * nothing. The root walks those children by reference and drives a single
 * imperative ECharts instance. Fully self-contained: its only dependencies are
 * `react`, `echarts`, and `motion`.
 */
export function EChartsLineChart<TData extends Record<string, unknown>>({
  data,
  config,
  xDataKey,
  className,
  curveType = "linear",
  animation = true,
  animationType = "left-to-right",
  enableHoverHighlight = false,
  enableHoverReveal = false,
  defaultSelectedDataKey = null,
  onSelectionChange,
  isLoading = false,
  loadingPoints = LOADING_DEFAULT_POINTS,
  chartOptions,
  markers,
  children,
}: EChartsLineChartProps<TData>) {
  const rawId = useId();
  const chartId = `chart-${rawId.replace(/:/g, "")}`;

  const containerRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const echartsRef = useRef<EChartsInstance | null>(null);

  const live = useRef<LiveState>({
    resolved: null,
    hoveredKey: null,
    hasRevealed: false,
    revealEndsAt: 0,
    loadingRows: null,
    categories: [],
    dataLength: 0,
    brushRange: { start: 0, end: 100 },
    brushGeom: null,
    brushOverlay: null,
    brushHover: { inside: false, left: false, right: false },
    seriesKeyByIndex: [],
    companionIdsByKey: new Map(),
    revealIndex: null,
    revealValues: {},
    handlers: {
      onBrushChange: undefined,
      onSelectionChange,
      clickableKeys: new Set<string>(),
      selectedDataKey: defaultSelectedDataKey,
      brushFormatLabel: undefined,
      seriesKeys: [],
      enableHoverHighlight,
      enableHoverReveal,
    },
    repush: () => {},
  }).current;

  const loadingData = useCallback(
    () => (live.loadingRows ??= getLoadingData(loadingPoints)),
    [live, loadingPoints]
  );
  const shouldReduceMotion = useReducedMotion();

  const [selectedDataKey, setSelectedDataKey] = useState<string | null>(
    defaultSelectedDataKey
  );

  const [hoveredDataKey, setHoveredDataKey] = useState<string | null>(null);

  const locale = useLocale();
  const collected = useMemo(
    () => withLocaleValueAxis(withLocaleTooltip(collectConfig(children), locale), locale),
    [children, locale]
  );
  const {
    lines,
    xAxis: xAxisSlot,
    yAxis: yAxisSlot,
    showGrid,
    tooltip: tooltipSlot,
    legend: legendSlot,
    brush: brushSlot,
  } = collected;
  const showBrush = brushSlot.present;
  const brushHeight = brushSlot.height ?? 56;

  const seriesKeys = useMemo(() => lines.map((line) => line.dataKey), [lines]);

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

  const effectiveAnimation = lines[0]?.animationType ?? animationType;

  const css = useMemo(() => buildChartCss(chartId, config), [chartId, config]);

  const hasSelection = selectedDataKey !== null;

  const clickableKeys = useMemo(
    () =>
      new Set(
        lines.filter((line) => line.isClickable).map((line) => line.dataKey)
      ),
    [lines]
  );

  useLayoutEffect(() => {
    live.handlers = {
      onBrushChange: brushSlot.onChange,
      onSelectionChange,
      clickableKeys,
      selectedDataKey,
      brushFormatLabel: brushSlot.formatLabel,
      seriesKeys,
      enableHoverHighlight,
      enableHoverReveal,
    };
    live.dataLength = data.length;
  });

  const toggleSelection = useCallback(
    (key: string) => {
      if (live.hoveredKey !== null) {
        const chart = echartsRef.current;
        const companions = chart
          ? live.companionIdsByKey.get(live.hoveredKey)
          : undefined;
        if (chart && companions) {
          for (const seriesId of companions)
            chart.dispatchAction({ type: "downplay", seriesId });
        }
        live.hoveredKey = null;
        setHoveredDataKey(null);
      }
      const next = live.handlers.selectedDataKey === key ? null : key;
      live.handlers.selectedDataKey = next;
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
      lines,
      curveType,
      selectedDataKey,
      hasSelection,
      showGrid,
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
      revealIndex: live.revealIndex,
      revealSink,
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
    };

    const { grid, brushBottom } = buildChartLayout(ctx);
    live.brushGeom = showBrush
      ? { bottom: brushBottom, height: brushHeight }
      : null;

    const { xAxis, yAxis } = buildMainAxes(ctx);

    if (isLoading) return buildLoadingOption(ctx, { grid, xAxis, yAxis });

    const brush = showBrush ? buildBrushOption(ctx, brushBottom) : null;

    const series = [...buildLineSeries(ctx), ...(brush?.miniSeries ?? [])];
    if (enableHoverReveal) live.revealValues = revealSink;
    live.seriesKeyByIndex = series.map((s) => {
      const id = String(s.id ?? "");
      return id && !id.startsWith("__") ? id : undefined;
    });
    const companionIdsByKey = new Map<string, string[]>();
    for (const line of lines) {
      const ids: string[] = [];
      if (line.glowing) {
        for (let i = 0; i < GLOW_LAYERS.length; i++)
          ids.push(`__glow-${i}-${line.dataKey}`);
      }
      if (line.enableBufferLine && data.length >= 2)
        ids.push(`${BUFFER_PREFIX}${line.dataKey}`);
      if (enableHoverReveal) ids.push(`${REVEAL_PREFIX}${line.dataKey}`);
      if (ids.length) companionIdsByKey.set(line.dataKey, ids);
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
    lines,
    xCategoryKey,
    curveType,
    selectedDataKey,
    hasSelection,
    showGrid,
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

    const chart = echarts.init(mount);
    echartsRef.current = chart;

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

    chart.on("click", (params) => {
      const { clickableKeys: clickable } = live.handlers;
      const p = params as { seriesId?: string; seriesIndex?: number };
      // Symbol clicks carry seriesId; line clicks (triggerEvent) only carry
      // seriesIndex — recover the key from the last build's index map, which
      // accounts for the extra `__buffer-`/`__mini-` series interleaved between
      // the main ones (a raw seriesKeys lookup would land on the wrong key).
      const id =
        p.seriesId ??
        (typeof p.seriesIndex === "number"
          ? live.seriesKeyByIndex[p.seriesIndex]
          : undefined);
      if (typeof id === "string" && clickable.has(id)) toggleSelection(id);
    });

    chart.on("mouseover", (params) => {
      const { enableHoverHighlight: hoverOn, enableHoverReveal: revealOn } =
        live.handlers;
      if (!hoverOn || revealOn) return;
      if (live.handlers.selectedDataKey !== null) return;
      const p = params as {
        seriesId?: string;
        seriesIndex?: number;
        componentType?: string;
      };
      if (p.componentType !== "series") return;
      const id =
        p.seriesId ??
        (typeof p.seriesIndex === "number"
          ? live.seriesKeyByIndex[p.seriesIndex]
          : undefined);
      if (typeof id !== "string" || id.startsWith("__")) return;
      live.hoveredKey = id;
      setHoveredDataKey(id);
      const companions = live.companionIdsByKey.get(id);
      if (companions) {
        for (const seriesId of companions)
          chart.dispatchAction({ type: "highlight", seriesId });
      }
    });
    chart.on("mouseout", () => {
      const prev = live.hoveredKey;
      if (prev === null) return;
      live.hoveredKey = null;
      setHoveredDataKey(null);
      const companions = live.companionIdsByKey.get(prev);
      if (companions) {
        for (const seriesId of companions)
          chart.dispatchAction({ type: "downplay", seriesId });
      }
    });

    const zrReveal = chart.getZr();
    const pushReveal = (idx: number | null) => {
      const keys = live.handlers.seriesKeys;
      const on = idx !== null;
      chart.setOption(
        {
          series: keys.flatMap((key) => [
            {
              id: key,
              data: on
                ? sliceToNull(live.revealValues[key] ?? [], idx)
                : (live.revealValues[key] ?? []),
            },
            {
              id: `${REVEAL_PREFIX}${key}`,
              data: on
                ? sliceFrom(live.revealValues[key] ?? [], idx)
                : (live.revealValues[key] ?? []),
              lineStyle: { opacity: on ? 0.3 : 0 },
            },
          ]),
        },
        { silent: true }
      );
      for (const key of keys) {
        chart.dispatchAction(
          on
            ? { type: "highlight", seriesId: key, dataIndex: idx as number }
            : { type: "downplay", seriesId: key }
        );
      }
    };
    const clearReveal = () => {
      if (live.revealIndex === null) return;
      live.revealIndex = null;
      pushReveal(null);
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
    const onZrRevealMove = (event: { offsetX?: number; offsetY?: number }) => {
      if (!live.handlers.enableHoverReveal) return;
      applyReveal(event);
    };
    const onZrRevealOut = () => {
      if (live.handlers.enableHoverReveal) clearReveal();
    };
    zrReveal.on("mousemove", onZrRevealMove);
    zrReveal.on("globalout", onZrRevealOut);

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
      zrReveal.off("mousemove", onZrRevealMove);
      zrReveal.off("globalout", onZrRevealOut);
      zr.off("mousemove", onZrMove);
      zr.off("globalout", onZrOut);
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
  }, []);

  useEffect(() => {
    const chart = echartsRef.current;
    const container = containerRef.current;
    if (!chart || !container) return;

    live.resolved = resolveColors(container, config, seriesKeys);

    const push = (withEntrance: boolean) => {
      const option = buildOption();
      const merged = chartOptions ? { ...option, ...chartOptions } : option;
      applyChartMarkers(
        merged,
        markers,
        live.resolved?.tokens.foreground ?? "rgba(60, 60, 60, 1)",
        live.resolved?.tokens.background ?? "rgba(255, 255, 255, 1)"
      );
      Object.assign(merged, {
        animation: true,
        animationDuration: withEntrance ? REVEAL_DURATION : 0,
        animationDurationUpdate: 0,
      });
      chart.setOption(merged as EChartsOption, { notMerge: true });
      keepTooltipContentMounted(chart);
      syncBrushOverlayNow();
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
    syncBrushOverlayNow,
  ]);

  useEffect(() => {
    const chart = echartsRef.current;
    if (!chart || isLoading) return;
    const animatedKeys = lines
      .filter(
        (line) =>
          line.strokeVariant === "animated-dashed" && !line.enableBufferLine
      )
      .map((line) => line.dataKey);
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
  }, [live, lines, hasSelection, isLoading]);

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
            },
          ],
        },
        { silent: true, lazyUpdate: true }
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [live, isLoading, loadingPoints, loadingData]);

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

EChartsLineChart.Line = Line;
EChartsLineChart.Dot = Dot;
EChartsLineChart.ActiveDot = ActiveDot;
EChartsLineChart.XAxis = XAxis;
EChartsLineChart.YAxis = YAxis;
EChartsLineChart.Grid = Grid;
EChartsLineChart.Tooltip = Tooltip;
EChartsLineChart.Legend = Legend;
EChartsLineChart.Brush = Brush;
