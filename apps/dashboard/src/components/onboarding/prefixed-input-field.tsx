"use client";

import { Label } from "@notra/ui/components/ui/label";

import { cn } from "@/lib/utils";
import type { PrefixedInputFieldProps } from "@/types/onboarding";

export function PrefixedInputField({
  id,
  label,
  prefix,
  error,
  preview,
  inputClassName,
  inputProps,
  children,
}: PrefixedInputFieldProps) {
  return (
    <div className="grid gap-2" data-preview={preview}>
      <Label htmlFor={id}>{label}</Label>
      <div
        className={cn(
          "focus-within:border-ring focus-within:ring-ring/50 relative flex h-11 min-h-11 w-full flex-row items-center overflow-hidden rounded-xl border transition-colors focus-within:ring-[3px]",
          error ? "border-destructive" : "border-input"
        )}
      >
        <label
          className="border-input bg-muted/30 text-muted-foreground flex h-full items-center border-r px-3.5 text-sm"
          htmlFor={id}
        >
          {prefix}
        </label>
        <input
          {...inputProps}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={Boolean(error)}
          className={cn(
            "h-full bg-transparent text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50",
            inputClassName
          )}
          id={id}
          type="text"
        />
        {children}
      </div>
      {error ? (
        <p className="text-destructive text-sm" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
