import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { toggleVariants } from "@notra/ui/constants/toggle";
import { cn } from "@notra/ui/lib/utils";
import type { VariantProps } from "class-variance-authority";


function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle };
