import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@notra/ui/lib/utils";

const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap border border-transparent font-medium transition-colors duration-fast ease-out focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-badge-secondary text-secondary-foreground [a]:hover:bg-badge-secondary/80",
        destructive:
          "bg-destructive/10 text-badge-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        success:
          "bg-success/10 text-badge-success focus-visible:ring-success/20 dark:bg-success/20 dark:focus-visible:ring-success/40 [a]:hover:bg-success/20",
        warning:
          "bg-warning/10 text-badge-warning focus-visible:ring-warning/20 dark:bg-warning/20 dark:focus-visible:ring-warning/40 [a]:hover:bg-warning/20",
        merged:
          "bg-merged/10 text-badge-merged focus-visible:ring-merged/20 dark:bg-merged/20 dark:focus-visible:ring-merged/40 [a]:hover:bg-merged/20",
        info: "bg-info/10 text-badge-info focus-visible:ring-info/20 dark:bg-info/20 dark:focus-visible:ring-info/40 [a]:hover:bg-info/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-5 px-2 py-0.5 text-xs [&>svg]:size-3!",
        md: "h-6 gap-1.5 px-2 py-0.5 text-sm [&>svg]:size-3.5!",
        sm: "h-4 gap-0.5 px-1.5 text-[0.625rem] [&>svg]:size-2.5!",
      },
      shape: {
        pill: "rounded-full",
        rounded: "rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      shape: "pill",
    },
  }
);

function Badge({
  className,
  variant = "default",
  size = "default",
  shape = "pill",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ className, size, shape, variant })),
      },
      props
    ),
    render,
    state: {
      size,
      shape,
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants };
