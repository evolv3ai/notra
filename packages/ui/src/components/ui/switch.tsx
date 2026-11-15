"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@notra/ui/lib/utils";

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer group/switch after:-inset-x-3.5 after:-inset-y-[9px] relative inline-flex shrink-0 appearance-none items-center rounded-lg corner-squircle border border-transparent p-px outline-none transition-[background-color,border-color,box-shadow] duration-fast ease-out after:absolute focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 data-[size=default]:h-4.5 data-[size=sm]:h-3.5 data-[size=default]:w-8 data-[size=sm]:w-6 data-[size=sm]:rounded-md cursor-pointer data-disabled:cursor-not-allowed data-checked:bg-primary data-unchecked:bg-input data-disabled:opacity-50 motion-reduce:transition-none dark:data-unchecked:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&+input]:appearance-none",
        className
      )}
      data-size={size}
      data-slot="switch"
      {...props}
    >
      <SwitchPrimitive.Thumb
        className="pointer-events-none block shrink-0 rounded-md corner-squircle bg-background ring-0 transition-transform duration-fast ease-out group-data-[size=default]/switch:size-3.5 group-data-[size=sm]/switch:size-2.5 group-data-[size=sm]/switch:rounded-sm data-checked:translate-x-full data-unchecked:translate-x-0 motion-reduce:transition-none dark:data-checked:bg-primary-foreground dark:data-unchecked:bg-foreground"
        data-slot="switch-thumb"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
