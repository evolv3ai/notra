"use client";

import { AlertCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@notra/ui/components/ui/empty";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";

/** Shown instead of an empty state when automations or runs failed to load. */
export function AutomationLoadError({
  kind,
  onRetry,
  retrying,
}: {
  kind: "automations" | "runs";
  onRetry: () => void;
  retrying: boolean;
}) {
  const t = useTranslations("automation.loadError");
  const tCommon = useTranslations("common");
  return (
    <Empty className="py-0 md:py-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={AlertCircleIcon} />
        </EmptyMedia>
        <EmptyTitle>{t(`${kind}.title`)}</EmptyTitle>
        <EmptyDescription>{t(`${kind}.description`)}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          disabled={retrying}
          onClick={onRetry}
          size="sm"
          variant="outline"
        >
          {tCommon("actions.tryAgain")}
        </Button>
      </EmptyContent>
    </Empty>
  );
}
