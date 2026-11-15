"use client";

import { cn } from "@notra/ui/lib/utils";
import { formatRelative } from "@notra/utils/format-relative";

import type { SiteRelativeTimeProps } from "@/types/sites";

const LOCALE = "en";

export function SiteRelativeTime({
  date,
  className,
  inline = false,
}: SiteRelativeTimeProps) {
  const value = new Date(date);
  const iso = value.toISOString();
  return (
    <time
      className={cn("tabular-nums", className)}
      dateTime={iso}
      suppressHydrationWarning
      title={value.toLocaleString(LOCALE, {
        timeZone: "UTC",
        timeZoneName: "short",
      })}
    >
      {formatRelative(iso, LOCALE, inline ? "just now" : "Just now")}
    </time>
  );
}
