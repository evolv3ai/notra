import { Alert02Icon, InformationCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@notra/ui/lib/utils";

import type { UtmIssueListProps, UtmIssueLevel } from "@/types/utm-builder";

const ISSUE_STYLES: Record<UtmIssueLevel, string> = {
  error: "text-[#B42318] dark:text-[#FDA29B]",
  warning: "text-[#8A5A00] dark:text-[#F5C76A]",
  info: "text-[#1E1E1E99] dark:text-white/55",
};

export function UtmIssueList({ issues }: UtmIssueListProps) {
  if (issues.length === 0) {
    return null;
  }
  return (
    <ul className="flex flex-col gap-2">
      {issues.map((issue) => (
        <li
          className={cn(
            "flex items-start gap-2 font-sans text-[0.875rem]/5.5",
            ISSUE_STYLES[issue.level]
          )}
          key={issue.message}
        >
          <HugeiconsIcon
            className="mt-0.5 size-4 shrink-0"
            icon={issue.level === "info" ? InformationCircleIcon : Alert02Icon}
          />
          <span>{issue.message}</span>
        </li>
      ))}
    </ul>
  );
}
