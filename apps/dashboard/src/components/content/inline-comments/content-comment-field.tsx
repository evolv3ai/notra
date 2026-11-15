"use client";

import { ArrowUp02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Composer } from "@notra/ui/components/ui/composer";
import { cn } from "@notra/ui/lib/utils";
import { useId } from "react";

import type { ContentCommentFieldProps } from "@/types/content/inline-comments";

/** Single-line pill composer shared by new comments and thread replies. */
export function ContentCommentField({
  value,
  onChange,
  onSubmit,
  canSubmit,
  busy,
  readOnly,
  label,
  placeholder,
  sendLabel,
  error,
  nudge,
  leading,
  textarea,
  onFocus,
  className,
}: ContentCommentFieldProps) {
  const errorId = useId();
  return (
    <form
      className={cn("min-w-0", className)}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Composer.Frame flat nudge={nudge} size="sm">
        <div className="flex items-end gap-1 p-0.75">
          {leading ? (
            <div className="flex h-7 shrink-0 items-center self-start pl-0.75">
              {leading}
            </div>
          ) : null}
          <Composer.Input
            aria-describedby={error ? errorId : undefined}
            aria-label={label}
            className={cn(
              "field-sizing-content max-h-40 min-h-7 w-full flex-1 py-1 pr-1 leading-5",
              leading ? "pl-1.5" : "pl-3"
            )}
            maxLength={10000}
            onChange={(event) => onChange(event.target.value)}
            onFocus={onFocus}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                onSubmit();
              }
            }}
            placeholder={placeholder}
            readOnly={readOnly}
            ref={textarea}
            rows={1}
            value={value}
          />
          <Composer.Send
            busy={busy}
            disabled={!canSubmit}
            label={sendLabel}
            onClick={onSubmit}
            size="sm"
            tooltip={sendLabel}
          >
            <HugeiconsIcon className="size-3.5" icon={ArrowUp02Icon} />
          </Composer.Send>
        </div>
        {error ? (
          <p
            className="text-destructive border-border/70 border-t px-3 py-2 text-xs text-pretty"
            id={errorId}
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </Composer.Frame>
    </form>
  );
}
