"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@notra/ui/components/ui/badge";
import { cn } from "@notra/ui/lib/utils";

import type { StatusBadgeProps } from "@notra/ui/types/status-badge";

export function StatusBadge({ label, appearance }: StatusBadgeProps) {
  return (
    <Badge shape="rounded" size="md" variant={appearance.variant}>
      {appearance.icon && appearance.square ? (
        <span
          aria-hidden="true"
          className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-xs bg-current"
        >
          <HugeiconsIcon
            className="text-background size-3"
            icon={appearance.icon}
            strokeWidth={2}
          />
        </span>
      ) : null}
      {appearance.icon && !appearance.square ? (
        <HugeiconsIcon
          aria-hidden="true"
          className={cn(appearance.spin && "motion-safe:animate-spin")}
          icon={appearance.icon}
          strokeWidth={1.5}
        />
      ) : null}
      {label}
    </Badge>
  );
}
