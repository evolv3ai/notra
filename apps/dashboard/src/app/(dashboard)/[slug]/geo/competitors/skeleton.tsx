"use client";

import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { COMPETITORS_TABLE_ROW_HEIGHT } from "@notra/geo-core/constants/geo";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { Kbd } from "@notra/ui/components/ui/kbd";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { DataTableSkeleton } from "ui/table";
import type { DataTableSkeletonColumn } from "ui/table/types";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { PageContainer } from "@/components/layout/container";

const COMPETITOR_ROW_COUNT = 6;
/** Brand, share of voice, actions (after the checkbox). */
const COMPETITOR_COLUMN_WIDTHS: readonly DataTableSkeletonColumn[] = [
  "1fr",
  { width: "16rem", collapsePriority: 1 },
  { width: "3.5rem", align: "right" },
];

export function CompetitorDetailSkeleton() {
  const tGeoShared = useTranslations("geo.shared");
  return (
    <div className="space-y-6">
      <div className="flex min-w-0 items-center gap-3">
        <Skeleton className="size-10 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-pretty">
          {tGeoShared("mentionsOverTime")}
        </h2>
        <Skeleton className="h-56 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-36 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export function GeoCompetitorsSkeleton() {
  const t = useTranslations("geo.pages.competitors");
  const tTable = useTranslations("geo.competitorsTable");
  const tCommon = useTranslations("common");
  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full space-y-6 px-4 lg:px-6">
        <PageHeading
          description={t("description")}
          title={tCommon("labels.competitors")}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-[8.625rem] rounded-md" />
            <Button disabled size="sm">
              <HugeiconsIcon className="size-4" icon={PlusSignIcon} />
              {t("newCompetitor")}
              <Kbd className="ml-1 hidden sm:inline-flex">C</Kbd>
            </Button>
          </div>
        </PageHeading>
        <Skeleton className="h-96 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium">{tTable("title")}</h2>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
                <Skeleton className="h-8 w-full rounded-md" />
              </div>
            </div>
          </div>
          <DataTableSkeleton
            columnWidths={COMPETITOR_COLUMN_WIDTHS}
            rowHeight={COMPETITORS_TABLE_ROW_HEIGHT}
            rows={COMPETITOR_ROW_COUNT}
            selectable
          />
        </section>
      </div>
    </PageContainer>
  );
}
