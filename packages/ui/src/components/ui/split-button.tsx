"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@notra/ui/components/ui/button";
import { DropdownMenuTrigger } from "@notra/ui/components/ui/dropdown-menu";
import type * as React from "react";
import { cn } from "@notra/ui/lib/utils";

const TRIGGER_SIZES = {
  default: "icon",
  xs: "icon-xs",
  sm: "icon-sm",
  lg: "icon-lg",
} as const;

type SplitButtonSize = keyof typeof TRIGGER_SIZES;

// Siblings are matched by data-slot because the open menu inserts unslotted
// focus guards next to the trigger, which breaks :last-child. Filled segments
// share one drop shadow on the group so neither casts a seam onto the other.
function SplitButton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "inline-flex w-fit items-stretch [&>*:focus-visible]:relative [&>*:focus-visible]:z-10 [&>[data-slot]~[data-slot]]:rounded-l-none [&>[data-slot]~[data-slot]]:border-l-0 [&>[data-slot]:has(~[data-slot])]:rounded-r-none has-[>[data-variant=default]]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)] [&>[data-variant=default]]:shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] [&>[data-variant=default]:has(~[data-slot])]:border-r-0 [&>*:active]:scale-100",
        className
      )}
      data-slot="split-button"
      role="group"
      {...props}
    />
  );
}

function SplitButtonTrigger({
  className,
  children,
  label,
  size = "default",
  variant = "default",
  ...props
}: Omit<React.ComponentProps<typeof DropdownMenuTrigger>, "render"> &
  Pick<React.ComponentProps<typeof Button>, "variant"> & {
    label?: string;
    size?: SplitButtonSize;
  }) {
  return (
    <DropdownMenuTrigger
      aria-label={label ?? (children ? undefined : "More options")}
      className={className}
      render={<Button size={TRIGGER_SIZES[size]} variant={variant} />}
      {...props}
    >
      {children ?? (
        <HugeiconsIcon
          aria-hidden="true"
          className={cn(
            "transition-transform duration-fast ease-out group-data-popup-open/button:rotate-180",
            size === "sm" && "size-3.5"
          )}
          icon={ArrowDown01Icon}
        />
      )}
    </DropdownMenuTrigger>
  );
}

export { SplitButton, SplitButtonTrigger };
