"use client";

import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";

import { AUTOPILOT_METRIC_RANGES } from "@/constants/autopilot-ui";
import type { AutopilotPeriodSelectProps } from "@/types/autopilot-metrics";

export function AutopilotPeriodSelect({
  value,
  onChange,
}: AutopilotPeriodSelectProps) {
  return (
    <Select
      items={AUTOPILOT_METRIC_RANGES.map((range) => ({
        value: String(range.days),
        label: range.label,
      }))}
      onValueChange={(next) => {
        const range = AUTOPILOT_METRIC_RANGES.find(
          (option) => String(option.days) === next
        );
        if (range) {
          onChange(range.days);
        }
      }}
      value={String(value)}
    >
      <SelectTrigger aria-label="Reporting period">
        <HugeiconsIcon
          aria-hidden="true"
          className="text-muted-foreground size-3.5"
          icon={Calendar03Icon}
        />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {AUTOPILOT_METRIC_RANGES.map((range) => (
          <SelectItem key={range.days} value={String(range.days)}>
            {range.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
