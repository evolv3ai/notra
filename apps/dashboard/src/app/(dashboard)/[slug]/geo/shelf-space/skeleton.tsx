"use client";

import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { Kbd } from "@notra/ui/components/ui/kbd";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useIsMobile } from "@notra/ui/hooks/use-mobile";
import { DataTableSkeleton } from "ui/table";
import type { DataTableSkeletonColumn } from "ui/table/types";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { PageContainer } from "@/components/layout/container";
import {
  GEO_SHELF_ADD_HOTKEY,
  GEO_SHELF_TABLE_COLUMN,
  GEO_SHELF_TABLE_ROW_HEIGHT,
} from "@/constants/geo-shelf";

const SHELF_ROW_COUNT = 8;
const SHELF_COLUMN_WIDTHS: readonly DataTableSkeletonColumn[] = [
  GEO_SHELF_TABLE_COLUMN.title,
  GEO_SHELF_TABLE_COLUMN.citations,
  GEO_SHELF_TABLE_COLUMN.own,
  GEO_SHELF_TABLE_COLUMN.competitors,
  GEO_SHELF_TABLE_COLUMN.ticket,
];
/** ShelfTable drops the competitors column on mobile. */
const SHELF_MOBILE_COLUMN_WIDTHS = SHELF_COLUMN_WIDTHS.filter(
  (column) => column !== GEO_SHELF_TABLE_COLUMN.competitors
);

export function GeoShelfSkeleton() {
  const t = useTranslations("geo.pages.shelfSpace");
  const tCommon = useTranslations("common");
  const tGeoShared = useTranslations("geo.shared");
  const isMobile = useIsMobile();
  return (
    <PageContainer className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="w-full space-y-6 px-4 lg:px-6">
        <PageHeading
          description={t("description")}
          title={tCommon("labels.shelfSpace")}
        >
          <Button className="gap-1.5" disabled size="sm">
            <HugeiconsIcon className="size-4" icon={PlusSignIcon} />
            {tGeoShared("addShelf")}
            <Kbd className="ml-1 hidden sm:inline-flex">
              {GEO_SHELF_ADD_HOTKEY}
            </Kbd>
          </Button>
        </PageHeading>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-8 w-72 rounded-lg" />
              <Skeleton className="h-7 w-[6.5rem] rounded-md" />
              <Skeleton className="h-7 w-32 rounded-md" />
            </div>
            <Skeleton className="h-7 w-[8.5rem] rounded-lg" />
          </div>
          <DataTableSkeleton
            columnWidths={
              isMobile ? SHELF_MOBILE_COLUMN_WIDTHS : SHELF_COLUMN_WIDTHS
            }
            rowHeight={GEO_SHELF_TABLE_ROW_HEIGHT}
            rows={SHELF_ROW_COUNT}
          />
        </div>
      </div>
    </PageContainer>
  );
}
