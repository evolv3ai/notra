"use client";

import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { useUiLabels } from "@notra/ui/components/shared/ui-labels-provider";
import { Button } from "@notra/ui/components/ui/button";
import { useCopyToClipboard } from "@notra/ui/hooks/use-copy-to-clipboard";
import { cn } from "@notra/ui/lib/utils";
import { type ReactNode, useState } from "react";
import type {
  CopyButtonClickHandler,
  CopyButtonProps,
  CopyStateIconProps,
} from "@notra/ui/types/copy-button";

const SWAP_CLASS =
  "col-start-1 row-start-1 transition-[opacity,scale,filter] duration-normal ease-out motion-reduce:transition-none";
const SWAP_HIDDEN_CLASS = "scale-25 opacity-0 blur-xs";
const TICK_OPTICAL_CLASS = "-translate-y-px";
const TICK_STROKE_WIDTH = 2;
const FILLED_VARIANTS = new Set<CopyButtonProps["variant"]>([
  "default",
  "destructive",
]);

function useCopiedSwap(copied: boolean) {
  const [previousCopied, setPreviousCopied] = useState(copied);
  const [isSwapping, setIsSwapping] = useState(false);
  if (copied !== previousCopied) {
    setPreviousCopied(copied);
    setIsSwapping(true);
  }
  return { finishSwap: () => setIsSwapping(false), isSwapping };
}

/**
 * Copy icon that turns into a tick while `copied`. Use it inside your own
 * trigger when `CopyButton` doesn't fit, e.g. a tooltip trigger that also
 * swaps its tooltip text.
 */
export function CopyStateIcon({
  copied,
  className,
  icon = Copy01Icon,
  iconClassName,
  tinted = true,
}: CopyStateIconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("grid place-items-center", className)}
      data-icon="inline-start"
      data-slot="copy-state-icon"
    >
      <HugeiconsIcon
        className={cn(SWAP_CLASS, iconClassName, copied && SWAP_HIDDEN_CLASS)}
        icon={icon}
      />
      <HugeiconsIcon
        className={cn(
          SWAP_CLASS,
          TICK_OPTICAL_CLASS,
          tinted && "text-success",
          iconClassName,
          !copied && SWAP_HIDDEN_CLASS
        )}
        icon={Tick02Icon}
        strokeWidth={TICK_STROKE_WIDTH}
      />
    </span>
  );
}

function CopiedLabelSwap({
  copied,
  children,
  copiedLabel,
  icon,
  iconClassName,
  tinted,
}: {
  copied: boolean;
  children: ReactNode;
  copiedLabel: ReactNode;
  icon: IconSvgElement;
  iconClassName?: string;
  tinted: boolean;
}) {
  const { finishSwap, isSwapping } = useCopiedSwap(copied);
  const swapInClass = "animate-button-swap-in [animation-delay:70ms]";
  const labelSwapClass = copied ? "animate-button-swap-out" : swapInClass;
  const copiedLayerClass = copied
    ? isSwapping && swapInClass
    : "animate-button-swap-out opacity-0";

  return (
    <>
      <span
        aria-hidden={copied}
        className={cn(
          "relative inline-flex min-w-0 flex-1 items-center [gap:inherit] [justify-content:inherit] motion-reduce:animate-none",
          copied && "opacity-0",
          isSwapping && labelSwapClass
        )}
        data-clip={isSwapping || copied ? "" : undefined}
        data-slot="button-label"
      >
        <HugeiconsIcon
          aria-hidden="true"
          className={iconClassName}
          data-icon="inline-start"
          icon={icon}
        />
        <span className="grid justify-items-center">
          <span className="col-start-1 row-start-1">{children}</span>
          <span
            aria-hidden="true"
            className="invisible col-start-1 row-start-1"
          >
            {copiedLabel}
          </span>
        </span>
      </span>
      {copied || isSwapping ? (
        <span
          aria-hidden={!copied}
          className={cn(
            "pointer-events-none absolute inset-0 flex items-center justify-center [gap:inherit] motion-reduce:animate-none",
            copiedLayerClass
          )}
          data-slot="copy-button-copied"
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget) {
              finishSwap();
            }
          }}
        >
          <HugeiconsIcon
            aria-hidden="true"
            className={cn(
              TICK_OPTICAL_CLASS,
              tinted && "text-success",
              iconClassName
            )}
            icon={Tick02Icon}
            strokeWidth={TICK_STROKE_WIDTH}
          />
          {copiedLabel}
        </span>
      ) : null}
    </>
  );
}

/**
 * Copies `value` and confirms in place: the icon turns into a tick for a
 * moment. Icon-only unless you pass a label as children. Failures go to
 * `onCopyError`, so the caller decides how to surface them.
 */
export function CopyButton({
  value,
  onCopy,
  onCopyError,
  timeout,
  copiedLabel,
  copiedAriaLabel,
  icon = Copy01Icon,
  iconClassName,
  children,
  onClick,
  variant = "ghost",
  size,
  "aria-label": ariaLabel,
  ...props
}: CopyButtonProps) {
  const labels = useUiLabels();
  const { copiedText, copy } = useCopyToClipboard({
    timeout,
    onError: onCopyError,
  });
  const copied = copiedText === value;
  const hasLabel = children !== undefined && children !== null;
  const tinted = !FILLED_VARIANTS.has(variant);
  const iconOnlyAriaLabel = copied
    ? (copiedAriaLabel ?? labels.copied)
    : (ariaLabel ?? labels.copy);

  const handleClick: CopyButtonClickHandler = async (event) => {
    onClick?.(event);
    if (event.defaultPrevented) {
      return;
    }
    if (await copy(value)) {
      onCopy?.();
    }
  };

  return (
    <Button
      aria-label={hasLabel ? ariaLabel : iconOnlyAriaLabel}
      data-copied={copied ? "" : undefined}
      onClick={handleClick}
      size={size ?? (hasLabel ? "sm" : "icon-sm")}
      type="button"
      variant={variant}
      {...props}
    >
      {hasLabel && copiedLabel !== undefined ? (
        <CopiedLabelSwap
          copied={copied}
          copiedLabel={copiedLabel}
          icon={icon}
          iconClassName={iconClassName}
          tinted={tinted}
        >
          {children}
        </CopiedLabelSwap>
      ) : (
        <>
          <CopyStateIcon
            copied={copied}
            icon={icon}
            iconClassName={iconClassName}
            tinted={tinted}
          />
          {children}
        </>
      )}
    </Button>
  );
}
