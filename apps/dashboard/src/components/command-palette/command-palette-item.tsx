"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@notra/ui/lib/utils";
import { Command as CommandPrimitive } from "cmdk";

import type {
  CommandPaletteGroupProps,
  CommandPaletteItemProps,
} from "@/types/components/command-palette";

export function CommandPaletteGroup({
  heading,
  children,
}: CommandPaletteGroupProps) {
  return (
    <CommandPrimitive.Group
      className="text-foreground [&_[cmdk-group-heading]]:text-muted-foreground pb-1 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium"
      heading={heading}
    >
      {children}
    </CommandPrimitive.Group>
  );
}

export function CommandPaletteItem({
  icon,
  label,
  value,
  onSelect,
  keywords,
  meta,
  trailing,
  disabled,
  iconClassName,
  leading,
}: CommandPaletteItemProps) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "group/item relative flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors outline-none select-none",
        "data-[selected=true]:bg-muted data-[selected=true]:text-foreground",
        "dark:data-[selected=true]:bg-menu-highlight dark:data-[selected=true]:shadow-menu-highlight",
        "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"
      )}
      disabled={disabled}
      keywords={keywords}
      onSelect={onSelect}
      value={value}
    >
      {leading ?? (
        <HugeiconsIcon
          className={cn(
            "text-muted-foreground group-data-[selected=true]/item:text-foreground size-4 shrink-0 transition-colors",
            iconClassName
          )}
          icon={icon}
          strokeWidth={2}
        />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {meta ? (
        <span className="text-muted-foreground hidden max-w-[40%] shrink-0 truncate text-xs sm:block">
          {meta}
        </span>
      ) : null}
      {trailing ?? (
        <HugeiconsIcon
          className="text-muted-foreground size-3 shrink-0 opacity-0 transition-opacity group-data-[selected=true]/item:opacity-60"
          icon={ArrowRight01Icon}
          strokeWidth={2}
        />
      )}
    </CommandPrimitive.Item>
  );
}
