"use client";

import { PieChart, type PieSeriesOption } from "echarts/charts";
import {
  TooltipComponent,
  type TooltipComponentOption,
} from "echarts/components";
import type { ComposeOption } from "echarts/core";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useLocale } from "use-intl";
import { useReducedMotion } from "motion/react";
import {
  Children,
  type CSSProperties,
  type FC,
  isValidElement,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { withLocaleTooltip } from "@/utils/chart-locale";
import { EChartsPlotFrame } from "@/components/charts/echarts-plot-frame";
import {
  buildChartCss,
  getColorsCount,
  type ResolvedColors,
  resolveColors,
  withAlpha,
} from "@/components/evilcharts/ui/echarts-chart";
import {
  LegendOverlay,
  type LegendVariant,
} from "@/components/evilcharts/ui/echarts-legend";
import {
  type TooltipPosition,
  type TooltipRoundness,
  type TooltipVariant,
  composeTooltipBody,
  configIndicatorHtml,
  formatTooltipValue,
  resolveTooltipPosition,
  tooltipShell,
} from "@/components/evilcharts/ui/echarts-tooltip";
import {
  keepTooltipContentMounted,
  withTooltipSizeMotion,
} from "@/utils/chart-tooltip-size";
import type {
  ChartConfig,
  TooltipBodyItem,
  TooltipLayout,
  TooltipValueFormatter,
} from "@/types/charts";
import { observeChartResize } from "@/components/evilcharts/ui/echarts-resize";

echarts.use([PieChart, TooltipComponent, CanvasRenderer]);

type EChartsInstance = ReturnType<typeof echarts.init>;

type EChartsOption = ComposeOption<PieSeriesOption | TooltipComponentOption>;

type PieItemStyle = {
  color: string | echarts.graphic.LinearGradient;
  opacity: number;
  borderRadius: number;
  borderColor?: string;
  borderWidth?: number;
};


const REVEAL_DURATION = 1000;
const LOADING_ANIMATION_DURATION = 2000;
const LOADING_SECTORS = 5;

const DEFAULT_INNER_RADIUS: number | string = 0;
const DEFAULT_OUTER_RADIUS: number | string = "80%";
const DEFAULT_CORNER_RADIUS = 0;
const DEFAULT_PADDING_ANGLE = 0;
const DEFAULT_START_ANGLE = 0;
const DEFAULT_END_ANGLE = 360;

const FALLBACK_COLOR = "rgba(120, 120, 120, 1)";

const OVERLAP_BORDER_WIDTH = 5;

const SELECTED_OFFSET = 12;

const DIMMED_OPACITY = 0.15;

function sectorBorder(
  paddingAngle: number,
  background: string
): { borderColor: string; borderWidth: number } | null {
  if (paddingAngle < 0)
    return { borderColor: background, borderWidth: OVERLAP_BORDER_WIDTH };
  return null;
}

const LOADING_BASE_OPACITY = 0.15;
const LOADING_PEAK_OPACITY = 0.5;
const LOADING_SHIMMER_BAND = 0.28;
const LOADING_SHIMMER_FEATHER = 0.22;


export type PieVariant = "gradient";
export type LabelPosition = "inside" | "outside";
export type BackgroundVariant =
  | "dots"
  | "grid"
  | "cross-hatch"
  | "diagonal-lines"
  | "plus"
  | "falling-triangles"
  | "4-pointed-star"
  | "tiny-checkers"
  | "overlapping-circles"
  | "wiggle-lines"
  | "bubbles";

export interface EChartsPieChartProps<TData extends Record<string, unknown>> {
  data: TData[]; // rows rendered by the chart — one sector each
  config: ChartConfig; // sector colors + labels, keyed by the sector name
  dataKey: keyof TData & string; // key holding each sector's numeric value
  nameKey: keyof TData & string; // key holding each sector's name
  className?: string; // extra classes for the chart container
  // Master switch for the intro draw-in. Not present on the Recharts twin (which
  // hardcodes its animation); added here as the canvas off-switch, mirroring the
  // ECharts area chart's `animation` prop. OS reduce-motion also disables it.
  animation?: boolean;
  defaultSelectedSector?: string | null; // sector selected on first render
  selectedSector?: string | null; // controlled selection — overrides internal state when set
  onSelectionChange?: (
    selection: { dataKey: string; value: number } | null
  ) => void; // fires when the selected sector changes
  isLoading?: boolean; // shows the animated loading skeleton
  chartOptions?: Record<string, unknown>; // escape hatch merged over the built ECharts option
  children?: ReactNode; // declarative config — <Pie>, <Tooltip>, <Legend>, <Background>
}


export interface PieProps {
  variant?: PieVariant; // fill style for the pie's sectors
  innerRadius?: number | string; // inner radius — set above 0 for a donut
  outerRadius?: number | string; // outer radius of the pie
  cornerRadius?: number; // border-radius of each sector in pixels
  paddingAngle?: number; // gap between sectors in degrees — negative overlaps them
  startAngle?: number; // angle the pie starts drawing from
  endAngle?: number; // angle the pie stops drawing at
  isClickable?: boolean; // lets sectors be selected by clicking them — the selected sector pops outward
  children?: ReactNode; // optional <Label> composition for sector labels
}

/**
 * The pie series. Declares its own shape (radii, angles, corner rounding,
 * padding) and clickability. Renders nothing — the root reads these props to
 * build the ECharts pie. When clickable, the selected sector pops radially
 * outward. Compose a <Label> inside it to draw labels on each sector.
 */
const Pie: FC<PieProps> = () => null;

export interface LabelProps {
  dataKey?: string; // data key for the label text — defaults to the pie's value key
  position?: LabelPosition; // "inside" (value on the sector) or "outside" (name past the rim, with a leader line)
}

const Label: FC<LabelProps> = () => null;

export interface TooltipProps {
  variant?: TooltipVariant; // visual style of the tooltip surface
  roundness?: TooltipRoundness; // border-radius of the tooltip
  defaultIndex?: number; // sector index shown by default with no hover
  position?: TooltipPosition; // "variable" follows the pointer (default); "fixed" pins the tooltip near the top and tracks the pointer's X
  layout?: TooltipLayout; // "rows" is a single slice; "bars" ranks every slice as a mini bar chart
  valueFormatter?: TooltipValueFormatter;
  barMax?: number; // bar layout: scale tracks to this ceiling; omit to scale to the largest slice
}

const Tooltip: FC<TooltipProps> = () => null;

export interface LegendProps {
  variant?: LegendVariant; // visual style of the legend indicators
  align?: "left" | "center" | "right"; // horizontal placement
  verticalAlign?: "top" | "middle" | "bottom"; // vertical placement
  isClickable?: boolean; // lets each entry toggle selection of its sector
}

const Legend: FC<LegendProps> = () => null;

export interface BackgroundProps {
  variant?: BackgroundVariant; // background pattern style
}

const Background: FC<BackgroundProps> = () => null;


type PieSlot = {
  variant: PieVariant;
  innerRadius: number | string;
  outerRadius: number | string;
  cornerRadius: number;
  paddingAngle: number;
  startAngle: number;
  endAngle: number;
  isClickable: boolean;
  labelDataKey: string | null;
  labelPosition: LabelPosition;
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
};
type LegendSlot = {
  present: boolean;
  variant: LegendVariant;
  align: "left" | "center" | "right";
  verticalAlign: "top" | "middle" | "bottom";
  isClickable: boolean;
};
type BackgroundSlot = { present: boolean; variant: BackgroundVariant };

type CollectedConfig = {
  pie: PieSlot | null;
  tooltip: TooltipSlot;
  legend: LegendSlot;
  background: BackgroundSlot;
};

function collectConfig(children: ReactNode): CollectedConfig {
  let pie: PieSlot | null = null;
  let tooltip: TooltipSlot = {
    present: false,
    variant: "default",
    roundness: "lg",
    position: "variable",
    layout: "rows",
  };
  let legend: LegendSlot = {
    present: false,
    variant: "rounded-square",
    align: "center",
    verticalAlign: "bottom",
    isClickable: false,
  };
  let background: BackgroundSlot = { present: false, variant: "dots" };

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const type = child.type;

    if (type === Pie) {
      const props = child.props as PieProps;
      let labelDataKey: string | null = null;
      let labelPosition: LabelPosition = "inside";
      Children.forEach(props.children, (labelChild) => {
        if (!isValidElement(labelChild) || labelChild.type !== Label) return;
        const labelProps = labelChild.props as LabelProps;
        labelDataKey = labelProps.dataKey ?? "";
        labelPosition = labelProps.position ?? "inside";
      });
      pie = {
        variant: props.variant ?? "gradient",
        innerRadius: props.innerRadius ?? DEFAULT_INNER_RADIUS,
        outerRadius: props.outerRadius ?? DEFAULT_OUTER_RADIUS,
        cornerRadius: props.cornerRadius ?? DEFAULT_CORNER_RADIUS,
        paddingAngle: props.paddingAngle ?? DEFAULT_PADDING_ANGLE,
        startAngle: props.startAngle ?? DEFAULT_START_ANGLE,
        endAngle: props.endAngle ?? DEFAULT_END_ANGLE,
        isClickable: props.isClickable ?? false,
        labelDataKey,
        labelPosition,
      };
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
      };
    } else if (type === Legend) {
      const props = child.props as LegendProps;
      legend = {
        present: true,
        variant: props.variant ?? "rounded-square",
        align: props.align ?? "center",
        verticalAlign: props.verticalAlign ?? "bottom",
        isClickable: props.isClickable ?? false,
      };
    } else if (type === Background) {
      const props = child.props as BackgroundProps;
      background = { present: true, variant: props.variant ?? "dots" };
    }
  });

  return { pie, tooltip, legend, background };
}



function sectorPaint(slots: string[]): string | echarts.graphic.LinearGradient {
  if (slots.length <= 1) return slots[0] ?? FALLBACK_COLOR;
  const stops = slots.map((color, i) => ({
    offset: i / (slots.length - 1),
    color,
  }));
  return new echarts.graphic.LinearGradient(0, 0, 1, 1, stops);
}


function loadingSectorAlpha(pos: number, center: number): number {
  const raw = Math.abs(pos - center);
  const dist = Math.min(raw, 1 - raw);
  const half = LOADING_SHIMMER_BAND;
  const feather = LOADING_SHIMMER_FEATHER;

  if (dist >= half) return LOADING_BASE_OPACITY;
  if (dist <= half - feather) return LOADING_PEAK_OPACITY;
  const t = 1 - (dist - (half - feather)) / feather;
  const eased = Math.sin((t * Math.PI) / 2);
  return (
    LOADING_BASE_OPACITY + (LOADING_PEAK_OPACITY - LOADING_BASE_OPACITY) * eased
  );
}



type PatternProps = { id: string };

const BACKGROUND_PATTERNS: Record<BackgroundVariant, FC<PatternProps>> = {
  dots: ({ id }) => (
    <pattern
      height="20"
      id={id}
      patternUnits="userSpaceOnUse"
      width="20"
      x="0"
      y="0"
    >
      <circle className="text-border" cx="2" cy="2" fill="currentColor" r="1" />
    </pattern>
  ),
  grid: ({ id }) => (
    <pattern
      height="20"
      id={id}
      patternUnits="userSpaceOnUse"
      width="20"
      x="0"
      y="0"
    >
      <path
        className="text-border"
        d="M 20 0 L 0 0 0 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
      />
    </pattern>
  ),
  "cross-hatch": ({ id }) => (
    <pattern
      height="20"
      id={id}
      patternUnits="userSpaceOnUse"
      width="20"
      x="0"
      y="0"
    >
      <path
        className="text-border/60 dark:text-border/50"
        d="M 0 0 L 20 20 M 20 0 L 0 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
      />
    </pattern>
  ),
  "diagonal-lines": ({ id }) => (
    <pattern
      height="6"
      id={id}
      patternTransform="rotate(45)"
      patternUnits="userSpaceOnUse"
      width="6"
      x="0"
      y="0"
    >
      <line
        className="text-border"
        stroke="currentColor"
        strokeWidth="0.5"
        x1="0"
        x2="0"
        y1="0"
        y2="6"
      />
    </pattern>
  ),
  plus: ({ id }) => (
    <pattern
      height="16"
      id={id}
      patternUnits="userSpaceOnUse"
      width="16"
      x="0"
      y="0"
    >
      <path
        className="text-border"
        d="M 8 4 L 8 12 M 4 8 L 12 8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="0.5"
      />
    </pattern>
  ),
  "falling-triangles": ({ id }) => (
    <pattern
      height="36"
      id={id}
      patternUnits="userSpaceOnUse"
      width="18"
      x="0"
      y="0"
    >
      <path
        className="text-border"
        d="M2 6h12L8 18 2 6zm18 36h12l-6 12-6-12z"
        fill="currentColor"
        fillOpacity="0.4"
        transform="scale(0.5)"
      />
    </pattern>
  ),
  "4-pointed-star": ({ id }) => (
    <pattern
      height="16"
      id={id}
      patternUnits="userSpaceOnUse"
      width="16"
      x="0"
      y="0"
    >
      <polygon
        className="text-border"
        fill="currentColor"
        fillOpacity="0.4"
        fillRule="evenodd"
        points="5 3 8 4 5 5 4 8 3 5 0 4 3 3 4 0 5 3"
      />
    </pattern>
  ),
  "tiny-checkers": ({ id }) => (
    <pattern
      height="8"
      id={id}
      patternUnits="userSpaceOnUse"
      width="8"
      x="0"
      y="0"
    >
      <path
        className="text-border"
        d="M0 0h4v4H0V0zm4 4h4v4H4V4z"
        fill="currentColor"
        fillOpacity="0.2"
        fillRule="evenodd"
      />
    </pattern>
  ),
  "overlapping-circles": ({ id }) => (
    <pattern
      height="40"
      id={id}
      patternUnits="userSpaceOnUse"
      width="40"
      x="0"
      y="0"
    >
      <path
        className="text-border"
        d="M25 25c0-2.762 2.238-5 5-5s5 2.238 5 5-2.238 5-5 5c0 2.762-2.238 5-5 5s-5-2.238-5-5 2.238-5 5-5zM5 5c0-2.762 2.238-5 5-5s5 2.238 5 5-2.238 5-5 5c0 2.762-2.238 5-5 5S0 12.762 0 10s2.238-5 5-5zm5 4c2.209 0 4-1.791 4-4s-1.791-4-4-4-4 1.791-4 4 1.791 4 4 4zm20 20c2.209 0 4-1.791 4-4s-1.791-4-4-4-4 1.791-4 4 1.791 4 4 4z"
        fill="currentColor"
        fillOpacity="0.4"
        fillRule="evenodd"
      />
    </pattern>
  ),
  "wiggle-lines": ({ id }) => (
    <pattern
      height="26"
      id={id}
      patternTransform="scale(0.6)"
      patternUnits="userSpaceOnUse"
      width="52"
      x="0"
      y="0"
    >
      <path
        className="text-border"
        d="M10 10c0-2.21-1.79-4-4-4-3.314 0-6-2.686-6-6h2c0 2.21 1.79 4 4 4 3.314 0 6 2.686 6 6 0 2.21 1.79 4 4 4 3.314 0 6 2.686 6 6 0 2.21 1.79 4 4 4 3.314 0 6 2.686 6 6 0 2.21 1.79 4 4 4v2c-3.314 0-6-2.686-6-6 0-2.21-1.79-4-4-4-3.314 0-6-2.686-6-6zm25.464-1.95l8.486 8.486-1.414 1.414-8.486-8.486 1.414-1.414z"
        fill="currentColor"
        fillOpacity="0.4"
      />
    </pattern>
  ),
  bubbles: ({ id }) => (
    <pattern
      height="100"
      id={id}
      patternTransform="scale(0.6667)"
      patternUnits="userSpaceOnUse"
      width="100"
      x="0"
      y="0"
    >
      <path
        className="text-border"
        d="M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z"
        fill="currentColor"
        fillOpacity="0.4"
        fillRule="evenodd"
      />
    </pattern>
  ),
};

function BackgroundLayer({ variant }: { variant: BackgroundVariant }) {
  const baseId = useId().replace(/:/g, "");
  const patternId = `${baseId}-bg-${variant}`;
  const maskId = `${baseId}-bg-edge-fade`;
  const filterId = `${baseId}-bg-blur`;
  const PatternComponent = BACKGROUND_PATTERNS[variant];

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
    >
      <defs>
        <PatternComponent id={patternId} />
        <filter id={filterId}>
          <feGaussianBlur stdDeviation="25" />
        </filter>
        <mask id={maskId} maskUnits="userSpaceOnUse">
          <rect
            fill="white"
            filter={`url(#${filterId})`}
            height="60%"
            width="85%"
            x="8%"
            y="20%"
          />
        </mask>
      </defs>
      <rect
        fill={`url(#${patternId})`}
        height="100%"
        mask={`url(#${maskId})`}
        width="100%"
      />
    </svg>
  );
}


type OptionBuildContext = {
  data: Record<string, unknown>[];
  config: ChartConfig;
  nameKey: string;
  dataKey: string;
  pie: PieSlot | null;
  selectedSector: string | null;
  tooltipSlot: TooltipSlot;
  legendSlot: LegendSlot;
  isLoading: boolean;
  resolved: ResolvedColors;
};

function pieCenterY(legendSlot: LegendSlot): string {
  if (!legendSlot.present) return "50%";
  if (legendSlot.verticalAlign === "bottom") return "45%";
  if (legendSlot.verticalAlign === "top") return "55%";
  return "50%";
}

function createTooltipFormatter(ctx: OptionBuildContext) {
  const {
    config,
    selectedSector,
    tooltipSlot,
    data,
    nameKey,
    dataKey,
  } = ctx;

  return (params: unknown): string => {
    const p = (Array.isArray(params) ? params[0] : params) as {
      name?: string;
      value?: number | string;
      seriesId?: string;
    } | null;
    if (!p || String(p.seriesId ?? "").startsWith("__")) return "";

    const hoveredName = String(p.name ?? "");
    const source =
      tooltipSlot.layout === "bars"
        ? data
        : [{ [nameKey]: hoveredName, [dataKey]: p.value }];

    const items: TooltipBodyItem[] = [];
    for (const row of source) {
      const key = String(row[nameKey] ?? hoveredName);
      if (!key) continue;
      const item = config[key];
      const colorsCount = item ? getColorsCount(item) : 1;
      const labelText = typeof item?.label === "string" ? item.label : key;
      const formatted = formatTooltipValue(
        row[dataKey] ?? p.value,
        tooltipSlot.valueFormatter
      );
      if (formatted.numeric === null && formatted.text === "") continue;
      const dimmed =
        selectedSector != null && selectedSector !== key
          ? " opacity-30"
          : tooltipSlot.layout === "bars" && hoveredName !== key
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
      });
    }

    return tooltipShell({
      label: "",
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
  return {
    show: tooltipSlot.present && !isLoading,
    trigger: "item",
    confine: true,
    backgroundColor: "transparent",
    borderWidth: 0,
    padding: 0,
    extraCssText: "box-shadow:none;",
    position: resolveTooltipPosition(tooltipSlot.position),
    formatter: withTooltipSizeMotion(createTooltipFormatter(ctx)),
  };
}

function buildPieSeries(ctx: OptionBuildContext): PieSeriesOption[] {
  const {
    data,
    config,
    nameKey,
    dataKey,
    pie,
    selectedSector,
    legendSlot,
    resolved,
  } = ctx;
  if (!pie) return [];
  const { tokens } = resolved;
  const hasSelection = selectedSector !== null;
  const border = sectorBorder(pie.paddingAngle, tokens.background);

  const sectors = data.map((row) => {
    const name = String(row[nameKey]);
    const slots = resolved.series[name] ?? [FALLBACK_COLOR];
    const isSelected = pie.isClickable && selectedSector === name;
    const isDimmed = pie.isClickable && hasSelection && selectedSector !== name;

    const itemStyle: PieItemStyle = {
      color: sectorPaint(slots),
      opacity: isDimmed ? DIMMED_OPACITY : 1,
      borderRadius: pie.cornerRadius,
    };
    if (border) {
      itemStyle.borderColor = border.borderColor;
      itemStyle.borderWidth = border.borderWidth;
    }

    return {
      name,
      value: Number(row[dataKey]) || 0,
      itemStyle,
      selected: isSelected,
    };
  });

  const showLabel = pie.labelDataKey !== null;
  const isOutside = pie.labelPosition === "outside";
  const explicitKey = pie.labelDataKey ? pie.labelDataKey : null;
  const labelFormatter = (labelParams: {
    dataIndex: number;
    name?: string;
    value?: unknown;
  }) => {
    if (explicitKey)
      return String(data[labelParams.dataIndex]?.[explicitKey] ?? "");
    if (isOutside) {
      const item = config[String(labelParams.name ?? "")];
      return typeof item?.label === "string"
        ? item.label
        : String(labelParams.name ?? "");
    }
    return String(
      data[labelParams.dataIndex]?.[dataKey] ?? labelParams.value ?? ""
    );
  };

  const label = {
    show: showLabel,
    position: (isOutside ? "outside" : "inner") as "outside" | "inner",
    color: isOutside ? tokens.mutedForeground : tokens.background,
    fontSize: 12,
    fontWeight: 500,
    formatter: labelFormatter,
  };

  return [
    {
      id: "pie",
      type: "pie",
      center: ["50%", pieCenterY(legendSlot)],
      radius: [pie.innerRadius, pie.outerRadius],
      startAngle: pie.startAngle,
      endAngle: pie.endAngle,
      clockwise: false,
      padAngle: data.length > 1 ? pie.paddingAngle : 0,
      cursor: pie.isClickable ? "pointer" : "default",
      emphasis: { scale: false },
      selectedMode: pie.isClickable ? "single" : false,
      selectedOffset: SELECTED_OFFSET,
      select: { itemStyle: {} },
      label,
      labelLine: isOutside
        ? {
            show: true,
            length: 14,
            length2: 14,
            smooth: false,
            lineStyle: {
              color: withAlpha(tokens.mutedForeground, 0.45),
              width: 1,
            },
          }
        : { show: false },
      data: sectors,
    },
  ];
}

function buildLoadingOption(ctx: OptionBuildContext): EChartsOption {
  const { pie, legendSlot, resolved } = ctx;
  const { tokens } = resolved;

  const innerRadius = pie?.innerRadius ?? DEFAULT_INNER_RADIUS;
  const outerRadius = pie?.outerRadius ?? DEFAULT_OUTER_RADIUS;
  const cornerRadius = pie?.cornerRadius ?? DEFAULT_CORNER_RADIUS;
  const paddingAngle = pie?.paddingAngle ?? DEFAULT_PADDING_ANGLE;
  const startAngle = pie?.startAngle ?? DEFAULT_START_ANGLE;
  const endAngle = pie?.endAngle ?? DEFAULT_END_ANGLE;

  const border = sectorBorder(paddingAngle, tokens.background);
  const sectors = Array.from({ length: LOADING_SECTORS }, (_, i) => {
    const itemStyle: PieItemStyle = {
      color: withAlpha(tokens.foreground, LOADING_BASE_OPACITY),
      opacity: 1,
      borderRadius: cornerRadius,
    };
    if (border) {
      itemStyle.borderColor = border.borderColor;
      itemStyle.borderWidth = border.borderWidth;
    }
    return { name: `__loading-${i}`, value: 1, itemStyle };
  });

  return {
    animation: false,
    tooltip: { show: false },
    series: [
      {
        id: "__loading",
        type: "pie",
        center: ["50%", pieCenterY(legendSlot)],
        radius: [innerRadius, outerRadius],
        startAngle,
        endAngle,
        clockwise: false,
        padAngle: paddingAngle,
        silent: true,
        emphasis: { scale: false },
        label: { show: false },
        labelLine: { show: false },
        data: sectors,
      },
    ],
  };
}


type LiveState = {
  resolved: ResolvedColors | null;
  hasRevealed: boolean;
  handlers: {
    isClickable: boolean;
    selectedSector: string | null;
    selectSector: (name: string | null) => void;
  };
  repush: () => void;
};


/**
 * Apache ECharts port of the EvilCharts pie chart, exposing a compound-as-config
 * API so its JSX reads identically to the Recharts twin. The root owns the data,
 * config, selection state, loading skeleton, and intro reveal; every visual part —
 * `<Pie>`, `<Tooltip>`, `<Legend>`, `<Background>` — is composed as a declarative
 * child that renders nothing. The root walks those children by reference and
 * drives a single imperative ECharts instance. Fully self-contained: its only
 * dependencies are `react`, `echarts`, and `motion`.
 */
export function EChartsPieChart<TData extends Record<string, unknown>>({
  data,
  config,
  dataKey,
  nameKey,
  className,
  animation = true,
  defaultSelectedSector = null,
  selectedSector: selectedSectorProp,
  onSelectionChange,
  isLoading = false,
  chartOptions,
  children,
}: EChartsPieChartProps<TData>) {
  const rawId = useId();
  const chartId = `chart-${rawId.replace(/:/g, "")}`;

  const containerRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const echartsRef = useRef<EChartsInstance | null>(null);

  const live = useRef<LiveState>({
    resolved: null,
    hasRevealed: false,
    handlers: {
      isClickable: false,
      selectedSector: defaultSelectedSector,
      selectSector: () => {},
    },
    repush: () => {},
  }).current;

  const shouldReduceMotion = useReducedMotion();

  const [internalSelectedSector, setSelectedSector] = useState<string | null>(
    defaultSelectedSector
  );
  const selectedSector =
    selectedSectorProp !== undefined
      ? selectedSectorProp
      : internalSelectedSector;

  const locale = useLocale();
  const collected = useMemo(
    () => withLocaleTooltip(collectConfig(children), locale),
    [children, locale]
  );
  const {
    pie,
    tooltip: tooltipSlot,
    legend: legendSlot,
    background: backgroundSlot,
  } = collected;

  const sectorKeys = useMemo(
    () => data.map((row) => String(row[nameKey as string])),
    [data, nameKey]
  );

  const css = useMemo(() => buildChartCss(chartId, config), [chartId, config]);

  const selectSector = useCallback(
    (name: string | null) => {
      setSelectedSector(name);
      if (name === null) {
        onSelectionChange?.(null);
        return;
      }
      const item = data.find((row) => String(row[nameKey as string]) === name);
      onSelectionChange?.(
        item
          ? { dataKey: name, value: Number(item[dataKey as string]) || 0 }
          : null
      );
    },
    [data, dataKey, nameKey, onSelectionChange]
  );

  live.handlers = {
    isClickable: pie?.isClickable ?? false,
    selectedSector,
    selectSector,
  };

  const buildOption = useCallback((): EChartsOption => {
    const resolved = live.resolved;
    if (!resolved) return {};

    const ctx: OptionBuildContext = {
      data,
      config,
      nameKey: nameKey as string,
      dataKey: dataKey as string,
      pie,
      selectedSector,
      tooltipSlot,
      legendSlot,
      isLoading,
      resolved,
    };

    if (isLoading) return buildLoadingOption(ctx);

    return {
      animation: false,
      tooltip: buildTooltipOption(ctx),
      series: buildPieSeries(ctx),
    };
  }, [
    live,
    data,
    config,
    nameKey,
    dataKey,
    pie,
    selectedSector,
    tooltipSlot,
    legendSlot,
    isLoading,
  ]);

  useEffect(() => {
    const mount = mountRef.current;
    const container = containerRef.current;
    if (!mount || !container) return;

    const chart = echarts.init(mount);
    echartsRef.current = chart;

    const stopResizeObserver = observeChartResize(mount, chart);

    const themeObserver = new MutationObserver(() => {
      live.repush();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    chart.on("click", (params) => {
      const {
        isClickable,
        selectedSector: selected,
        selectSector: select,
      } = live.handlers;
      if (!isClickable) return;
      const p = params as { name?: string; seriesId?: string };
      if (String(p.seriesId ?? "").startsWith("__")) return;
      const name = p.name;
      if (typeof name !== "string") return;
      select(selected === name ? null : name);
    });

    return () => {
      stopResizeObserver();
      themeObserver.disconnect();
      chart.dispose();
      echartsRef.current = null;
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

    live.resolved = resolveColors(container, config, sectorKeys);

    const push = (withEntrance: boolean) => {
      const option = buildOption();
      const merged = chartOptions ? { ...option, ...chartOptions } : option;
      Object.assign(merged, {
        animation: withEntrance,
        animationDuration: REVEAL_DURATION,
        animationDurationUpdate: 0,
      });
      chart.setOption(merged as EChartsOption, { notMerge: true });
      keepTooltipContentMounted(chart);
    };

    if (isLoading) live.hasRevealed = false;
    const shouldReveal = !live.hasRevealed && !isLoading;
    if (shouldReveal) live.hasRevealed = true;
    const revealEnabled = animation && shouldReveal && !shouldReduceMotion;
    push(revealEnabled);

    live.repush = () => {
      live.resolved = resolveColors(container, config, sectorKeys);
      push(false);
    };
  }, [
    live,
    buildOption,
    chartOptions,
    isLoading,
    animation,
    shouldReduceMotion,
    config,
    sectorKeys,
  ]);

  useEffect(() => {
    const chart = echartsRef.current;
    if (
      !chart ||
      isLoading ||
      !tooltipSlot.present ||
      tooltipSlot.defaultIndex == null
    )
      return;
    const raf = requestAnimationFrame(() => {
      chart.dispatchAction({
        type: "showTip",
        seriesIndex: 0,
        dataIndex: tooltipSlot.defaultIndex,
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [isLoading, tooltipSlot.present, tooltipSlot.defaultIndex]);

  useEffect(() => {
    const chart = echartsRef.current;
    if (!chart || !isLoading) return;

    const cornerRadius = pie?.cornerRadius ?? DEFAULT_CORNER_RADIUS;
    const paddingAngle = pie?.paddingAngle ?? DEFAULT_PADDING_ANGLE;

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const phase =
        ((((now - start) / LOADING_ANIMATION_DURATION) % 1) + 1) % 1;
      const foreground = live.resolved?.tokens.foreground ?? FALLBACK_COLOR;
      const background = live.resolved?.tokens.background ?? FALLBACK_COLOR;

      const border = sectorBorder(paddingAngle, background);
      const sectors = Array.from({ length: LOADING_SECTORS }, (_, i) => {
        const pos = (i + 0.5) / LOADING_SECTORS;
        const itemStyle: PieItemStyle = {
          color: withAlpha(foreground, loadingSectorAlpha(pos, phase)),
          opacity: 1,
          borderRadius: cornerRadius,
        };
        if (border) {
          itemStyle.borderColor = border.borderColor;
          itemStyle.borderWidth = border.borderWidth;
        }
        return { value: 1, itemStyle };
      });

      chart.setOption(
        { series: [{ id: "__loading", data: sectors }] },
        { silent: true, lazyUpdate: true }
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [live, isLoading, pie]);

  const legendStyle: CSSProperties = {
    position: "absolute",
    left: 16,
    right: 16,
    pointerEvents: "auto",
    ...(legendSlot.verticalAlign === "top"
      ? { top: 12 }
      : legendSlot.verticalAlign === "bottom"
        ? { bottom: 12 }
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
      plotBefore={
        backgroundSlot.present && !isLoading ? (
          <BackgroundLayer variant={backgroundSlot.variant} />
        ) : null
      }
    >
      {legendSlot.present && !isLoading ? (
        <LegendOverlay
          align={legendSlot.align}
          config={config}
          hoveredKey={null}
          isClickable={legendSlot.isClickable}
          onToggle={(key) => selectSector(selectedSector === key ? null : key)}
          selectedKey={selectedSector}
          seriesKeys={sectorKeys}
          style={legendStyle}
          variant={legendSlot.variant}
          verticalAlign={legendSlot.verticalAlign}
        />
      ) : null}
    </EChartsPlotFrame>
  );
}

EChartsPieChart.Pie = Pie;
EChartsPieChart.Label = Label;
EChartsPieChart.Tooltip = Tooltip;
EChartsPieChart.Legend = Legend;
EChartsPieChart.Background = Background;
