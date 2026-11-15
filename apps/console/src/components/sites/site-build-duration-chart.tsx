"use client";

import { ChartContainer, ChartTooltip } from "@notra/ui/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  YAxis,
} from "recharts";

import {
  SITE_BUILD_ACTIVITY_CONFIG,
  SITE_CHART_HEIGHT_CLASS,
} from "@/constants/site-charts";
import { SITE_STATUS_LABELS } from "@/constants/sites";
import type {
  SiteBuildDurationChartProps,
  SiteBuildDurationTooltipProps,
} from "@/types/sites";
import { formatChartDateTime, medianBuildMs } from "@/utils/site-charts";
import {
  commitTitle,
  formatBuildDuration,
  shortSha,
} from "@/utils/site-deployments";

const MS_PER_SECOND = 1000;

function BuildTooltip({
  active,
  payload,
  showSite,
}: SiteBuildDurationTooltipProps) {
  const build = active ? payload?.[0]?.payload : undefined;
  if (!build) {
    return null;
  }
  return (
    <div className="border-border/50 bg-background grid min-w-48 gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">
          {showSite ? build.siteName : formatChartDateTime(build.createdAt)}
        </span>
        <span className="font-mono tabular-nums">
          {formatBuildDuration(build.durationMs)}
        </span>
      </div>
      <span className="text-muted-foreground max-w-64 truncate">
        {commitTitle(build.commitMessage) ?? shortSha(build.commitSha)}
      </span>
      <span className="text-muted-foreground">
        {SITE_STATUS_LABELS[build.status]}
        {showSite ? ` · ${formatChartDateTime(build.createdAt)}` : ""}
      </span>
    </div>
  );
}

export function SiteBuildDurationChart({
  builds,
  showSite,
}: SiteBuildDurationChartProps) {
  const data = builds.map((build) => ({
    ...build,
    seconds: build.durationMs / MS_PER_SECOND,
  }));
  const medianMs = medianBuildMs(builds);

  return (
    <ChartContainer
      className={SITE_CHART_HEIGHT_CLASS}
      config={SITE_BUILD_ACTIVITY_CONFIG}
    >
      <BarChart accessibilityLayer data={data} margin={{ top: 12 }}>
        <CartesianGrid vertical={false} />
        <YAxis
          axisLine={false}
          tickFormatter={(value: number) => `${value}s`}
          tickLine={false}
          width={36}
        />
        <ChartTooltip
          content={<BuildTooltip showSite={showSite} />}
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
        />
        {medianMs === null ? null : (
          <ReferenceLine
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            y={medianMs / MS_PER_SECOND}
          />
        )}
        <Bar dataKey="seconds" radius={[3, 3, 0, 0]}>
          {data.map((build) => (
            <Cell
              fill={
                build.status === "failed"
                  ? "var(--color-failed)"
                  : "var(--color-ready)"
              }
              key={build.id}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
