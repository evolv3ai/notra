import type { TooltipComponentOption } from "echarts/components";
import {
  TOOLTIP_MOVE_DURATION_S,
  TOOLTIP_MOVE_EASING,
} from "@/constants/chart-tooltip";
import {
  getColorsCount,
  indicatorBackground,
  resolvedIndicatorBackground,
  type ResolvedColors,
} from "@/components/evilcharts/ui/echarts-chart";
import type {
  ChartConfig,
  TooltipBodyGroup,
  TooltipBodyItem,
  TooltipLayout,
  TooltipValueFormatter,
} from "@/types/charts";
import {
  fixedTooltipPosition,
  overflowTooltipPosition,
} from "@/utils/chart-tooltip-position";
import { echartsDatumValue } from "@/utils/echarts-datum";
import { escapeHtml } from "@notra/utils/escape";


export type TooltipVariant = "default" | "frosted-glass";
export type TooltipRoundness = "sm" | "md" | "lg" | "xl";
export type TooltipPosition = "fixed" | "variable";
export type TooltipAxisPointer = "none" | "line" | "shadow" | "cross";

export const TOOLTIP_BAR_MOTION_STYLE = `transition:width ${TOOLTIP_MOVE_DURATION_S}s ${TOOLTIP_MOVE_EASING}`;
export const TOOLTIP_VALUE_MOTION_STYLE =
  "transition:opacity 0.24s ease,transform 0.24s ease";


export const roundnessClass: Record<TooltipRoundness, string> = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
};

export const tooltipVariantClass: Record<TooltipVariant, string> = {
  default: "bg-popover",
  "frosted-glass": "bg-popover/70 backdrop-blur-md",
};

export function tooltipIndicatorHtml(key: string, colorsCount: number): string {
  return `<div class="h-2.5 w-2.5 shrink-0 rounded-[2px]" style="background:${escapeHtml(indicatorBackground(key, colorsCount))}"></div>`;
}

export function tooltipColorSwatchHtml(color: string): string {
  return `<div class="h-2.5 w-2.5 shrink-0 rounded-[2px]" style="background:${escapeHtml(color)}"></div>`;
}

export function tooltipRow({
  indicatorHtml,
  labelText,
  valueText,
  dimmed,
}: {
  indicatorHtml: string;
  labelText: string;
  valueText: string;
  dimmed: string;
}): string {
  return `<div class="flex w-full flex-wrap items-center gap-2${dimmed}">
          ${indicatorHtml}
          <div class="flex flex-1 items-center justify-between gap-4 leading-none">
            <span class="text-muted-foreground">${escapeHtml(labelText)}</span>
            <span class="text-foreground font-mono font-medium tabular-nums">${escapeHtml(valueText)}</span>
          </div>
        </div>`;
}

const TOOLTIP_BAR_TRACK = 100;
const TOOLTIP_BAR_MIN = 2;

const TOOLTIP_BAR_TRACK_CLASS = "h-1 overflow-hidden rounded-full bg-muted";
const TOOLTIP_BAR_FILL_CLASS = "ec-tooltip-bar-fill h-full rounded-full";

export function formatTooltipValue(
  value: unknown,
  formatter?: TooltipValueFormatter
): { numeric: number | null; text: string } {
  const numeric = echartsDatumValue(value);
  if (numeric !== null) {
    return {
      numeric,
      text: formatter ? formatter(numeric) : numeric.toLocaleString(),
    };
  }
  if (value === null || value === undefined) {
    return { numeric: null, text: "" };
  }
  return { numeric: null, text: String(value) };
}

export function tooltipBarWidth(value: number, max: number): number {
  if (value <= 0 || max <= 0) {
    return 0;
  }
  return Math.min(
    TOOLTIP_BAR_TRACK,
    Math.max(
      Math.round((value / max) * TOOLTIP_BAR_TRACK),
      TOOLTIP_BAR_MIN
    )
  );
}

export function configIndicatorHtml(
  item: { indicatorHtml?: string } | undefined
): string | undefined {
  const html = item?.indicatorHtml;
  return typeof html === "string" && html.length > 0 ? html : undefined;
}

export function tooltipBarRow({
  key,
  colorsCount,
  labelText,
  valueText,
  widthPercent,
  dimmed,
  indicatorHtml,
  paint,
}: {
  key: string;
  colorsCount: number;
  labelText: string;
  valueText: string;
  widthPercent: number;
  dimmed: string;
  indicatorHtml?: string;
  paint?: string;
}): string {
  const fill = paint ?? indicatorBackground(key, colorsCount);
  const barFill = escapeHtml(fill);
  const indicator = indicatorHtml ?? tooltipColorSwatchHtml(fill);
  return `<div class="grid w-full grid-cols-[0.875rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1${dimmed}">
          <span class="flex size-3.5 items-center justify-center">${indicator}</span>
          <span class="truncate text-foreground leading-none">${escapeHtml(labelText)}</span>
          <span class="font-mono text-muted-foreground tabular-nums leading-none" style="${TOOLTIP_VALUE_MOTION_STYLE}">${escapeHtml(valueText)}</span>
          <div class="col-span-2 col-start-2 ${TOOLTIP_BAR_TRACK_CLASS}">
            <div class="${TOOLTIP_BAR_FILL_CLASS}" style="width:${widthPercent}%;background:${barFill};${TOOLTIP_BAR_MOTION_STYLE}"></div>
          </div>
        </div>`;
}

export function tooltipItemsFromRow(
  row: Record<string, unknown> | undefined,
  keys: readonly string[],
  config: ChartConfig,
  valueFormatter?: TooltipValueFormatter,
  seriesSlots?: ResolvedColors["series"],
  hideZeros = true
): TooltipBodyItem[] {
  if (!row) {
    return [];
  }
  const items: TooltipBodyItem[] = [];
  for (const key of keys) {
    const raw = row[key];
    if (
      typeof raw !== "number" ||
      !Number.isFinite(raw) ||
      (hideZeros && raw <= 0)
    ) {
      continue;
    }
    const item = config[key];
    const formatted = formatTooltipValue(raw, valueFormatter);
    const slots = seriesSlots?.[key];
    items.push({
      key,
      colorsCount: item ? getColorsCount(item) : 1,
      labelText: typeof item?.label === "string" ? item.label : key,
      value: formatted.numeric,
      valueText: formatted.text,
      dimmed: "",
      indicatorHtml: configIndicatorHtml(item),
      paint: slots ? resolvedIndicatorBackground(slots) : undefined,
    });
  }
  return items;
}

const MORE_ROW_KEY = "__more";

function compareByValueDesc(left: TooltipBodyItem, right: TooltipBodyItem): number {
  if (left.key === MORE_ROW_KEY) {
    return 1;
  }
  if (right.key === MORE_ROW_KEY) {
    return -1;
  }
  return (right.value ?? -1) - (left.value ?? -1);
}

export function capTooltipItems(
  items: TooltipBodyItem[],
  maxRows: number | undefined,
  moreLabel: (count: number) => string,
  valueFormatter?: TooltipValueFormatter
): TooltipBodyItem[] {
  if (maxRows === undefined || items.length <= maxRows + 1) {
    return items;
  }
  const ranked = items.toSorted(compareByValueDesc);
  const rest = ranked.slice(maxRows);
  const sum = rest.reduce((total, item) => total + (item.value ?? 0), 0);
  return [
    ...ranked.slice(0, maxRows),
    {
      key: MORE_ROW_KEY,
      colorsCount: 1,
      labelText: moreLabel(rest.length),
      value: sum,
      valueText: formatTooltipValue(sum, valueFormatter).text,
      dimmed: "",
      paint: "rgba(128, 128, 128, 0.45)",
    },
  ];
}

const MIN_ROWS_PER_SECTION = 3;

export function capTooltipGroups(
  groups: TooltipBodyGroup[],
  maxRows: number | undefined,
  moreLabel: (count: number) => string,
  valueFormatter?: TooltipValueFormatter
): TooltipBodyGroup[] {
  if (maxRows === undefined) {
    return groups;
  }
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  if (total <= maxRows) {
    return groups;
  }
  const rows = groups.map((group) =>
    Math.min(group.items.length, MIN_ROWS_PER_SECTION)
  );
  let spare = maxRows - rows.reduce((sum, count) => sum + count, 0);
  while (spare < 0) {
    let worst = -1;
    let worstScore = Number.POSITIVE_INFINITY;
    for (const [index, group] of groups.entries()) {
      const shown = rows[index] ?? 0;
      if (shown <= 1) {
        continue;
      }
      const score = (group.heading.value ?? 0) / shown;
      if (score < worstScore) {
        worst = index;
        worstScore = score;
      }
    }
    if (worst === -1) {
      break;
    }
    rows[worst] = (rows[worst] ?? 0) - 1;
    spare += 1;
  }
  while (spare > 0) {
    let best = -1;
    let bestScore = -1;
    for (const [index, group] of groups.entries()) {
      const shown = rows[index] ?? 0;
      if (shown >= group.items.length) {
        continue;
      }
      const score = (group.heading.value ?? 0) / Math.max(shown, 1);
      if (score > bestScore) {
        best = index;
        bestScore = score;
      }
    }
    if (best === -1) {
      break;
    }
    rows[best] = (rows[best] ?? 0) + 1;
    spare -= 1;
  }
  return groups.map((group, index) => ({
    heading: group.heading,
    items: capTooltipItems(
      group.items,
      Math.max((rows[index] ?? 0) - 1, 0),
      moreLabel,
      valueFormatter
    ),
  }));
}

export function tooltipEmptyBody(label: string): string {
  return `<span class="text-muted-foreground">${escapeHtml(label)}</span>`;
}

function tooltipActivityRow(item: TooltipBodyItem, max: number): string {
  const indicatorHtml =
    item.indicatorHtml ??
    (item.paint
      ? tooltipColorSwatchHtml(item.paint)
      : tooltipIndicatorHtml(item.key, item.colorsCount));
  const width = tooltipBarWidth(item.value ?? 0, max);
  return `<div class="relative grid h-7 grid-cols-[minmax(0,1fr)_auto] overflow-hidden rounded-md bg-muted/40${item.dimmed}">
          <span class="absolute inset-y-0 left-0 bg-foreground/[0.08]" style="width:${width}%;${TOOLTIP_BAR_MOTION_STYLE}"></span>
          <span class="relative flex min-w-0 items-center gap-2 px-2 text-foreground">${indicatorHtml}<span class="truncate">${escapeHtml(item.labelText)}</span></span>
          <span class="relative flex min-w-9 items-center justify-end px-2 font-mono text-muted-foreground tabular-nums" style="${TOOLTIP_VALUE_MOTION_STYLE}">${escapeHtml(item.valueText)}</span>
        </div>`;
}

function tooltipActivityBody(items: readonly TooltipBodyItem[]): string {
  const ranked = [...items].sort(compareByValueDesc);
  const total = ranked.reduce((sum, item) => sum + (item.value ?? 0), 0);
  return ranked.map((item) => tooltipActivityRow(item, total)).join("");
}

export function composeTooltipBody(
  items: readonly TooltipBodyItem[],
  layout: TooltipLayout,
  barMax?: number
): string {
  if (layout === "activity") {
    return tooltipActivityBody(items);
  }
  if (layout === "rows") {
    return items
      .map((item) =>
        tooltipRow({
          indicatorHtml:
            item.indicatorHtml ??
            (item.paint
              ? tooltipColorSwatchHtml(item.paint)
              : tooltipIndicatorHtml(item.key, item.colorsCount)),
          labelText: item.labelText,
          valueText: item.valueText,
          dimmed: item.dimmed,
        })
      )
      .join("");
  }

  let max = barMax ?? 0;
  if (barMax === undefined) {
    for (const item of items) {
      if (item.value !== null && item.value > max) {
        max = item.value;
      }
    }
  }

  const ranked = [...items];
  ranked.sort(compareByValueDesc);
  return ranked
    .map((item) =>
      tooltipBarRow({
        key: item.key,
        colorsCount: item.colorsCount,
        labelText: item.labelText,
        valueText: item.valueText,
        widthPercent: tooltipBarWidth(item.value ?? 0, max),
        dimmed: item.dimmed,
        indicatorHtml: item.indicatorHtml,
        paint: item.paint,
      })
    )
    .join("");
}

export function tooltipShell({
  label,
  body,
  roundness,
  variant,
  layout = "rows",
}: {
  label: string;
  body: string;
  roundness: TooltipRoundness;
  variant: TooltipVariant;
  layout?: TooltipLayout;
}): string {
  const isRows = layout === "rows";
  const header =
    label.length > 0
      ? `<div class="text-[11px] font-medium text-muted-foreground">${escapeHtml(label)}</div>`
      : "";
  const surface = isRows
    ? "gap-1.5 px-2.5 py-2"
    : "gap-2 px-3 py-2.5";
  const bodyGap =
    layout === "activity" ? "gap-1" : isRows ? "gap-1.5" : "gap-2";
  return `<div class="ec-tooltip-surface ${isRows ? "min-w-32" : "min-w-52"} overflow-hidden border border-border ${tooltipVariantClass[variant]} text-xs shadow-lift dark:shadow-md ${roundnessClass[roundness]}">
    <div class="ec-tooltip-content grid ${surface} content-start items-start">
      ${header}
      <div class="grid ${bodyGap}" style="transition:opacity 0.24s ease">${body}</div>
    </div>
    </div>`;
}

export function resolveTooltipPosition(
  position: TooltipPosition,
  confine = true
): TooltipComponentOption["position"] {
  if (position === "fixed") {
    return (point, _params, _dom, _rect, size) =>
      fixedTooltipPosition(point[0], size.contentSize[0], size.viewSize[0]);
  }
  if (confine) {
    return undefined;
  }
  return (point, _params, _dom, _rect, size) =>
    overflowTooltipPosition(
      [point[0], point[1]],
      [size.contentSize[0], size.contentSize[1]],
      [size.viewSize[0], size.viewSize[1]]
    );
}

export function tooltipBaseOption(params: {
  present: boolean;
  cursor: boolean;
  tokens: ResolvedColors["tokens"];
  position: TooltipPosition;
  axisPointerColor: string;
  strokeWidth: number;
  crosshair?: boolean;
  confine?: boolean;
  pointer?: TooltipAxisPointer;
  scrub?: boolean;
}): TooltipComponentOption {
  const {
    present,
    cursor,
    position,
    axisPointerColor,
    strokeWidth,
    crosshair,
    confine = true,
    pointer = cursor ? (crosshair ? "cross" : "line") : "none",
    scrub = false,
  } = params;

  const linePointer = {
    type: pointer === "cross" ? ("cross" as const) : ("line" as const),
    animation: false,
    label: { show: false },
    lineStyle: {
      color: axisPointerColor,
      width: strokeWidth,
      type: "solid" as const,
      shadowBlur: 0,
    },
    crossStyle: {
      color: axisPointerColor,
      width: strokeWidth,
      type: "solid" as const,
      shadowBlur: 0,
    },
  };

  const moveDuration = scrub ? 0 : TOOLTIP_MOVE_DURATION_S;
  const tooltipMotionCss = `box-shadow:none;pointer-events:none;will-change:transform;transition:transform ${moveDuration}s ${TOOLTIP_MOVE_EASING},opacity 0.28s ease;`;

  return {
    show: present,
    trigger: "axis",
    confine,
    enterable: false,
    showDelay: 0,
    hideDelay: 80,
    transitionDuration: moveDuration,
    ...(confine ? {} : { appendTo: "body" as const }),
    backgroundColor: "transparent",
    borderWidth: 0,
    padding: 0,
    extraCssText: tooltipMotionCss,
    axisPointer:
      pointer === "none"
        ? { type: "none" }
        : pointer === "shadow"
          ? {
              type: "shadow",
              shadowStyle: { color: axisPointerColor },
            }
          : linePointer,
    position: resolveTooltipPosition(position, confine),
  };
}

function tooltipIndicatorSlot(indicatorHtml: string): string {
  return `<span class="flex size-3.5 shrink-0 items-center justify-center">${indicatorHtml}</span>`;
}

export function composeTooltipSectionedRows(
  groups: readonly TooltipBodyGroup[]
): string {
  return groups
    .map((group, index) => {
      const fill =
        group.heading.paint ??
        indicatorBackground(group.heading.key, group.heading.colorsCount);
      const rowsHtml = group.items
        .toSorted(compareByValueDesc)
        .map((item) => {
          const indicatorHtml =
            item.indicatorHtml ??
            (item.paint
              ? tooltipColorSwatchHtml(item.paint)
              : tooltipIndicatorHtml(item.key, item.colorsCount));
          return `<div class="flex w-full items-center gap-2 whitespace-nowrap${item.dimmed}">
          ${tooltipIndicatorSlot(indicatorHtml)}
          <div class="flex flex-1 items-center justify-between gap-4 leading-none">
            <span class="text-muted-foreground">${escapeHtml(item.labelText)}</span>
            <span class="text-foreground/80 font-mono text-[11px] tabular-nums">${escapeHtml(item.valueText)}</span>
          </div>
        </div>`;
        })
        .join("");
      const separator =
        index > 0
          ? `<div class="border-border my-0.5 border-t" role="separator"></div>`
          : "";
      return `${separator}<div class="grid gap-1.5">
          <div class="flex items-center justify-between gap-4 leading-none">
            <span class="flex items-center gap-2 font-medium text-foreground">${tooltipIndicatorSlot(tooltipColorSwatchHtml(fill))}${escapeHtml(group.heading.labelText)}</span>
            <span class="font-mono text-[11px] font-medium text-foreground tabular-nums">${escapeHtml(group.heading.valueText)}</span>
          </div>
          ${rowsHtml}
        </div>`;
    })
    .join("");
}

export function composeTooltipGroupedBody(
  groups: readonly TooltipBodyGroup[]
): string {
  return groups
    .map((group, index) => {
      const headingValue = group.heading.value ?? 0;
      const rows = group.items.toSorted(compareByValueDesc);
      const headingHtml = tooltipGroupHeadingRow({
        key: group.heading.key,
        colorsCount: group.heading.colorsCount,
        labelText: group.heading.labelText,
        valueText: group.heading.valueText,
        paint: group.heading.paint,
      });
      const rowsHtml = rows
        .map((item) => tooltipActivityRow(item, headingValue))
        .join("");
      const separator =
        index > 0
          ? `<div class="border-border my-1 border-t" role="separator"></div>`
          : "";
      return `${separator}<div class="grid gap-1">
          ${headingHtml}
          ${rowsHtml}
        </div>`;
    })
    .join("");
}

function tooltipGroupHeadingRow({
  key,
  colorsCount,
  labelText,
  valueText,
  paint,
}: {
  key: string;
  colorsCount: number;
  labelText: string;
  valueText: string;
  paint?: string;
}): string {
  const fill = paint ?? indicatorBackground(key, colorsCount);
  return `<div class="grid h-7 grid-cols-[minmax(0,1fr)_auto] items-center">
          <span class="flex min-w-0 items-center gap-2 px-2 font-medium text-foreground">${tooltipColorSwatchHtml(fill)}<span class="truncate">${escapeHtml(labelText)}</span></span>
          <span class="flex min-w-9 items-center justify-end px-2 font-mono font-semibold text-foreground tabular-nums" style="${TOOLTIP_VALUE_MOTION_STYLE}">${escapeHtml(valueText)}</span>
        </div>`;
}
