"use client";

import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PROMPTS_TABLE_ROW_HEIGHT } from "@notra/geo-core/constants/geo";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { Kbd } from "@notra/ui/components/ui/kbd";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { DataTableSkeleton } from "ui/table";
import type { DataTableSkeletonColumn } from "ui/table/types";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { PageContainer } from "@/components/layout/container";

const PROMPT_ROW_COUNT = 6;
/** Prompt, mentioned instead, presence, actions (after the checkbox). */
const PROMPT_COLUMN_WIDTHS: readonly DataTableSkeletonColumn[] = [
  { width: "1fr", minWidth: "10rem" },
  { width: "16rem", minWidth: "10rem" },
  { width: "10rem", minWidth: "10rem" },
  { width: "3.5rem", minWidth: "3.5rem", align: "right" },
];

export function GeoPromptsSkeleton() {
  const t = useTranslations("geo.pages.prompts");
  const tCommon = useTranslations("common");
  const tGeoShared = useTranslations("geo.shared");
  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full space-y-6 px-4 lg:px-6">
        <PageHeading
          description={t("description")}
          title={tCommon("labels.prompts")}
        >
          <div className="flex items-center gap-2">
            <Button className="gap-1.5" size="sm">
              <HugeiconsIcon className="size-4" icon={PlusSignIcon} />
              {tGeoShared("addPrompt")}
              <Kbd className="ml-1 hidden sm:inline-flex">P</Kbd>
            </Button>
          </div>
        </PageHeading>
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-8 w-[22rem] max-w-full rounded-lg" />
          <Skeleton className="h-7 w-[8.625rem] rounded-md" />
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Skeleton className="h-8 w-full min-w-0 rounded-md sm:w-72" />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Skeleton className="h-7 w-36 rounded-md" />
              <Skeleton className="h-7 w-36 rounded-md" />
            </div>
          </div>
          <DataTableSkeleton
            columnWidths={PROMPT_COLUMN_WIDTHS}
            rowHeight={PROMPTS_TABLE_ROW_HEIGHT}
            rows={PROMPT_ROW_COUNT}
            selectable
          />
        </div>
      </div>
    </PageContainer>
  );
}
