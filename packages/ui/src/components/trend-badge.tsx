"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { HugeiconsIcon } from "@hugeicons/react";
import { badgeVariants } from "@notra/ui/components/ui/badge";
import {
  TREND_BADGE_APPEARANCES,
  TREND_BADGE_PLAIN_SIZE_CLASSES,
} from "@notra/ui/constants/trend-badge";
import { cn } from "@notra/ui/lib/utils";
import type { TrendBadgeProps } from "@notra/ui/types/trend-badge";

export function TrendBadge({
  tone,
  showIcon = true,
  children,
  className,
  size = "default",
  shape = "rounded",
  appearance = "badge",
  render,
  ...props
}: TrendBadgeProps) {
  const config = TREND_BADGE_APPEARANCES[tone];
  return useRender({
    defaultTagName: "span",
    render,
    props: mergeProps<"span">(
      {
        className: cn(
          "tabular-nums",
          appearance === "plain"
            ? cn(
                "inline-flex shrink-0 items-center font-medium",
                TREND_BADGE_PLAIN_SIZE_CLASSES[size ?? "default"],
                config.foreground
              )
            : badgeVariants({ size, shape, variant: config.variant }),
          className
        ),
        children: (
          <>
            {showIcon ? (
              <HugeiconsIcon aria-hidden="true" icon={config.icon} strokeWidth={2} />
            ) : null}
            {children}
          </>
        ),
      },
      props
    ),
    state: { appearance, size, shape, slot: "badge", variant: config.variant },
  });
}
