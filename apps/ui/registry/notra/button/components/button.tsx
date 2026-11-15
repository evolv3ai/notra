import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { type ComponentProps, useId } from "react";

import {
  Button as ShadcnButton,
  buttonVariants as shadcnButtonVariants,
} from "@/components/ui/button";

import { ButtonContent } from "./button-content";

const depthVariants = cva("relative", {
  variants: {
    variant: {
      default:
        "border-primary/60 text-primary-foreground bg-linear-to-b from-[color-mix(in_oklab,var(--color-primary),black_8%)] to-[color-mix(in_oklab,var(--color-primary),black_20%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_1px_2px_rgba(0,0,0,0.18)] [corner-shape:squircle] hover:brightness-110 supports-[corner-shape:squircle]:rounded-[0.75rem]",
      outline:
        "border-border from-background to-muted text-foreground aria-expanded:from-secondary aria-expanded:to-secondary dark:from-input dark:to-muted bg-linear-to-b shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(0,0,0,0.06)] [corner-shape:squircle] hover:brightness-[0.97] supports-[corner-shape:squircle]:rounded-[0.75rem] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_2px_rgba(0,0,0,0.4)] dark:hover:brightness-125",
      secondary:
        "border-foreground/60 from-foreground/85 to-foreground text-background hover:from-foreground/70 hover:to-foreground/85 bg-linear-to-b shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_1px_2px_rgba(0,0,0,0.18)] [corner-shape:squircle] supports-[corner-shape:squircle]:rounded-[0.75rem]",
      ghost: "",
      destructive:
        "border-destructive/60 from-destructive focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 bg-linear-to-b to-[color-mix(in_oklab,var(--color-destructive),black_12%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_1px_2px_rgba(0,0,0,0.18)] [corner-shape:squircle] hover:brightness-110 supports-[corner-shape:squircle]:rounded-[0.75rem] dark:from-[color-mix(in_oklab,var(--color-destructive),black_20%)] dark:to-[color-mix(in_oklab,var(--color-destructive),black_30%)]",
      link: "text-foreground",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

type ButtonVariantProps = VariantProps<typeof shadcnButtonVariants>;

function buttonVariants({
  className,
  ...props
}: ButtonVariantProps & { className?: string } = {}) {
  return cn(shadcnButtonVariants(props), depthVariants(props), className);
}

type ButtonProps = ComponentProps<typeof ShadcnButton> & {
  /** Swaps the label for bouncing dots while an action runs. */
  loading?: boolean;
  /**
   * Fills the button from the left, from 0 to 100, e.g. while a file
   * uploads. Set it back to `undefined` when the work is done: the bar fills
   * up and fades out. For work you can't measure, use `loading`.
   */
  progress?: number;
};

function Button({
  className,
  variant = "default",
  size = "default",
  loading = false,
  progress,
  disabled,
  focusableWhenDisabled,
  "aria-describedby": ariaDescribedBy,
  children,
  ...props
}: ButtonProps) {
  const hasProgress = progress !== undefined;
  const busy = loading || hasProgress;
  const progressTextId = useId();

  return (
    <ShadcnButton
      aria-busy={busy || undefined}
      aria-describedby={
        hasProgress
          ? [ariaDescribedBy, progressTextId].filter(Boolean).join(" ")
          : ariaDescribedBy
      }
      className={cn(
        depthVariants({ variant }),
        "has-data-[clip]:overflow-hidden",
        busy && "cursor-progress",
        className
      )}
      data-loading={loading ? "" : undefined}
      disabled={disabled || busy}
      focusableWhenDisabled={focusableWhenDisabled ?? busy}
      size={size}
      variant={variant}
      {...props}
    >
      <ButtonContent
        loading={loading}
        progress={progress}
        progressTextId={progressTextId}
      >
        {children}
      </ButtonContent>
    </ShadcnButton>
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
