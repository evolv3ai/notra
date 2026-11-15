"use client";

import { Autocomplete as AutocompletePrimitive } from "@base-ui/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteItem,
  AutocompleteList,
} from "@notra/ui/components/ui/autocomplete";
import { useRef, useState } from "react";

import { Button } from "@/components/button";
import type { AutopilotTagInputProps } from "@/types/autopilot";

const DEFAULT_SEPARATOR = /[\s,]+/;
const MAX_SUGGESTIONS = 8;

/**
 * A list of short values typed one at a time: Enter, a comma or leaving the
 * field adds what was typed, Backspace in an empty field removes the last.
 * Suggestions starting with what was typed open below; arrows pick one.
 */
export function AutopilotTagInput({
  id,
  values,
  onChange,
  parse,
  placeholder,
  label,
  disabled,
  suggestions = [],
  separator = DEFAULT_SEPARATOR,
}: AutopilotTagInputProps) {
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);
  // Only read by the Enter handler, so it never needs a render.
  const highlighted = useRef(false);
  const query = draft.trim().replace(/^@/, "").toLowerCase();
  const added = new Set(values);
  const matches = query
    ? suggestions
        .filter(
          (suggestion) => suggestion.startsWith(query) && !added.has(suggestion)
        )
        .slice(0, MAX_SUGGESTIONS)
    : [];

  const commit = (text = draft) => {
    const entries = text
      .split(separator)
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (entries.length === 0) {
      return;
    }
    const parsed = entries.map(parse);
    if (parsed.some((entry) => entry === null)) {
      setInvalid(true);
      return;
    }
    const next = [
      ...new Set([...values, ...parsed.filter((entry) => entry !== null)]),
    ];
    setDraft("");
    if (next.length !== values.length) {
      onChange(next);
    }
  };

  return (
    <div className="border-input focus-within:border-ring focus-within:ring-ring/50 has-aria-invalid:border-destructive has-aria-invalid:ring-destructive/20 dark:bg-background/60 flex min-h-8 w-full flex-wrap items-center gap-1 rounded-lg border bg-transparent px-1 py-1 text-sm transition-colors focus-within:ring-3 has-aria-invalid:ring-3">
      {values.map((value) => (
        <span
          className="bg-muted text-foreground flex h-[calc(--spacing(5.25))] items-center gap-1 rounded-sm pl-1.5 font-mono text-xs dark:bg-white/10"
          key={value}
        >
          {value}
          <Button
            aria-label={`Remove ${value}`}
            className="-ml-1"
            disabled={disabled}
            onClick={() => onChange(values.filter((entry) => entry !== value))}
            size="icon-xs"
            variant="ghost"
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
          </Button>
        </span>
      ))}
      <Autocomplete
        filter={null}
        items={matches}
        onItemHighlighted={(item) => {
          highlighted.current = item !== undefined;
        }}
        onValueChange={(next, details) => {
          if (details.reason === "item-press") {
            commit(next);
            return;
          }
          setDraft(next);
          setInvalid(false);
        }}
        value={draft}
      >
        <AutocompletePrimitive.Input
          aria-invalid={invalid || undefined}
          aria-label={label}
          autoCapitalize="off"
          autoComplete="off"
          className="placeholder:text-muted-foreground h-6 min-w-24 flex-1 bg-transparent px-1.5 outline-none"
          disabled={disabled}
          id={id}
          onBlur={() => commit()}
          onKeyDown={(event) => {
            // With a suggestion highlighted, Enter picks it instead.
            if (event.key === "Enter" && highlighted.current) {
              return;
            }
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              commit();
            } else if (event.key === "Backspace" && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          placeholder={values.length === 0 ? placeholder : undefined}
          spellCheck={false}
        />
        {matches.length > 0 ? (
          <AutocompleteContent className="min-w-56">
            <AutocompleteList>
              {(suggestion: string) => (
                <AutocompleteItem key={suggestion} value={suggestion}>
                  <span className="truncate font-mono text-xs">
                    {suggestion}
                  </span>
                </AutocompleteItem>
              )}
            </AutocompleteList>
          </AutocompleteContent>
        ) : null}
      </Autocomplete>
    </div>
  );
}
