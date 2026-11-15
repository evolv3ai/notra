"use client";

import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Switch } from "@notra/ui/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { useId } from "react";
import { useTranslations } from "use-intl";

import type {
  OverviewFieldProps,
  OverviewHintProps,
  OverviewToggleRowProps,
} from "@/types/content/overview";

function OverviewHint({ field, children }: OverviewHintProps) {
  const t = useTranslations("content.overview");
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            aria-label={t("hintLabel", { field })}
            className="text-muted-foreground hover:text-foreground inline-flex cursor-help rounded-sm"
            type="button"
          />
        }
      >
        <HugeiconsIcon
          className="size-3.5"
          icon={InformationCircleIcon}
          strokeWidth={1.8}
        />
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{children}</TooltipContent>
    </Tooltip>
  );
}

export function OverviewField({
  label,
  hint,
  htmlFor,
  aside,
  children,
}: OverviewFieldProps) {
  const LabelTag = htmlFor ? "label" : "span";
  return (
    <div className="space-y-1.5">
      <div className="flex min-h-5 items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <LabelTag
            className="text-foreground text-[13px] font-medium"
            {...(htmlFor ? { htmlFor } : {})}
          >
            {label}
          </LabelTag>
          <OverviewHint field={label}>{hint}</OverviewHint>
        </span>
        {aside}
      </div>
      {children}
    </div>
  );
}

export function OverviewToggleRow({
  label,
  hint,
  checked,
  disabled,
  onCheckedChange,
}: OverviewToggleRowProps) {
  const id = useId();
  return (
    <div className="flex min-h-8 items-center justify-between gap-3">
      <span className="flex items-center gap-1.5">
        <label className="text-foreground text-[13px] font-medium" htmlFor={id}>
          {label}
        </label>
        <OverviewHint field={label}>{hint}</OverviewHint>
      </span>
      <Switch
        checked={checked}
        disabled={disabled}
        id={id}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
