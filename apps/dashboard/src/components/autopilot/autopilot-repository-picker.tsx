"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { SquareLock02Icon, UnfoldMoreIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { buttonVariants } from "@notra/ui/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@notra/ui/components/ui/combobox";

import { cn } from "@/lib/utils";
import type {
  AutopilotRepositoryOption,
  AutopilotRepositoryPickerProps,
} from "@/types/autopilot";

/** Searchable repository select; the list stays short however many repos the app sees. */
export function AutopilotRepositoryPicker({
  id,
  repositories,
  value,
  onChange,
  className,
  label = "Website repository",
  placeholder = "Choose a repository",
}: AutopilotRepositoryPickerProps) {
  const selected =
    repositories.find((repository) => repository.fullName === value) ?? null;

  return (
    <Combobox
      isItemEqualToValue={(item, current) => item.fullName === current.fullName}
      itemToStringLabel={(item: AutopilotRepositoryOption) => item.fullName}
      items={repositories}
      onValueChange={(next) => {
        if (next) {
          onChange(next);
        }
      }}
      value={selected}
    >
      <ComboboxPrimitive.Trigger
        aria-label={label}
        className={cn(
          buttonVariants({ variant: "secondary", size: "sm" }),
          "justify-between font-normal active:scale-100",
          !selected && "text-foreground/70",
          className
        )}
        id={id}
      >
        <span className="truncate">{value ?? placeholder}</span>
        <HugeiconsIcon
          className="text-muted-foreground size-4 shrink-0"
          icon={UnfoldMoreIcon}
        />
      </ComboboxPrimitive.Trigger>
      <ComboboxContent
        align="end"
        className="w-96 *:data-[slot=input-group]:m-1.5 *:data-[slot=input-group]:mb-0"
      >
        <ComboboxInput placeholder="Search repositories" showTrigger={false} />
        <ComboboxEmpty>No repository matches.</ComboboxEmpty>
        <ComboboxList className="mt-1">
          {(repository: AutopilotRepositoryOption) => (
            <ComboboxItem key={repository.fullName} value={repository}>
              <span className="flex min-w-0 items-center gap-1.5 py-0.5">
                <span className="min-w-0 truncate">
                  <span className="text-muted-foreground">
                    {repository.owner}/
                  </span>
                  {repository.name}
                </span>
                {repository.private ? (
                  <HugeiconsIcon
                    aria-label="Private"
                    className="text-muted-foreground size-3 shrink-0"
                    icon={SquareLock02Icon}
                    role="img"
                  />
                ) : null}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
