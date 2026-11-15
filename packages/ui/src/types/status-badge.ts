import type { IconSvgElement } from "@hugeicons/react";
import type { Badge } from "@notra/ui/components/ui/badge";
import type { ComponentProps } from "react";

export interface StatusBadgeAppearance {
  variant: NonNullable<ComponentProps<typeof Badge>["variant"]>;
  icon?: IconSvgElement;
  square?: boolean;
  /** Rotates the icon, for in-progress states. */
  spin?: boolean;
}

export interface StatusBadgeProps {
  label: string;
  appearance: StatusBadgeAppearance;
}
