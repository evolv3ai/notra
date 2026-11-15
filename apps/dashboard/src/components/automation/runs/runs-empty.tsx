"use client";

import { Task01Icon } from "@hugeicons/core-free-icons";
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

/** Shared by the runs page and an automation's run history. */
export function RunsEmpty({ onReset }: { onReset?: () => void }) {
  const t = useTranslations("automation.runs");
  return (
    <Empty className="py-0 md:py-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={Task01Icon} />
        </EmptyMedia>
        <EmptyTitle>{t("empty.title")}</EmptyTitle>
        <EmptyDescription>
          {onReset ? t("empty.filtered") : t("empty.description")}
        </EmptyDescription>
      </EmptyHeader>
      {onReset ? (
        <EmptyContent>
          <Button onClick={onReset} size="sm" variant="outline">
            {t("empty.viewAll")}
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}
