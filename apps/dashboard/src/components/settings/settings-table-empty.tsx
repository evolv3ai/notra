"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@notra/ui/components/ui/empty";

import type { SettingsTableEmptyProps } from "@/types/settings/modal";

export function SettingsTableEmpty({
  icon,
  title,
  description,
  children,
}: SettingsTableEmptyProps) {
  return (
    <Empty className="py-0 md:py-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={icon} />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? (
          <EmptyDescription>{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
      {children ? <EmptyContent>{children}</EmptyContent> : null}
    </Empty>
  );
}
