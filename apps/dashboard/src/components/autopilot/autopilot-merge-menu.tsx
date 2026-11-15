"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";

import { Button } from "@/components/button";
import {
  AUTOPILOT_MERGE_METHOD_LABELS,
  AUTOPILOT_MERGE_METHODS,
} from "@/constants/autopilot-ui";
import type { AutopilotMergeMenuProps } from "@/types/autopilot";

/** GitHub's merge button: pick how, and the pick merges. */
export function AutopilotMergeMenu({
  size = "xs",
  loading,
  onMerge,
}: AutopilotMergeMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button loading={loading} size={size} />}>
        Merge
        <HugeiconsIcon icon={ArrowDown01Icon} size={14} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {AUTOPILOT_MERGE_METHODS.map((method) => (
          <DropdownMenuItem key={method} onClick={() => onMerge(method)}>
            {AUTOPILOT_MERGE_METHOD_LABELS[method]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
