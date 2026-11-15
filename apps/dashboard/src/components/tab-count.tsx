"use client";

import { useLocale } from "use-intl";

import type { TabCountProps } from "@/types/components/tab-count";
import { formatCount } from "@/utils/format";

/** Muted count beside a tab label; hidden while unknown or zero. */
export function TabCount({ count }: TabCountProps) {
  const locale = useLocale();
  if (count === undefined || count === 0) {
    return null;
  }
  return (
    <span className="text-muted-foreground text-xs font-normal tabular-nums">
      {formatCount(count, locale)}
    </span>
  );
}
