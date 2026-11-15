"use client";

import { Skeleton } from "@notra/ui/components/ui/skeleton";
import dynamic from "next/dynamic";

const loadChart = () =>
  import("@/components/ai-trends/ai-trends-series-chart").then(
    (module) => module.AiTrendsSeriesChart
  );

/**
 * Recharts loads with the first chart instead of with the page bundle. The
 * placeholders match each chart's height, so nothing shifts when it lands.
 */
export const AiTrendsSeriesChart = dynamic(loadChart, {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full rounded-lg" />,
});

export const AiTrendsSparkline = dynamic(loadChart, {
  ssr: false,
  loading: () => <Skeleton className="h-24 w-full rounded-lg" />,
});
