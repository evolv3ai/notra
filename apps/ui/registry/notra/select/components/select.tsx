"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { cn } from "cn";
import { ChevronsUpDownIcon } from "lucide-react";
import type { ComponentProps } from "react";

import {
  Select,
  SelectGroup,
  SelectItem as ShadcnSelectItem,
  SelectLabel as ShadcnSelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator as ShadcnSelectSeparator,
  SelectValue,
} from "@/components/ui/select";

import { buttonVariants } from "../../button/components/button";
import {
  DROPDOWN_ITEM_CLASS_NAME,
  DROPDOWN_POPUP_CLASS_NAME,
} from "../../dropdown-menu/constants/dropdown-menu";
import { SELECT_COLLISION_AVOIDANCE } from "../constants/select";

function SelectTrigger({
  className,
  size = "default",
  variant = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default";
  variant?: "default" | "ghost";
}) {
  return (
    <SelectPrimitive.Trigger
      data-size={size}
      data-slot="select-trigger"
      data-variant={variant}
      className={buttonVariants({
        variant: variant === "ghost" ? "ghost" : "outline",
        size: size === "sm" ? "sm" : "default",
        className: cn(
          "data-[placeholder]:text-muted-foreground w-fit justify-between font-normal transition-[background-color,border-color,box-shadow,filter] active:scale-100 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 motion-reduce:transition-none",
          className
        ),
      })}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <ChevronsUpDownIcon className="text-muted-foreground pointer-events-none size-4" />
        }
      />
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "start",
  alignOffset = 0,
  alignItemWithTrigger = false,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        align={align}
        alignItemWithTrigger={alignItemWithTrigger}
        alignOffset={alignOffset}
        className="isolate z-50"
        collisionAvoidance={SELECT_COLLISION_AVOIDANCE}
        side={side}
        sideOffset={sideOffset}
      >
        <SelectPrimitive.Popup
          className={cn(
            DROPDOWN_POPUP_CLASS_NAME,
            "relative isolate w-(--anchor-width) min-w-36 p-0",
            className
          )}
          data-align-trigger={alignItemWithTrigger}
          data-slot="select-content"
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List className="p-1">
            {children}
          </SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({
  className,
  ...props
}: ComponentProps<typeof ShadcnSelectLabel>) {
  return (
    <ShadcnSelectLabel
      className={cn("px-2.5 py-1.5 font-medium", className)}
      {...props}
    />
  );
}

function SelectItem({
  className,
  ...props
}: ComponentProps<typeof ShadcnSelectItem>) {
  return (
    <ShadcnSelectItem
      className={cn(
        DROPDOWN_ITEM_CLASS_NAME,
        "w-full pr-8 *:last:right-2.5",
        className
      )}
      {...props}
    />
  );
}

function SelectSeparator({
  className,
  ...props
}: ComponentProps<typeof ShadcnSelectSeparator>) {
  return <ShadcnSelectSeparator className={cn("mx-2", className)} {...props} />;
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
