import { HugeiconsIcon } from "@hugeicons/react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@notra/ui/components/ui/empty";

import type { AutopilotTableEmptyProps } from "@/types/autopilot";

/** What an Autopilot table shows before it has rows, like the Prompts table. */
export function AutopilotTableEmpty({
  icon,
  title,
  description,
  action,
}: AutopilotTableEmptyProps) {
  return (
    <Empty className="py-8 md:py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={icon} />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}
