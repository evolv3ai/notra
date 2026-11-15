import type { Badge } from "@notra/ui/components/ui/badge";
import type { ComponentProps } from "react";

export type TrendBadgeProps = Omit<ComponentProps<typeof Badge>, "variant"> & {
  tone: "up" | "down" | "flat";
  showIcon?: boolean;
  appearance?: "badge" | "plain";
};
