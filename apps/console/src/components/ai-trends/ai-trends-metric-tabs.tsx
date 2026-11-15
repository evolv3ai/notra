"use client";

import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";

import type { AiTrendsMetricTabsProps } from "@/types/ai-trends";

export function AiTrendsMetricTabs<T extends string>({
  metrics,
  value,
  onChange,
}: AiTrendsMetricTabsProps<T>) {
  return (
    <Tabs
      onValueChange={(next) => {
        const metric = metrics.find((item) => item.value === next);
        if (metric) {
          onChange(metric.value);
        }
      }}
      value={value}
    >
      <TabsList>
        {metrics.map((item) => (
          <TabsTrigger key={item.value} value={item.value}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
