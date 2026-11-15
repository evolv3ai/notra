"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";

import { Button } from "@/components/button";
import type { ContentPanelHeaderButtonProps } from "@/types/components/content-chat-activity-panel";

export function ContentPanelHeaderButton({
  icon,
  label,
  tooltip,
  onClick,
  pressed,
}: ContentPanelHeaderButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-pressed={pressed}
            className="cursor-pointer"
            onClick={onClick}
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <span className="sr-only">{label}</span>
        <HugeiconsIcon className="size-4" icon={icon} strokeWidth={1.8} />
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
