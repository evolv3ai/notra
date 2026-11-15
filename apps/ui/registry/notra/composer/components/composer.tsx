"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cn } from "cn";
import { ArrowUpIcon, PencilIcon, XIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  useReducedMotion,
} from "motion/react";
import type { ComponentProps, ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

import { Button } from "../../button/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../tooltip/components/tooltip";
import {
  COMPOSER_CHIP_ACTION,
  COMPOSER_INPUT,
  COMPOSER_NUDGE_TRANSITION,
  COMPOSER_SEND_ACTIVE,
  COMPOSER_SEND_BUTTON,
  COMPOSER_SEND_BUTTON_SM,
  COMPOSER_SEND_INERT,
  COMPOSER_TOOLBAR_BUTTON,
  COMPOSER_TOOLBAR_BUTTON_LABEL,
  COMPOSER_TRAY_TRANSITION,
} from "../constants/composer";
import type {
  ComposerChipProps,
  ComposerFrameProps,
  ComposerInputProps,
  ComposerNudgeProps,
  ComposerSendProps,
  ComposerToolbarButtonProps,
  ComposerToolbarProps,
} from "../types/composer";

function ComposerNudgeShell({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");

  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element) {
      return;
    }
    setHeight(element.offsetHeight);
    const observer = new ResizeObserver(() => setHeight(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <m.div
      // react-doctor-disable-next-line react-doctor/no-layout-property-animation -- the tray has to push the input card down, a transform would leave a gap
      animate={{ height, opacity: 1 }}
      className="overflow-hidden"
      // react-doctor-disable-next-line react-doctor/no-layout-property-animation -- the tray has to push the input card down, a transform would leave a gap
      exit={{ height: 0, opacity: 0 }}
      // react-doctor-disable-next-line react-doctor/no-layout-property-animation -- the tray has to push the input card down, a transform would leave a gap
      initial={{ height: 0, opacity: 0 }}
      transition={reduceMotion ? { duration: 0 } : COMPOSER_NUDGE_TRANSITION}
    >
      <div ref={contentRef}>{children}</div>
    </m.div>
  );
}

export function ComposerFrame({
  children,
  nudge,
  connectedTop = false,
  flat = false,
  size = "default",
  className,
}: ComposerFrameProps) {
  const hasNudge = Boolean(nudge);
  const showTray = hasNudge || !flat;

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col",
        COMPOSER_TRAY_TRANSITION,
        showTray ? "bg-muted p-1" : "bg-transparent",
        flat
          ? size === "sm"
            ? "rounded-[22px]"
            : "rounded-[28px]"
          : "rounded-[18px]",
        connectedTop && "rounded-t-none",
        className
      )}
      data-slot="composer"
    >
      <LazyMotion features={domAnimation} strict>
        <AnimatePresence initial={false}>
          {nudge ? (
            <ComposerNudgeShell key="nudge">{nudge}</ComposerNudgeShell>
          ) : null}
        </AnimatePresence>
      </LazyMotion>
      <div
        className={cn(
          "border-border/70 bg-background min-w-0 overflow-hidden border",
          flat
            ? // pill input with a round send button; the radius is half the
              // single-line height so wrapped lines keep the button concentric
              cn(
                "**:data-[slot=composer-send]:rounded-full **:data-[slot=composer-send]:[corner-shape:round] **:data-[slot=composer-send]:supports-[corner-shape:squircle]:rounded-full",
                size === "sm" ? "rounded-[18px]" : "rounded-3xl"
              )
            : "rounded-[14px] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),inset_0_0_6px_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_0_6px_rgba(255,255,255,0.03)]",
          connectedTop && !hasNudge && "rounded-t-none border-t-0"
        )}
        data-slot="composer-card"
      >
        {children}
      </div>
    </div>
  );
}

export function ComposerNudge({ title, action, children }: ComposerNudgeProps) {
  const hasChips = Boolean(children);

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 px-2.25 pt-0.5 pb-1",
        hasChips && "flex-wrap"
      )}
      data-slot="composer-nudge"
    >
      {title && !hasChips ? (
        <p className="min-w-0 flex-1 text-xs font-medium wrap-anywhere">
          {title}
        </p>
      ) : null}
      {hasChips ? (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {children}
        </div>
      ) : null}
      {action ? (
        <div className="ml-auto flex shrink-0 items-center">{action}</div>
      ) : null}
    </div>
  );
}

function ComposerChipAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={label}
      className={COMPOSER_CHIP_ACTION}
      onClick={onClick}
      size="icon-xs"
      variant="ghost"
    >
      <Icon className="size-3" />
    </Button>
  );
}

export function ComposerChip({
  icon,
  label,
  onRemove,
  removeLabel,
  onEdit,
  editLabel,
  onSteer,
  steerLabel,
  onClick,
  previewLabel,
  pending = false,
  className,
  labelClassName,
}: ComposerChipProps) {
  const content = (
    <>
      {icon}
      <span className={cn("max-w-48 truncate", labelClassName)} title={label}>
        {label}
      </span>
    </>
  );

  return (
    <span
      aria-busy={pending || undefined}
      className={cn(
        "border-foreground/25 bg-background text-foreground inline-flex max-w-full items-center gap-1.5 rounded-md border border-dashed py-1 pr-1 pl-1.5 text-xs",
        pending && "border-foreground/15 text-muted-foreground",
        className
      )}
      data-slot="composer-chip"
    >
      {onClick ? (
        <ButtonPrimitive
          aria-label={previewLabel ?? `Preview ${label}`}
          className="hover:text-foreground focus-visible:ring-ring/50 flex min-w-0 cursor-pointer items-center gap-1.5 rounded-sm text-left transition-colors outline-none focus-visible:ring-3"
          onClick={onClick}
        >
          {content}
        </ButtonPrimitive>
      ) : (
        content
      )}
      {onSteer && !pending ? (
        <ComposerChipAction
          icon={ArrowUpIcon}
          label={steerLabel ?? `Send ${label} now`}
          onClick={onSteer}
        />
      ) : null}
      {onEdit && !pending ? (
        <ComposerChipAction
          icon={PencilIcon}
          label={editLabel ?? `Edit ${label}`}
          onClick={onEdit}
        />
      ) : null}
      {onRemove ? (
        <ComposerChipAction
          icon={XIcon}
          label={removeLabel ?? `Remove ${label}`}
          onClick={onRemove}
        />
      ) : null}
    </span>
  );
}

export function ComposerInput({ className, ...props }: ComposerInputProps) {
  return (
    <Textarea
      className={cn(COMPOSER_INPUT, className)}
      data-slot="composer-input"
      {...props}
    />
  );
}

export function ComposerToolbar({ children, className }: ComposerToolbarProps) {
  return (
    <div
      className={cn("flex items-center gap-1 px-2 pt-1 pb-2", className)}
      data-slot="composer-toolbar"
    >
      {children}
    </div>
  );
}

export function ComposerToolbarButton({
  className,
  size = "sm",
  ...props
}: ComposerToolbarButtonProps) {
  const isIconOnly = typeof size === "string" && size.startsWith("icon");

  return (
    <Button
      className={cn(
        COMPOSER_TOOLBAR_BUTTON,
        !isIconOnly && COMPOSER_TOOLBAR_BUTTON_LABEL,
        className
      )}
      size={size}
      variant="ghost"
      {...props}
    />
  );
}

export function ComposerSend({
  children,
  label,
  tooltip,
  busy = false,
  disabled = false,
  size = "default",
  onClick,
}: ComposerSendProps) {
  const isInert = disabled && !busy;
  const buttonProps = {
    "aria-busy": busy || undefined,
    "aria-label": label,
    className: cn(
      size === "sm" ? COMPOSER_SEND_BUTTON_SM : COMPOSER_SEND_BUTTON,
      isInert ? COMPOSER_SEND_INERT : COMPOSER_SEND_ACTIVE
    ),
    disabled,
    focusableWhenDisabled: true,
    onClick,
    size: "icon",
    variant: isInert ? "secondary" : "default",
  } satisfies ComponentProps<typeof Button>;

  const content = busy ? (
    <Spinner className={size === "sm" ? "size-3" : "size-3.5"} />
  ) : (
    children
  );

  if (!tooltip) {
    return (
      <Button data-slot="composer-send" {...buttonProps}>
        {content}
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button data-slot="composer-send" {...buttonProps} />}
      >
        {content}
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
