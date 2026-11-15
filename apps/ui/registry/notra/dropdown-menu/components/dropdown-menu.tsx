"use client";

import { cn } from "cn";
import type { ComponentProps } from "react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem as ShadcnDropdownMenuCheckboxItem,
  DropdownMenuContent as ShadcnDropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem as ShadcnDropdownMenuItem,
  DropdownMenuLabel as ShadcnDropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem as ShadcnDropdownMenuRadioItem,
  DropdownMenuSeparator as ShadcnDropdownMenuSeparator,
  DropdownMenuShortcut as ShadcnDropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent as ShadcnDropdownMenuSubContent,
  DropdownMenuSubTrigger as ShadcnDropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  DROPDOWN_INDICATOR_ITEM_CLASS_NAME,
  DROPDOWN_ITEM_CLASS_NAME,
  DROPDOWN_POPUP_CLASS_NAME,
} from "../constants/dropdown-menu";

function DropdownMenuContent({
  className,
  ...props
}: ComponentProps<typeof ShadcnDropdownMenuContent>) {
  return (
    <ShadcnDropdownMenuContent
      className={cn(
        DROPDOWN_POPUP_CLASS_NAME,
        "w-(--anchor-width) min-w-32",
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuSubContent({
  className,
  ...props
}: ComponentProps<typeof ShadcnDropdownMenuSubContent>) {
  return (
    <ShadcnDropdownMenuSubContent
      className={cn(DROPDOWN_POPUP_CLASS_NAME, "w-auto min-w-40", className)}
      {...props}
    />
  );
}

function DropdownMenuLabel({
  className,
  ...props
}: ComponentProps<typeof ShadcnDropdownMenuLabel>) {
  return (
    <ShadcnDropdownMenuLabel
      className={cn("px-2.5 py-1.5 data-inset:pl-8", className)}
      {...props}
    />
  );
}

function DropdownMenuItem({
  className,
  ...props
}: ComponentProps<typeof ShadcnDropdownMenuItem>) {
  return (
    <ShadcnDropdownMenuItem
      className={cn(
        DROPDOWN_ITEM_CLASS_NAME,
        "data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:text-destructive",
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuSubTrigger({
  className,
  ...props
}: ComponentProps<typeof ShadcnDropdownMenuSubTrigger>) {
  return (
    <ShadcnDropdownMenuSubTrigger
      className={cn(DROPDOWN_ITEM_CLASS_NAME, className)}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({
  className,
  ...props
}: ComponentProps<typeof ShadcnDropdownMenuCheckboxItem>) {
  return (
    <ShadcnDropdownMenuCheckboxItem
      className={cn(
        DROPDOWN_ITEM_CLASS_NAME,
        DROPDOWN_INDICATOR_ITEM_CLASS_NAME,
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuRadioItem({
  className,
  ...props
}: ComponentProps<typeof ShadcnDropdownMenuRadioItem>) {
  return (
    <ShadcnDropdownMenuRadioItem
      className={cn(
        DROPDOWN_ITEM_CLASS_NAME,
        DROPDOWN_INDICATOR_ITEM_CLASS_NAME,
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof ShadcnDropdownMenuSeparator>) {
  return (
    <ShadcnDropdownMenuSeparator className={cn("mx-2", className)} {...props} />
  );
}

function DropdownMenuShortcut({
  className,
  ...props
}: ComponentProps<typeof ShadcnDropdownMenuShortcut>) {
  return (
    <ShadcnDropdownMenuShortcut
      className={cn(
        "group-focus/dropdown-menu-item:text-muted-foreground pl-4 font-mono tracking-normal",
        className
      )}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
