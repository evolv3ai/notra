import type { ChartConfig } from "@notra/ui/components/ui/chart";

export const SITE_CHART_HEIGHT_CLASS = "aspect-auto h-48 w-full";

export const SITE_BUILD_ACTIVITY_CONFIG = {
  ready: {
    label: "Successful",
    theme: {
      light: "oklch(0.696 0.17 162.48)",
      dark: "oklch(0.765 0.177 163.22)",
    },
  },
  failed: {
    label: "Failed",
    theme: {
      light: "oklch(0.637 0.237 25.331)",
      dark: "oklch(0.704 0.191 22.216)",
    },
  },
  other: {
    label: "Other",
    theme: {
      light: "oklch(0.872 0.01 258.338)",
      dark: "oklch(0.446 0.03 256.802)",
    },
  },
} satisfies ChartConfig;

export const SITE_TRAFFIC_CONFIG = {
  visitors: { label: "Visitors", color: "var(--chart-1)" },
  views: { label: "Page views", color: "var(--chart-2)" },
} satisfies ChartConfig;
