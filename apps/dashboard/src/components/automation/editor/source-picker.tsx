"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@notra/ui/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@notra/ui/components/ui/popover";
import { Github } from "@notra/ui/components/ui/svgs/github";
import { Linear } from "@notra/ui/components/ui/svgs/linear";
import { cn } from "@notra/ui/lib/utils";
import { useState } from "react";

import { PICKER_CHIP_CLASS } from "@/components/automation/editor/editor-parts";
import type {
  SourceOption,
  SourcePickerProps,
} from "@/types/automation/source-picker";

function SourceIcon({
  type,
  className,
}: {
  type: SourceOption["type"];
  className: string;
}) {
  return type === "linear" ? (
    <Linear className={className} />
  ) : (
    <Github className={className} />
  );
}

/** Muted chip like `PickerSelect`, but picks several repositories or sources. */
export function SourcePicker({
  options,
  value,
  onChange,
  placeholder,
  ariaLabel,
  searchPlaceholder,
  emptyLabel,
  invalid,
}: SourcePickerProps) {
  const [open, setOpen] = useState(false);
  const first = options.find((option) => option.value === value[0]);
  const selected = new Set(value);
  let label = placeholder;
  if (first) {
    label =
      value.length > 1 ? `${first.name} +${value.length - 1}` : first.name;
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <button
            data-invalid={invalid || undefined}
            aria-label={ariaLabel}
            className={cn(
              PICKER_CHIP_CLASS,
              "data-invalid:ring-destructive/40 max-w-full data-invalid:ring-[3px]",
              value.length === 0 && "text-muted-foreground"
            )}
            type="button"
          />
        }
      >
        <SourceIcon
          className="size-3.5 shrink-0"
          type={first?.type ?? "github"}
        />
        <span className="truncate">{label}</span>
        <HugeiconsIcon
          className="text-muted-foreground size-3.5"
          icon={ArrowDown01Icon}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-0 p-0 shadow-none">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const checked = selected.has(option.value);
                return (
                  <CommandItem
                    className="gap-2.5 py-2"
                    data-checked={checked}
                    key={option.value}
                    onSelect={() =>
                      onChange(
                        checked
                          ? value.filter((id) => id !== option.value)
                          : [...value, option.value]
                      )
                    }
                    value={option.label}
                  >
                    <SourceIcon
                      className="text-muted-foreground size-3.5 shrink-0"
                      type={option.type}
                    />
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
