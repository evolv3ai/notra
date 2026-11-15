"use client";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "@notra/ui/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { SiteChartTooltip } from "@/components/sites/site-chart-tooltip";
import {
  SITE_CHART_HEIGHT_CLASS,
  SITE_TRAFFIC_CONFIG,
} from "@/constants/site-charts";
import type { SiteTrafficChartProps } from "@/types/sites";
import { formatChartDay } from "@/utils/site-charts";

export function SiteTrafficChart({ points }: SiteTrafficChartProps) {
  return (
    <ChartContainer
      className={SITE_CHART_HEIGHT_CLASS}
      config={SITE_TRAFFIC_CONFIG}
    >
      <AreaChart accessibilityLayer data={points}>
        <defs>
          <linearGradient
            id="site-traffic-visitors"
            x1="0"
            x2="0"
            y1="0"
            y2="1"
          >
            <stop
              offset="5%"
              stopColor="var(--color-visitors)"
              stopOpacity={0.3}
            />
            <stop
              offset="95%"
              stopColor="var(--color-visitors)"
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="day"
          minTickGap={24}
          tickFormatter={formatChartDay}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          allowDecimals={false}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <ChartTooltip
          content={<SiteChartTooltip config={SITE_TRAFFIC_CONFIG} />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          dataKey="views"
          fill="none"
          stroke="var(--color-views)"
          strokeDasharray="4 4"
          strokeWidth={1.5}
          type="monotone"
        />
        <Area
          dataKey="visitors"
          fill="url(#site-traffic-visitors)"
          stroke="var(--color-visitors)"
          strokeWidth={2}
          type="monotone"
        />
      </AreaChart>
    </ChartContainer>
  );
}
