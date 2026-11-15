"use client";

import {
  ChartContainer,
  ChartLegend,
  ChartTooltip,
} from "@notra/ui/components/ui/chart";
import { cn } from "@notra/ui/lib/utils";
import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  XAxis,
  YAxis,
} from "recharts";

import { AiTrendsChartLegend } from "@/components/ai-trends/ai-trends-chart-legend";
import { AiTrendsChartTooltip } from "@/components/ai-trends/ai-trends-chart-tooltip";
import {
  AI_TRENDS_FILL_ALPHA,
  AI_TRENDS_MAX_FILLED_SERIES,
} from "@/constants/ai-trends";
import type {
  AiTrendsChartDotProps,
  AiTrendsChartEndDotProps,
  AiTrendsSeriesChartProps,
} from "@/types/ai-trends";
import { formatChartDay } from "@/utils/site-charts";

/** Ringed dot on a series' latest day, as the dashboard's area charts end. */
function ChartEndDot({ cx, cy, index, last, color }: AiTrendsChartEndDotProps) {
  if (index !== last || cx === undefined || cy === undefined) {
    return <g key={`dot-${index}`} />;
  }
  return (
    <circle
      cx={cx}
      cy={cy}
      fill={color}
      key={`dot-${index}`}
      r={3.5}
      stroke="var(--background)"
      strokeWidth={2}
    />
  );
}

/**
 * Daily series over the trends window in the dashboard's area style:
 * monotone curves, a gradient fill (fainter with several series) and a
 * ringed dot on the latest day.
 */
export function AiTrendsSeriesChart({
  rows,
  config,
  format,
  formatTick = format,
  markDay,
  logos,
  compact = false,
}: AiTrendsSeriesChartProps) {
  const gradientId = useId().replaceAll(":", "");
  const keys = Object.keys(config);
  const single = keys.length === 1;
  const filled = keys.length <= AI_TRENDS_MAX_FILLED_SERIES;
  // Overlapping fills muddy each other, so several series fill fainter.
  const fillAlpha = single ? AI_TRENDS_FILL_ALPHA : AI_TRENDS_FILL_ALPHA / 2.5;
  const lastDay = rows.at(-1)?.day;

  return (
    <ChartContainer
      className={cn("aspect-auto w-full", compact ? "h-24" : "h-64")}
      config={config}
    >
      <AreaChart
        accessibilityLayer
        data={rows}
        margin={compact ? { top: 4, right: 0, bottom: 0, left: 0 } : undefined}
      >
        {filled ? (
          <defs>
            {keys.map((key) => (
              <linearGradient
                id={`${gradientId}-${key}`}
                key={key}
                x1="0"
                x2="0"
                y1="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={`var(--color-${key})`}
                  stopOpacity={fillAlpha}
                />
                <stop
                  offset="100%"
                  stopColor={`var(--color-${key})`}
                  stopOpacity={0}
                />
              </linearGradient>
            ))}
          </defs>
        ) : null}
        {compact ? null : <CartesianGrid vertical={false} />}
        <XAxis
          axisLine={false}
          dataKey="day"
          hide={compact}
          minTickGap={32}
          tickFormatter={formatChartDay}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          axisLine={false}
          domain={[0, "auto"]}
          hide={compact}
          tickFormatter={(value: number) => formatTick(value)}
          tickLine={false}
          width={48}
        />
        <ChartTooltip
          content={
            <AiTrendsChartTooltip
              config={config}
              format={format}
              logos={logos}
            />
          }
        />
        {markDay && lastDay ? (
          <ReferenceArea
            fill="var(--chart-1)"
            fillOpacity={0.06}
            ifOverflow="hidden"
            stroke="none"
            x1={markDay}
            x2={lastDay}
          />
        ) : null}
        {single || compact ? null : (
          <ChartLegend
            content={<AiTrendsChartLegend config={config} logos={logos} />}
          />
        )}
        {keys.map((key) => (
          <Area
            activeDot={{
              r: 4,
              fill: `var(--color-${key})`,
              stroke: "var(--background)",
              strokeWidth: 2,
            }}
            dataKey={key}
            dot={({ cx, cy, index }: AiTrendsChartDotProps) => (
              <ChartEndDot
                color={`var(--color-${key})`}
                cx={cx}
                cy={cy}
                index={index}
                key={`${key}-${index}`}
                last={rows.length - 1}
              />
            )}
            fill={filled ? `url(#${gradientId}-${key})` : "none"}
            isAnimationActive={false}
            key={key}
            stroke={`var(--color-${key})`}
            strokeWidth={single ? 2 : 1.5}
            type="monotone"
          />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}
