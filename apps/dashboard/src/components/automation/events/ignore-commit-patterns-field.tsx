"use client";

import {
  ArrowDown01Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  isValidIgnoreCommitPattern,
  joinIgnoreCommitPatterns,
  MAX_IGNORE_COMMIT_PATTERNS,
  splitIgnoreCommitPatternsText,
  toIgnoreCommitRegExp,
} from "@notra/ai/utils/ignore-commit-patterns";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@notra/ui/components/ui/collapsible";
import { FieldError } from "@notra/ui/components/ui/field";
import { Input } from "@notra/ui/components/ui/input";
import { Textarea } from "@notra/ui/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { cn } from "@notra/ui/lib/utils";
import { type ReactNode, useState } from "react";
import { useTranslations } from "use-intl";

import type { IgnoreCommitPatternsFieldProps } from "@/types/automation/event-trigger";
import {
  buildIgnoreCommitPrefixPattern,
  IGNORE_COMMIT_PATTERN_PRESET_PREFIXES,
  IGNORE_COMMIT_PATTERNS_PLACEHOLDER,
} from "@/utils/ignore-commit-patterns";

/** Preset pattern → the prefix it was built from, for readable output. */
const PRESET_PREFIX_BY_PATTERN = new Map<string, string>(
  IGNORE_COMMIT_PATTERN_PRESET_PREFIXES.map((prefix) => [
    buildIgnoreCommitPrefixPattern(prefix),
    prefix,
  ])
);

function findMatchingPattern(
  lines: string[],
  sample: string
): string | null | undefined {
  const trimmedSample = sample.trim();
  if (!trimmedSample) {
    return undefined;
  }
  return (
    lines.find(
      (line) =>
        isValidIgnoreCommitPattern(line) &&
        toIgnoreCommitRegExp(line).test(trimmedSample)
    ) ?? null
  );
}

/**
 * Push filter as two rows of an `EditorBox`: one-click prefixes, then custom
 * patterns and a tester tucked behind a disclosure. The prefixes and the
 * custom text are stored together as one pattern list.
 */
export function IgnoreCommitPatternsField({
  value,
  onChange,
  onBlur,
  errors,
  fieldName,
}: IgnoreCommitPatternsFieldProps) {
  const t = useTranslations("automation.events.ignorePatterns");
  const hasErrors = errors.length > 0;
  const lines = splitIgnoreCommitPatternsText(value);
  const presets = lines.filter((line) => PRESET_PREFIX_BY_PATTERN.has(line));
  const [customText, setCustomText] = useState(() =>
    joinIgnoreCommitPatterns(
      lines.filter((line) => !PRESET_PREFIX_BY_PATTERN.has(line))
    )
  );
  const customCount = splitIgnoreCommitPatternsText(customText).length;
  const [customOpen, setCustomOpen] = useState(customCount > 0);
  const [sample, setSample] = useState("");
  const atMax = lines.length >= MAX_IGNORE_COMMIT_PATTERNS;
  const matched = findMatchingPattern(lines, sample);

  const commit = (nextPresets: string[], nextCustomText: string) =>
    onChange(
      joinIgnoreCommitPatterns([
        ...nextPresets,
        ...splitIgnoreCommitPatternsText(nextCustomText),
      ])
    );

  let testResult: ReactNode = t("typeToCheck");
  if (matched === null) {
    testResult = t("notSkipped");
  } else if (matched) {
    testResult = t.rich("skippedBy", {
      pattern: PRESET_PREFIX_BY_PATTERN.get(matched) ?? matched,
      code: (chunks) => (
        <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
          {chunks}
        </code>
      ),
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {t("label")}
          <Tooltip>
            <TooltipTrigger className="text-muted-foreground inline-flex cursor-help">
              <HugeiconsIcon icon={InformationCircleIcon} size={14} />
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="max-w-60 text-xs">{t("hint")}</p>
            </TooltipContent>
          </Tooltip>
        </span>
        <div className="flex flex-wrap gap-1.5 sm:ml-auto">
          {IGNORE_COMMIT_PATTERN_PRESET_PREFIXES.map((prefix) => {
            const pattern = buildIgnoreCommitPrefixPattern(prefix);
            const active = presets.includes(pattern);
            return (
              <button
                aria-pressed={active}
                className={cn(
                  "duration-fast focus-visible:ring-ring/50 h-7 cursor-pointer rounded-md px-2.5 font-mono text-xs transition-colors outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
                  active
                    ? "bg-primary/15 text-primary ring-primary/30 ring-1 ring-inset"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
                disabled={!active && atMax}
                key={prefix}
                onClick={() =>
                  commit(
                    active
                      ? presets.filter((item) => item !== pattern)
                      : [...presets, pattern],
                    customText
                  )
                }
                type="button"
              >
                {prefix}
              </button>
            );
          })}
        </div>
      </div>
      <Collapsible onOpenChange={setCustomOpen} open={customOpen || hasErrors}>
        <CollapsibleTrigger
          render={
            <button
              className="text-muted-foreground hover:bg-muted/40 hover:text-foreground duration-fast focus-visible:bg-muted/50 group flex min-h-12 w-full cursor-pointer items-center gap-2 px-4 py-3 text-left text-sm transition-colors outline-none"
              type="button"
            />
          }
        >
          <span className="text-foreground flex-1 font-medium">
            {t("custom")}
            {customCount > 0 ? (
              <span className="text-muted-foreground/70 ml-1.5 tabular-nums">
                {customCount}
              </span>
            ) : null}
          </span>
          <HugeiconsIcon
            className="duration-fast size-4 transition-transform group-data-[panel-open]:rotate-180"
            icon={ArrowDown01Icon}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-3 px-4 pb-4">
            <div className="space-y-1.5">
              <Textarea
                aria-invalid={hasErrors}
                aria-label={t("custom")}
                className="min-h-16 font-mono"
                id={fieldName}
                onBlur={onBlur}
                onChange={(event) => {
                  const typed = splitIgnoreCommitPatternsText(
                    event.target.value
                  );
                  const asPresets = typed.filter((line) =>
                    PRESET_PREFIX_BY_PATTERN.has(line)
                  );
                  if (asPresets.length === 0) {
                    setCustomText(event.target.value);
                    commit(presets, event.target.value);
                    return;
                  }
                  // A pasted prefix pattern moves to its chip, so the chip
                  // stays the one place to turn it off again.
                  const rest = joinIgnoreCommitPatterns(
                    typed.filter((line) => !PRESET_PREFIX_BY_PATTERN.has(line))
                  );
                  setCustomText(rest);
                  commit([...new Set([...presets, ...asPresets])], rest);
                }}
                placeholder={t("placeholder", {
                  example: IGNORE_COMMIT_PATTERNS_PLACEHOLDER,
                })}
                value={customText}
              />
              {hasErrors ? <FieldError errors={errors} /> : null}
            </div>
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
              <Input
                aria-label={t("tryLabel")}
                className="font-mono sm:max-w-80"
                onChange={(event) => setSample(event.target.value)}
                placeholder={t("tryPlaceholder")}
                value={sample}
              />
              <p
                aria-live="polite"
                className={cn(
                  "text-sm wrap-anywhere",
                  matched ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {testResult}
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}
