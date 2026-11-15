"use client";

import { Input } from "@notra/ui/components/ui/input";

import { cn } from "@/lib/utils";
import type { TimeFieldProps } from "@/types/components/date-field";

export function TimeField({
  id,
  value,
  onChange,
  required,
  className,
}: TimeFieldProps) {
  return (
    <Input
      className={cn(
        "bg-background w-full appearance-none tabular-nums sm:w-36 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none",
        className
      )}
      id={id}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      type="time"
      value={value}
    />
  );
}
