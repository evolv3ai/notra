"use client";

import { NumberField as NumberFieldPrimitive } from "@base-ui/react/number-field";
import { Add01Icon, MinusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { cn } from "@notra/ui/lib/utils";

const STEP_BUTTON_CLASS_NAME =
  "text-muted-foreground hover:text-foreground hover:bg-muted duration-fast grid h-full w-7 shrink-0 cursor-pointer place-items-center transition-colors outline-none select-none focus-visible:bg-muted disabled:pointer-events-none disabled:opacity-40";

/** A number input with − / + buttons, for small bounded counts. */
function NumberField({
  className,
  decrementLabel,
  incrementLabel,
  "aria-label": ariaLabel,
  ...props
}: NumberFieldPrimitive.Root.Props & {
  decrementLabel: string;
  incrementLabel: string;
  "aria-label"?: string;
}) {
  return (
    <NumberFieldPrimitive.Root
      className={cn("inline-flex", className)}
      data-slot="number-field"
      {...props}
    >
      <NumberFieldPrimitive.Group className="bg-background dark:bg-input/30 border-input inline-flex h-7 items-stretch overflow-hidden rounded-lg border">
        <NumberFieldPrimitive.Decrement
          aria-label={decrementLabel}
          className={cn(STEP_BUTTON_CLASS_NAME, "border-r")}
        >
          <HugeiconsIcon className="size-4" icon={MinusSignIcon} />
        </NumberFieldPrimitive.Decrement>
        <NumberFieldPrimitive.Input
          aria-label={ariaLabel}
          className="w-10 min-w-0 bg-transparent text-center text-sm tabular-nums outline-none"
        />
        <NumberFieldPrimitive.Increment
          aria-label={incrementLabel}
          className={cn(STEP_BUTTON_CLASS_NAME, "border-l")}
        >
          <HugeiconsIcon className="size-4" icon={Add01Icon} />
        </NumberFieldPrimitive.Increment>
      </NumberFieldPrimitive.Group>
    </NumberFieldPrimitive.Root>
  );
}

export { NumberField };
